"""Durable local event receiving over WebSocket or explicit HTTP polling."""

from __future__ import annotations

import asyncio
import json
import math
import random
import re
import time
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Literal, Protocol, TypeVar, cast
from urllib.parse import urlsplit, urlunsplit

import httpx
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed
from websockets.typing import Subprotocol

from .api import AuthenticatedClient
from .types import WebhookEvent
from .webhook import parse_webhook_event

T = TypeVar("T")
Transport = Literal["websocket", "poll"]
StatusCallback = Callable[["EventStatus"], None]


class EventReceiverError(Exception):
    def __init__(self, code: str, status: int = 0, retry_after: float = 0) -> None:
        super().__init__(f"Event receiver failed ({code}, HTTP {status})")
        self.code, self.status, self.retry_after = code, status, retry_after


class DeliveryExpired(EventReceiverError):
    def __init__(self) -> None:
        super().__init__("delivery_expired", 409)


@dataclass(frozen=True)
class LocalEvent:
    id: str
    type: str
    data: WebhookEvent
    body: str
    headers: dict[str, str]


@dataclass(frozen=True)
class EventContext:
    signal: asyncio.Event


@dataclass(frozen=True)
class EventStatus:
    type: str
    backlog: int | None = None
    gap_count: int | None = None
    last_gap_reason: str | None = None
    error: Exception | None = None


class EventSocket(Protocol):
    async def send(self, message: str) -> None: ...
    async def recv(self) -> str | bytes: ...
    async def close(self) -> None: ...


SocketFactory = Callable[[str], Awaitable[EventSocket]]


class _NoRedirectConnect(connect):
    def process_redirect(self, exc: Exception) -> Exception:
        return exc


async def _socket(url: str) -> EventSocket:
    return await _NoRedirectConnect(
        url,
        subprotocols=[Subprotocol("primitive.events.v1")],
        compression=None,
        max_size=64 * 1024 * 1024,
        max_queue=2,
        close_timeout=2,
    )


def _object(value: object) -> dict[str, object]:
    if not isinstance(value, dict) or not all(isinstance(k, str) for k in value):
        raise EventReceiverError("invalid_response")
    return cast(dict[str, object], value)


def _retry_after(value: str | None) -> float:
    if value is None:
        return 0
    try:
        seconds = float(value)
    except ValueError:
        try:
            seconds = parsedate_to_datetime(value).timestamp() - time.time()
        except (ValueError, TypeError, OverflowError):
            return 0
    return max(0, seconds) if math.isfinite(seconds) else 0


async def _retry(
    operation: Callable[[], Awaitable[T]], status: StatusCallback | None = None
) -> T:
    attempt = 0
    while True:
        retry_after = 0.0
        try:
            return await operation()
        except EventReceiverError as error:
            if error.code in {
                "invalid_response",
                "unsupported",
                "pull_unavailable",
                "subscription_unavailable",
            } or not (error.status in {0, 408, 429} or error.status >= 500):
                raise
            retry_after = error.retry_after
        except (httpx.TransportError, OSError, ConnectionClosed, asyncio.TimeoutError):
            pass
        if status:
            status(EventStatus("reconnecting"))
        await asyncio.sleep(
            max(
                retry_after,
                min(10, 0.25 * 2 ** min(attempt, 6)) * random.uniform(0.8, 1.2),
            )
        )
        attempt += 1


