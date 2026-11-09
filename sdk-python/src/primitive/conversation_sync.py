"""Incremental conversation sync over ``GET /emails/{id}/conversation?since=``.

A ``since`` read returns the messages created or changed after a cursor, plus
the cursor to continue from and ``has_more`` when the delta stopped at its page
size. A message can come back in a later read with more ``copies`` listed, or
under another id when a better copy of it becomes visible. The merge rule,
shared by the Node, Python and Go SDKs and pinned by
``test-fixtures/conversation-sync.json``:

1. Upsert each returned message by ``id``.
2. Two entries are the same message when either one's id is in the other's
   ``copies`` or ``sent_email_id``. The newer entry replaces the held one and
   takes its place.
3. Order by ``timestamp`` (millisecond precision, a missing timestamp last),
   then by position in the held list, with new messages after held ones in
   the order they arrived.

:func:`sync_conversation` normalizes each returned message's ``timestamp``
before decoding it: an RFC 3339 date-time with an offset is kept, one without
an offset is read as UTC and gets ``Z``, and anything else becomes None. A
sync stops with an error after :data:`MAX_CONVERSATION_SYNC_PAGES` pages.

Deleted messages are not reported by a ``since`` read. Sync again without a
state now and then to reconcile.
"""

from __future__ import annotations

import calendar
import datetime
import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from uuid import UUID

from .api import AuthenticatedClient
from .api.api.emails import get_conversation
from .api.models.conversation import Conversation
from .api.models.conversation_message import ConversationMessage
from .api.models.get_conversation_response_200 import GetConversationResponse200
from .api.types import UNSET, Unset
from .client import PrimitiveAPIError, PrimitiveClient, _raise_api_error

_EPOCH = datetime.datetime(1970, 1, 1, tzinfo=datetime.UTC)
_MILLISECOND = datetime.timedelta(milliseconds=1)

#: The most pages one sync reads before it stops with an error.
MAX_CONVERSATION_SYNC_PAGES = 1000

_RFC3339 = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?"
    r"(Z|[+-]\d{2}:\d{2})?$"
)


def _normalize_timestamp(value: str) -> str | None:
    """A message timestamp as the sync keeps it, or None when it is not one.

    The same checks run in the Node and Go SDKs, pinned by the ``timestamps``
    cases of ``test-fixtures/conversation-sync.json``.
    """
    match = _RFC3339.fullmatch(value)
    if match is None:
        return None
    year, month, day, hour, minute, second = (int(match.group(i)) for i in range(1, 7))
    if year < 1 or not 1 <= month <= 12:
        return None
    if not 1 <= day <= calendar.monthrange(year, month)[1]:
        return None
    if hour > 23 or minute > 59 or second > 59:
        return None
    zone = match.group(8)
    if (
        zone is not None
        and zone != "Z"
        and (int(zone[1:3]) > 23 or int(zone[4:6]) > 59)
    ):
        return None
    return value if zone is not None else f"{value}Z"


def _normalize_page_timestamps(body: object) -> None:
    """Normalize every message timestamp of a raw conversation response."""
    if not isinstance(body, dict):
        return
    data = body.get("data")
    messages = data.get("messages") if isinstance(data, dict) else None
    if not isinstance(messages, list):
        return
    for message in messages:
        if isinstance(message, dict) and isinstance(message.get("timestamp"), str):
            message["timestamp"] = _normalize_timestamp(message["timestamp"])


@dataclass
class ConversationSync:
    """The result of a sync, and the state to pass to the next one.

    ``cursor`` and ``messages`` are what the next sync needs. ``thread_id``,
    ``subject``, ``message_count`` and ``truncated`` come from the last page
    read and describe the whole conversation; ``message_count`` and
    ``truncated`` are None when that page omitted them, as an empty delta can.
    """

    cursor: str
    messages: list[ConversationMessage] = field(default_factory=list)
    thread_id: UUID | None = None
    subject: str | None = None
    message_count: int | None = None
    truncated: bool | None = None


