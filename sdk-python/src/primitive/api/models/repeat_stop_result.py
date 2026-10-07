from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.repeat_stop_result_status import RepeatStopResultStatus
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="RepeatStopResult")



@_attrs_define
class RepeatStopResult:
    """ 
        Attributes:
            repeat_id (UUID):
            status (RepeatStopResultStatus):
            stopped_at (datetime.datetime):
            stop_reason (None | str):
            reply_sent_email_id (None | UUID): The repeat.stop/1 reply that told the sender, or null if it could not be
                sent.
     """

    repeat_id: UUID
    status: RepeatStopResultStatus
    stopped_at: datetime.datetime
    stop_reason: None | str
    reply_sent_email_id: None | UUID





    def to_dict(self) -> dict[str, Any]:
        repeat_id = str(self.repeat_id)

        status = self.status.value

        stopped_at = self.stopped_at.isoformat()

        stop_reason: None | str
        stop_reason = self.stop_reason

        reply_sent_email_id: None | str
        if isinstance(self.reply_sent_email_id, UUID):
            reply_sent_email_id = str(self.reply_sent_email_id)
        else:
            reply_sent_email_id = self.reply_sent_email_id


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "repeat_id": repeat_id,
            "status": status,
            "stopped_at": stopped_at,
            "stop_reason": stop_reason,
            "reply_sent_email_id": reply_sent_email_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        repeat_id = UUID(d.pop("repeat_id"))




        status = RepeatStopResultStatus(d.pop("status"))




        stopped_at = datetime.datetime.fromisoformat(d.pop("stopped_at"))




        def _parse_stop_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        stop_reason = _parse_stop_reason(d.pop("stop_reason"))


        def _parse_reply_sent_email_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                reply_sent_email_id_type_0 = UUID(data)



                return reply_sent_email_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        reply_sent_email_id = _parse_reply_sent_email_id(d.pop("reply_sent_email_id"))


        repeat_stop_result = cls(
            repeat_id=repeat_id,
            status=status,
            stopped_at=stopped_at,
            stop_reason=stop_reason,
            reply_sent_email_id=reply_sent_email_id,
        )

        return repeat_stop_result