class _Connection:
    def __init__(
        self,
        client: httpx.AsyncClient,
        token: str,
        endpoint: str,
        transport: Transport,
        socket_factory: SocketFactory,
        status: StatusCallback | None,
        on_gap: Literal["report", "error"],
    ) -> None:
        self.client, self.token, self.endpoint = client, token, endpoint
        self.transport, self.socket_factory = transport, socket_factory
        self.on_status, self.on_gap = status, on_gap
        self.socket: EventSocket | None = None
        self.account_id: object = None
        self.status = EventStatus("ready")
        self.gaps = -1

    async def request(self, path: str, body: dict[str, object] | None = None) -> object:
        response = await self.client.request(
            "GET" if body is None else "POST",
            path,
            json=body,
            timeout=45,
            follow_redirects=False,
        )
        value = _object(response.json())
        if not response.is_success:
            code = _object(value.get("error", {})).get("code", "request_failed")
            raise EventReceiverError(
                str(code),
                response.status_code,
                _retry_after(response.headers.get("retry-after")),
            )
        if value.get("success") is not True:
            raise EventReceiverError("invalid_response")
        return value.get("data")

    async def open(self) -> None:
        if self.transport == "poll" or self.socket:
            return
        account_id = _object(await self.request("account")).get("id")
        if not account_id or (self.account_id and account_id != self.account_id):
            raise EventReceiverError("identity_changed", 403)
        self.account_id = account_id
        url = urlsplit(
            str(self.client.base_url.join(f"endpoints/{self.endpoint}/stream"))
        )
        if url.scheme != "https" and not (
            url.scheme == "http" and url.hostname in {"localhost", "127.0.0.1", "::1"}
        ):
            raise EventReceiverError("unsupported")
        self.socket = await self.socket_factory(
            urlunsplit(url._replace(scheme="wss" if url.scheme == "https" else "ws"))
        )
        try:
            frame = await asyncio.wait_for(
                self.exchange({"type": "authenticate", "token": self.token}), 15
            )
            if (
                frame.get("type") != "ready"
                or frame.get("protocol") != "primitive.events.v1"
            ):
                raise EventReceiverError("unsupported")
        except BaseException:
            await self.close()
            raise

    async def close(self) -> None:
        socket, self.socket = self.socket, None
        if socket:
            await socket.close()

    def update(self, value: object) -> dict[str, object]:
        data = _object(value)
        backlog, gaps = data.get("backlog"), data.get("gap_count")
        reason = data.get("last_gap_reason")
        if (
            type(backlog) is not int
            or backlog < 0
            or type(gaps) is not int
            or gaps < 0
            or (reason is not None and not isinstance(reason, str))
            or data.get("handler_timeout_seconds") != 30
            or data.get("retention_seconds") != 86400
        ):
            raise EventReceiverError("invalid_response")
        self.status = EventStatus("ready", backlog, gaps, reason)
        if gaps > 0 and gaps != self.gaps:
            self.gaps = gaps
            if self.on_status:
                self.on_status(EventStatus("gap", backlog, gaps, reason))
            if self.on_gap == "error":
                raise EventReceiverError("event_gap", 409)
        return data

    async def exchange(self, frame: dict[str, object]) -> dict[str, object]:
        socket = self.socket
        if socket is None:
            raise EventReceiverError("disconnected")
        try:
            await socket.send(json.dumps(frame))
            while True:
                value = _object(json.loads(await asyncio.wait_for(socket.recv(), 60)))
                if value.get("type") == "ping":
                    await socket.send('{"type":"pong"}')
                elif value.get("type") == "status":
                    self.update(value.get("data"))
                elif value.get("type") == "error":
                    status = value.get("status")
                    raise EventReceiverError(
                        str(value.get("code", "request_failed")),
                        status if isinstance(status, int) else 0,
                        _retry_after(str(value.get("retry_after", ""))),
                    )
                else:
                    return value
        except BaseException:
            await self.close()
            raise

    async def receive(self) -> dict[str, object]:
        await self.open()
        if self.transport == "poll":
            return self.update(
                await self.request(
                    f"endpoints/{self.endpoint}/pull", {"wait_seconds": 25}
                )
            )
        frame = await self.exchange({"type": "receive"})
        if frame.get("type") != "event":
            raise EventReceiverError("invalid_response")
        return self.update(frame.get("data"))

    async def complete(self, body: dict[str, object]) -> None:
        await self.open()
        if self.transport == "poll":
            receipt = await self.request(f"endpoints/{self.endpoint}/complete", body)
        else:
            frame = await asyncio.wait_for(
                self.exchange({"type": "complete", "body": body}), 15
            )
            if frame.get("type") != "receipt":
                raise EventReceiverError("invalid_response")
            receipt = frame.get("data")
        if _object(receipt).get("result") not in {"completed", "already_completed"}:
            raise EventReceiverError("invalid_response")