def _timestamp_ms(message: ConversationMessage) -> float:
    timestamp = message.timestamp
    if not isinstance(timestamp, datetime.datetime):
        return float("inf")
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=datetime.UTC)
    return float((timestamp - _EPOCH) // _MILLISECOND)


def _linked_ids(message: ConversationMessage) -> set[UUID]:
    """The ids an entry stands for besides its own: its copies and its send."""
    ids: set[UUID] = set()
    if not isinstance(message.copies, Unset):
        ids.update(copy.id for copy in message.copies)
    if not isinstance(message.sent_email_id, Unset):
        ids.add(message.sent_email_id)
    ids.discard(message.id)
    return ids


def merge_conversation_messages(
    held: Sequence[ConversationMessage],
    delta: Sequence[ConversationMessage],
) -> list[ConversationMessage]:
    """Merge a ``since`` delta into held messages and return the new ordered list.

    Neither input is modified.
    """
    entries: list[tuple[ConversationMessage, int]] = [
        (message, seq) for seq, message in enumerate(held)
    ]
    next_seq = len(entries)
    for message in delta:
        linked = _linked_ids(message)
        inherited: int | None = None
        kept: list[tuple[ConversationMessage, int]] = []
        for entry in entries:
            held_message = entry[0]
            same = held_message.id != message.id and (
                held_message.id in linked or message.id in _linked_ids(held_message)
            )
            if same:
                inherited = entry[1] if inherited is None else min(inherited, entry[1])
            else:
                kept.append(entry)
        entries = kept
        for index, (existing, seq) in enumerate(entries):
            if existing.id == message.id:
                entries[index] = (message, seq)
                break
        else:
            if inherited is not None:
                entries.append((message, inherited))
            else:
                entries.append((message, next_seq))
                next_seq += 1
    entries.sort(key=lambda entry: (_timestamp_ms(entry[0]), entry[1]))
    return [message for message, _ in entries]


def run_conversation_sync(
    read: Callable[[str], Conversation],
    state: ConversationSync | None = None,
) -> ConversationSync:
    """Run a sync with a caller-supplied page reader.

    ``read(since)`` returns the conversation for one ``since`` read. Reads
    from ``state.cursor`` (or ``start`` without a state) and follows
    ``has_more`` until it is false.
    """
    since = state.cursor if state is not None and state.cursor else "start"
    messages = list(state.messages) if state is not None else []
    for _ in range(MAX_CONVERSATION_SYNC_PAGES):
        page = read(since)
        if isinstance(page.cursor, Unset) or not page.cursor:
            raise PrimitiveAPIError(
                "Conversation read returned no cursor; cannot continue the sync.",
                payload=page.to_dict(),
            )
        messages = merge_conversation_messages(messages, page.messages)
        if page.has_more is not True:
            return ConversationSync(
                cursor=page.cursor,
                messages=messages,
                thread_id=page.thread_id,
                subject=None if isinstance(page.subject, Unset) else page.subject,
                message_count=None
                if isinstance(page.message_count, Unset)
                else page.message_count,
                truncated=None if isinstance(page.truncated, Unset) else page.truncated,
            )
        if page.cursor == since:
            raise PrimitiveAPIError(
                "Conversation read reported has_more without advancing the cursor.",
                payload=page.to_dict(),
            )
        since = page.cursor
    raise PrimitiveAPIError(
        f"Conversation sync read {MAX_CONVERSATION_SYNC_PAGES} pages without "
        "reaching the end; stopping.",
        payload={"since": since},
    )


def sync_conversation(
    client: PrimitiveClient | AuthenticatedClient,
    email_id: UUID | str,
    state: ConversationSync | None = None,
) -> ConversationSync:
    """Bring a conversation up to date with incremental ``since`` reads.

    Reads ``GET /emails/{id}/conversation`` from ``since=start`` without a
    state, or from ``state.cursor`` with one, paging through ``has_more``.
    Pass the returned value back as ``state`` to read only what changed::

        sync = sync_conversation(client, email_id)
        # later
        sync = sync_conversation(client, email_id, sync)

    Messages are merged by :func:`merge_conversation_messages`.
    """
    api_client = client.api_client if isinstance(client, PrimitiveClient) else client
    conversation_id = email_id if isinstance(email_id, UUID) else UUID(email_id)

    def read(since: str) -> Conversation:
        # The request is sent here rather than through sync_detailed so the
        # timestamps can be normalized before the generated model parses them.
        response = api_client.get_httpx_client().request(
            **get_conversation._get_kwargs(conversation_id, since=since, limit=UNSET)
        )
        if response.status_code != 200:
            _raise_api_error(
                get_conversation._build_response(client=api_client, response=response)
            )
            raise AssertionError("unreachable")
        body = response.json()
        _normalize_page_timestamps(body)
        parsed = GetConversationResponse200.from_dict(body)
        if isinstance(parsed.data, Unset):
            raise PrimitiveAPIError(
                "Primitive API returned no conversation",
                status_code=200,
                payload=parsed.to_dict(),
            )
        return parsed.data

    return run_conversation_sync(read, state)
