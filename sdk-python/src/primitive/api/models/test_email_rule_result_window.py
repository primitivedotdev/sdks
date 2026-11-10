from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.test_email_rule_result_window_mode import TestEmailRuleResultWindowMode
from typing import cast
import datetime






T = TypeVar("T", bound="TestEmailRuleResultWindow")



@_attrs_define
class TestEmailRuleResultWindow:
    """ 
        Attributes:
            mode (TestEmailRuleResultWindowMode):
            since (datetime.datetime | None): The oldest arrival the recent window reaches; null when email_ids were given.
            limit (int): The most emails the recent window holds: 200, less one place per expected email.
     """

    mode: TestEmailRuleResultWindowMode
    since: datetime.datetime | None
    limit: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        mode = self.mode.value

        since: None | str
        if isinstance(self.since, datetime.datetime):
            since = self.since.isoformat()
        else:
            since = self.since

        limit = self.limit


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "mode": mode,
            "since": since,
            "limit": limit,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        mode = TestEmailRuleResultWindowMode(d.pop("mode"))




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


        limit = d.pop("limit")

        test_email_rule_result_window = cls(
            mode=mode,
            since=since,
            limit=limit,
        )


        test_email_rule_result_window.additional_properties = d
        return test_email_rule_result_window

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