class PendingEvent:
    def __init__(
        self, raw: object, connection: _Connection, release: Callable[[], None]
    ) -> None:
        data = _object(raw)
        for key in (
            "event_id",
            "event_type",
            "body",
            "queue_id",
            "delivery_id",
            "lease_token",
            "lease_expires_at",
        ):
            if not isinstance(data.get(key), str):
                raise EventReceiverError("invalid_response")
        body, event_type = str(data["body"]), str(data["event_type"])
        headers = _object(data.get("headers"))
        if not all(isinstance(value, str) for value in headers.values()):
            raise EventReceiverError("invalid_response")
        self.event = LocalEvent(
            str(data["event_id"]),
            event_type,
            parse_webhook_event(json.loads(body), event_type),
            body,
            cast(dict[str, str], headers),
        )
        self.signal = asyncio.Event()
        self._raw, self._connection, self._release = data, connection, release
        self._started = time.monotonic()
        self._expires = datetime.fromisoformat(
            str(data["lease_expires_at"]).replace("Z", "+00:00")
        ).timestamp()
        remaining = min(30, self._expires - time.time() - 5)
        if remaining <= 0:
            raise DeliveryExpired()
        self._timer = asyncio.get_running_loop().call_later(remaining, self._expire)
        self._accepted: bool | None = None
        self._settled: asyncio.Task[None] | None = None

    def _expire(self) -> None:
        self.signal.set()
        self._release()

    async def _complete(self, accepted: bool) -> None:
        if self._settled is not None:
            if self._accepted != accepted:
                raise EventReceiverError("completion_conflict", 409)
            await asyncio.shield(self._settled)
            return
        if self.signal.is_set():
            raise DeliveryExpired()
        self._accepted = accepted
        self._timer.cancel()
        body: dict[str, object] = {
            key: self._raw[key] for key in ("queue_id", "delivery_id", "lease_token")
        }
        body.update(
            mode="sdk",
            accepted=accepted,
            duration_ms=min(30000, round((time.monotonic() - self._started) * 1000)),
        )

        async def settle() -> None:
            try:
                await asyncio.wait_for(
                    _retry(lambda: self._connection.complete(body)),
                    min(60, max(0.001, self._expires - time.time())),
                )
            finally:
                self._release()

        self._settled = asyncio.create_task(settle())
        await asyncio.shield(self._settled)

    async def ack(self) -> None:
        await self._complete(True)

    async def retry(self) -> None:
        await self._complete(False)


Handler = Callable[[LocalEvent, EventContext], Awaitable[None]]


class EventListener:
    def __init__(
        self, connection: _Connection, handler: Handler, release: Callable[[], None]
    ) -> None:
        self._connection, self._handler, self._release = connection, handler, release
        self._stopping = False
        self._receiving: asyncio.Task[dict[str, object]] | None = None
        self._task = asyncio.create_task(self._run())
        self._task.add_done_callback(
            lambda task: None if task.cancelled() else task.exception()
        )

    @property
    def status(self) -> EventStatus:
        return self._connection.status

    async def _run(self) -> None:
        try:
            while not self._stopping:
                self._receiving = asyncio.create_task(
                    _retry(self._connection.receive, self._connection.on_status)
                )
                try:
                    offer = await self._receiving
                finally:
                    self._receiving = None
                if offer.get("delivery") is None:
                    await asyncio.sleep(0.25)
                    continue
                delivery = PendingEvent(
                    offer["delivery"], self._connection, lambda: None
                )
                handler = asyncio.ensure_future(
                    self._handler(delivery.event, EventContext(delivery.signal))
                )
                expiry = asyncio.create_task(delivery.signal.wait())
                try:
                    done, _ = await asyncio.wait(
                        {handler, expiry}, return_when=asyncio.FIRST_COMPLETED
                    )
                    if expiry in done:
                        handler.cancel()
                        handler.add_done_callback(
                            lambda task: None if task.cancelled() else task.exception()
                        )
                        raise DeliveryExpired()
                    try:
                        await handler
                    except Exception as error:
                        if self._connection.on_status:
                            self._connection.on_status(
                                EventStatus("handler_error", error=error)
                            )
                        await delivery.retry()
                    else:
                        await delivery.ack()
                finally:
                    expiry.cancel()
                    delivery._timer.cancel()
                    if not handler.done():
                        handler.cancel()
        except asyncio.CancelledError:
            if not self._stopping:
                raise
        finally:
            await self._connection.close()
            self._release()
            if self._connection.on_status:
                self._connection.on_status(EventStatus("closed"))

    async def wait_closed(self) -> None:
        await self._task

    async def close(self) -> None:
        self._stopping = True
        if self._receiving:
            self._receiving.cancel()
        await self._task

    async def __aenter__(self) -> EventListener:
        return self

    async def __aexit__(self, *_args: object) -> None:
        await self.close()


