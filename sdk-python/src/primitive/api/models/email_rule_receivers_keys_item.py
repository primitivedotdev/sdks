from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_receivers_keys_item_owner import EmailRuleReceiversKeysItemOwner





T = TypeVar("T", bound="EmailRuleReceiversKeysItem")



@_attrs_define
class EmailRuleReceiversKeysItem:
    """ 
        Attributes:
            owner (EmailRuleReceiversKeysItemOwner):
            count (int):
            reads_in_full (int | Unset): On a rule over your mail: how many of these keys also list one of your own
                mailboxes, or its domain, so they read your mail there beyond what this rule matches.
     """

    owner: EmailRuleReceiversKeysItemOwner
    count: int
    reads_in_full: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_receivers_keys_item_owner import EmailRuleReceiversKeysItemOwner # noqa: PLC0415
        owner = self.owner.to_dict()

        count = self.count

        reads_in_full = self.reads_in_full


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "owner": owner,
            "count": count,
        })
        if reads_in_full is not UNSET:
            field_dict["reads_in_full"] = reads_in_full

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_receivers_keys_item_owner import EmailRuleReceiversKeysItemOwner # noqa: PLC0415
        d = dict(src_dict)
        owner = EmailRuleReceiversKeysItemOwner.from_dict(d.pop("owner"))




        count = d.pop("count")

        reads_in_full = d.pop("reads_in_full", UNSET)

        email_rule_receivers_keys_item = cls(
            owner=owner,
            count=count,
            reads_in_full=reads_in_full,
        )


        email_rule_receivers_keys_item.additional_properties = d
        return email_rule_receivers_keys_item

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
