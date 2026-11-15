from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="EmailRuleShareActivity")



@_attrs_define
class EmailRuleShareActivity:
    """ 
        Attributes:
            last_decided_at (datetime.datetime | None): The start of the hour in which the rule last decided on any email in
                the sharing member's mailboxes since the share began, counting only hours that have ended and the hour of the
                newest email shared; null if none.
     """

    last_decided_at: datetime.datetime | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        last_decided_at: None | str
        if isinstance(self.last_decided_at, datetime.datetime):
            last_decided_at = self.last_decided_at.isoformat()
        else:
            last_decided_at = self.last_decided_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "last_decided_at": last_decided_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_last_decided_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_decided_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_decided_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_decided_at = _parse_last_decided_at(d.pop("last_decided_at"))


        email_rule_share_activity = cls(
            last_decided_at=last_decided_at,
        )


        email_rule_share_activity.additional_properties = d
        return email_rule_share_activity

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