class EventsResource:
    def __init__(self, client: AuthenticatedClient) -> None:
        self._client = client
        self._active: set[str] = set()
        self._closing: set[asyncio.Task[None]] = set()

    def _reserve(
        self, subscription: str, events: Sequence[str] | None
    ) -> Callable[[], None]:
        if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}", subscription):
            raise ValueError(
                "subscription must be 1-64 letters, digits, underscores or hyphens, starting with a letter or digit"
            )
        if events is not None and (
            not events or len(events) > 50 or any(not event.strip() for event in events)
        ):
            raise ValueError("events must contain 1-50 nonempty names")
        if subscription in self._active:
            raise EventReceiverError("busy", 409)
        self._active.add(subscription)
        return lambda: self._active.discard(subscription)

    async def _connect(
        self,
        subscription: str,
        events: Sequence[str] | None,
        transport: Transport,
        socket_factory: SocketFactory,
        on_status: StatusCallback | None,
        on_gap: Literal["report", "error"],
    ) -> _Connection:
        connection = _Connection(
            self._client.get_async_httpx_client(),
            self._client.token,
            "",
            transport,
            socket_factory,
            on_status,
            on_gap,
        )
        body: dict[str, object] = {"kind": "pull", "name": subscription}
        if events is not None:
            body["rules"] = {"event_types": list(dict.fromkeys(events))}
        endpoint = _object(
            await _retry(lambda: connection.request("endpoints", body), on_status)
        )
        capabilities = _object(endpoint.get("receiver_capabilities", {}))
        if "sdk" not in cast(
            list[object], capabilities.get("completion_modes", [])
        ) or (
            transport != "poll"
            and "primitive.events.v1"
            not in cast(list[object], capabilities.get("stream_protocols", []))
        ):
            raise EventReceiverError("unsupported")
        if (
            endpoint.get("kind") != "pull"
            or endpoint.get("enabled") is False
            or not isinstance(endpoint.get("id"), str)
        ):
            raise EventReceiverError("subscription_unavailable", 409)
        connection.endpoint = str(endpoint["id"])
        try:
            await _retry(connection.open, on_status)
        except BaseException:
            await connection.close()
            raise
        if on_status:
            on_status(connection.status)
        return connection

    async def wait(
        self,
        *,
        subscription: str,
        events: Sequence[str] | None = None,
        timeout: float | None = None,
        transport: Transport = "websocket",
        socket_factory: SocketFactory = _socket,
        on_status: StatusCallback | None = None,
        on_gap: Literal["report", "error"] = "report",
    ) -> PendingEvent | None:
        if timeout is not None and (not math.isfinite(timeout) or timeout <= 0):
            raise ValueError("timeout must be a positive number of seconds")
        release = self._reserve(subscription, events)
        connection: _Connection | None = None
        handed_off = False

        async def receive() -> PendingEvent:
            nonlocal connection, handed_off
            connection = await self._connect(
                subscription, events, transport, socket_factory, on_status, on_gap
            )
            selected = connection

            def finished() -> None:
                release()
                task = asyncio.create_task(selected.close())
                self._closing.add(task)
                task.add_done_callback(self._closing.discard)

            while True:
                data = await _retry(connection.receive, on_status)
                if data.get("delivery") is not None:
                    delivery = PendingEvent(data["delivery"], connection, finished)
                    handed_off = True
                    return delivery
                await asyncio.sleep(0.25)

        try:
            return await asyncio.wait_for(receive(), timeout)
        except asyncio.TimeoutError:
            return None
        finally:
            if not handed_off:
                release()
                if connection:
                    await connection.close()

    async def listen(
        self,
        handler: Handler,
        *,
        subscription: str,
        events: Sequence[str] | None = None,
        transport: Transport = "websocket",
        socket_factory: SocketFactory = _socket,
        on_status: StatusCallback | None = None,
        on_gap: Literal["report", "error"] = "report",
    ) -> EventListener:
        release = self._reserve(subscription, events)
        try:
            connection = await self._connect(
                subscription, events, transport, socket_factory, on_status, on_gap
            )
            return EventListener(connection, handler, release)
        except BaseException:
            release()
            raise
