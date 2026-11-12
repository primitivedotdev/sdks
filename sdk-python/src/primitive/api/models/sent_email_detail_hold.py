from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="SentEmailDetailHold")



@_attrs_define
class SentEmailDetailHold:
    """ Only on a scheduled send that is not going out yet; status stays scheduled. credential_reuse_hold: its OAuth grant
    was revoked after refresh token reuse, so it waits until released (POST /sent-emails/{id}/release) or canceled;
    canceled after 7 days. sending_ip_warmup_cap: your dedicated sending address is at today's warm-up limit or paused,
    so it goes out on its own within the hour after the limit resets at 00:00 UTC (fails with sending_ip_warmup_cap
    after 7 such holds); no release needed. On sent-email reads and conversation messages.

        Attributes:
            reason (str): Open: credential_reuse_hold, sending_ip_warmup_cap.
            since (datetime.datetime | None):
     """

    reason: str
    since: datetime.datetime | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        reason = self.reason

        since: None | str
        if isinstance(self.since, datetime.datetime):
            since = self.since.isoformat()
        else:
            since = self.since


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "reason": reason,
            "since": since,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        reason = d.pop("reason")

        def _parse_since(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                since_type_0 = datetime.datetime.fromisoformat(data)



                return since_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        since = _parse_since(d.pop("since"))


        sent_email_detail_hold = cls(
            reason=reason,
            since=since,
        )


        sent_email_detail_hold.additional_properties = d
        return sent_email_detail_hold

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
