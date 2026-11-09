from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="InboxStatusRecentEmails")



@_attrs_define
class InboxStatusRecentEmails:
    """ Inbound email activity from the last 30 days.

        Attributes:
            total (int): Number of inbound emails received in the last 30 days.
            latest_received_at (datetime.datetime | None): Most recent inbound email received in the last 30 days.
     """

    total: int
    latest_received_at: datetime.datetime | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        total = self.total

        latest_received_at: None | str
        if isinstance(self.latest_received_at, datetime.datetime):
            latest_received_at = self.latest_received_at.isoformat()
        else:
            latest_received_at = self.latest_received_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "total": total,
            "latest_received_at": latest_received_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        total = d.pop("total")

        def _parse_latest_received_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                latest_received_at_type_0 = datetime.datetime.fromisoformat(data)



                return latest_received_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        latest_received_at = _parse_latest_received_at(d.pop("latest_received_at"))


        inbox_status_recent_emails = cls(
            total=total,
            latest_received_at=latest_received_at,
        )


        inbox_status_recent_emails.additional_properties = d
        return inbox_status_recent_emails

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
