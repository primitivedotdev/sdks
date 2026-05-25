from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
import datetime






T = TypeVar("T", bound="InboxStatusRecentEmailSummary")



@_attrs_define
class InboxStatusRecentEmailSummary:
    """ 
        Attributes:
            total (int):
            latest_received_at (datetime.datetime | None):
     """

    total: int
    latest_received_at: datetime.datetime | None





    def to_dict(self) -> dict[str, Any]:
        total = self.total

        latest_received_at: None | str
        if isinstance(self.latest_received_at, datetime.datetime):
            latest_received_at = self.latest_received_at.isoformat()
        else:
            latest_received_at = self.latest_received_at


        field_dict: dict[str, Any] = {}

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
                latest_received_at_type_0 = isoparse(data)



                return latest_received_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        latest_received_at = _parse_latest_received_at(d.pop("latest_received_at"))


        inbox_status_recent_email_summary = cls(
            total=total,
            latest_received_at=latest_received_at,
        )

        return inbox_status_recent_email_summary

