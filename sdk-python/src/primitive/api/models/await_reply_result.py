from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.reply_email import ReplyEmail





T = TypeVar("T", bound="AwaitReplyResult")



@_attrs_define
class AwaitReplyResult:
    """ Result of `/sent-emails/{id}/reply`. `reply` is null when no
    reply has arrived yet (no-wait call, or the wait timed out).

        Attributes:
            sent_email_id (UUID): The send this lookup was keyed on (echoes the path id).
            reply (None | ReplyEmail):
            waited (bool): Whether the call ran in long-poll mode (`wait=true`).
            timed_out (bool): True only when a `wait=true` call elapsed its timeout with no reply.
     """

    sent_email_id: UUID
    reply: None | ReplyEmail
    waited: bool
    timed_out: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.reply_email import ReplyEmail
        sent_email_id = str(self.sent_email_id)

        reply: dict[str, Any] | None
        if isinstance(self.reply, ReplyEmail):
            reply = self.reply.to_dict()
        else:
            reply = self.reply

        waited = self.waited

        timed_out = self.timed_out


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "sent_email_id": sent_email_id,
            "reply": reply,
            "waited": waited,
            "timed_out": timed_out,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.reply_email import ReplyEmail
        d = dict(src_dict)
        sent_email_id = UUID(d.pop("sent_email_id"))




        def _parse_reply(data: object) -> None | ReplyEmail:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                reply_type_0 = ReplyEmail.from_dict(data)



                return reply_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ReplyEmail, data)

        reply = _parse_reply(d.pop("reply"))


        waited = d.pop("waited")

        timed_out = d.pop("timed_out")

        await_reply_result = cls(
            sent_email_id=sent_email_id,
            reply=reply,
            waited=waited,
            timed_out=timed_out,
        )

        return await_reply_result

