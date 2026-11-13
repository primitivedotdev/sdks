from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_receivers_shares_item_beneficiary import EmailRuleReceiversSharesItemBeneficiary





T = TypeVar("T", bound="EmailRuleReceiversSharesItem")



@_attrs_define
class EmailRuleReceiversSharesItem:
    """ 
        Attributes:
            beneficiary (EmailRuleReceiversSharesItemBeneficiary):
            count (int):
            newest_at (datetime.datetime | Unset): When the newest of these was made, to the minute: a key, a webhook or the
                share, or the rule (the share, for what reaches it only through the share) if that was later. Not when a key was
                given access to this rule, or anything turned back on; a rotated key shows as newly made, and one key on two
                rules can show the same minute under both.
     """

    beneficiary: EmailRuleReceiversSharesItemBeneficiary
    count: int
    newest_at: datetime.datetime | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_receivers_shares_item_beneficiary import EmailRuleReceiversSharesItemBeneficiary # noqa: PLC0415
        beneficiary = self.beneficiary.to_dict()

        count = self.count

        newest_at: str | Unset = UNSET
        if not isinstance(self.newest_at, Unset):
            newest_at = self.newest_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "beneficiary": beneficiary,
            "count": count,
        })
        if newest_at is not UNSET:
            field_dict["newest_at"] = newest_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_receivers_shares_item_beneficiary import EmailRuleReceiversSharesItemBeneficiary # noqa: PLC0415
        d = dict(src_dict)
        beneficiary = EmailRuleReceiversSharesItemBeneficiary.from_dict(d.pop("beneficiary"))




        count = d.pop("count")

        _newest_at = d.pop("newest_at", UNSET)
        newest_at: datetime.datetime | Unset
        if isinstance(_newest_at,  Unset):
            newest_at = UNSET
        else:
            newest_at = datetime.datetime.fromisoformat(_newest_at)




        email_rule_receivers_shares_item = cls(
            beneficiary=beneficiary,
            count=count,
            newest_at=newest_at,
        )


        email_rule_receivers_shares_item.additional_properties = d
        return email_rule_receivers_shares_item

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
