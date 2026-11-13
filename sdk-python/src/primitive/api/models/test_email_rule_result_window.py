from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.test_email_rule_result_window_mode import TestEmailRuleResultWindowMode
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_scope_used import EmailRuleScopeUsed





T = TypeVar("T", bound="TestEmailRuleResultWindow")



@_attrs_define
class TestEmailRuleResultWindow:
    """ 
        Attributes:
            mode (TestEmailRuleResultWindowMode):
            since (datetime.datetime | None): The oldest arrival the recent window reaches; null when email_ids were given.
            limit (int): The most emails the recent window holds: 200, less one place per expected email.
            scope (EmailRuleScopeUsed | Unset):
            oldest_at (datetime.datetime | None | Unset): When the oldest email tested arrived, expected ones included; null
                when none was. The window is the newest 200 the scope reaches, so a narrower scope reaches further back: compare
                counts only over the same scope and span.
            newest_at (datetime.datetime | None | Unset): When the newest email tested arrived; null when none was.
     """

    mode: TestEmailRuleResultWindowMode
    since: datetime.datetime | None
    limit: int
    scope: EmailRuleScopeUsed | Unset = UNSET
    oldest_at: datetime.datetime | None | Unset = UNSET
    newest_at: datetime.datetime | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_scope_used import EmailRuleScopeUsed # noqa: PLC0415
        mode = self.mode.value

        since: None | str
        if isinstance(self.since, datetime.datetime):
            since = self.since.isoformat()
        else:
            since = self.since

        limit = self.limit

        scope: dict[str, Any] | Unset = UNSET
        if not isinstance(self.scope, Unset):
            scope = self.scope.to_dict()

        oldest_at: None | str | Unset
        if isinstance(self.oldest_at, Unset):
            oldest_at = UNSET
        elif isinstance(self.oldest_at, datetime.datetime):
            oldest_at = self.oldest_at.isoformat()
        else:
            oldest_at = self.oldest_at

        newest_at: None | str | Unset
        if isinstance(self.newest_at, Unset):
            newest_at = UNSET
        elif isinstance(self.newest_at, datetime.datetime):
            newest_at = self.newest_at.isoformat()
        else:
            newest_at = self.newest_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "mode": mode,
            "since": since,
            "limit": limit,
        })
        if scope is not UNSET:
            field_dict["scope"] = scope
        if oldest_at is not UNSET:
            field_dict["oldest_at"] = oldest_at
        if newest_at is not UNSET:
            field_dict["newest_at"] = newest_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_scope_used import EmailRuleScopeUsed # noqa: PLC0415
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

        _scope = d.pop("scope", UNSET)
        scope: EmailRuleScopeUsed | Unset
        if isinstance(_scope,  Unset):
            scope = UNSET
        else:
            scope = EmailRuleScopeUsed.from_dict(_scope)




        def _parse_oldest_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                oldest_at_type_0 = datetime.datetime.fromisoformat(data)



                return oldest_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        oldest_at = _parse_oldest_at(d.pop("oldest_at", UNSET))


        def _parse_newest_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                newest_at_type_0 = datetime.datetime.fromisoformat(data)



                return newest_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        newest_at = _parse_newest_at(d.pop("newest_at", UNSET))


        test_email_rule_result_window = cls(
            mode=mode,
            since=since,
            limit=limit,
            scope=scope,
            oldest_at=oldest_at,
            newest_at=newest_at,
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
