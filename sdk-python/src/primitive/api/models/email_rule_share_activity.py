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
            rule_active (bool): Whether the rule is active now: only an active rule shares.
            last_decided_at (datetime.datetime | None): The start of the hour in which the rule last decided on any email in
                the sharing member's mailboxes since the share began, counting only hours that have ended and the hour of the
                newest email shared; null if none, or not read.
            shared_emails (int | None): Emails this share has shared, counted up to 10,000; null when these could not be
                read.
            last_shared_at (datetime.datetime | None): When it last shared one; null if it has not, or not read.
            shared_emails_more (bool | Unset): Present when it has shared more than 10,000.
     """

    rule_active: bool
    last_decided_at: datetime.datetime | None
    shared_emails: int | None
    last_shared_at: datetime.datetime | None
    shared_emails_more: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        rule_active = self.rule_active

        last_decided_at: None | str
        if isinstance(self.last_decided_at, datetime.datetime):
            last_decided_at = self.last_decided_at.isoformat()
        else:
            last_decided_at = self.last_decided_at

        shared_emails: int | None
        shared_emails = self.shared_emails

        last_shared_at: None | str
        if isinstance(self.last_shared_at, datetime.datetime):
            last_shared_at = self.last_shared_at.isoformat()
        else:
            last_shared_at = self.last_shared_at

        shared_emails_more = self.shared_emails_more


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "rule_active": rule_active,
            "last_decided_at": last_decided_at,
            "shared_emails": shared_emails,
            "last_shared_at": last_shared_at,
        })
        if shared_emails_more is not UNSET:
            field_dict["shared_emails_more"] = shared_emails_more

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        rule_active = d.pop("rule_active")

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


        def _parse_shared_emails(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        shared_emails = _parse_shared_emails(d.pop("shared_emails"))


        def _parse_last_shared_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_shared_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_shared_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_shared_at = _parse_last_shared_at(d.pop("last_shared_at"))


        shared_emails_more = d.pop("shared_emails_more", UNSET)

        email_rule_share_activity = cls(
            rule_active=rule_active,
            last_decided_at=last_decided_at,
            shared_emails=shared_emails,
            last_shared_at=last_shared_at,
            shared_emails_more=shared_emails_more,
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
