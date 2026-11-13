from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.delete_email_rule_result_keys_item import DeleteEmailRuleResultKeysItem





T = TypeVar("T", bound="DeleteEmailRuleResult")



@_attrs_define
class DeleteEmailRuleResult:
    """ 
        Attributes:
            deleted (bool):
            ended_shares (list[UUID] | Unset): The shares of this rule that the delete ended (end_reason rule_deleted). Each
                keeps its record.
            keys (list[DeleteEmailRuleResultKeysItem] | Unset): The API keys, not revoked, that still list the rule and that
                you may read (GET /v1/keys). They now read nothing through it; edit or revoke them. Left out, with other_keys,
                when the keys could not be read.
            other_keys (int | Unset): How many more keys, not revoked, list the rule that you may not read. They are not
                named.
            share_notice (str | Unset): When the delete ended a share: that it did, with whom it was with and the version
                they accepted when those can be read.
     """

    deleted: bool
    ended_shares: list[UUID] | Unset = UNSET
    keys: list[DeleteEmailRuleResultKeysItem] | Unset = UNSET
    other_keys: int | Unset = UNSET
    share_notice: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.delete_email_rule_result_keys_item import DeleteEmailRuleResultKeysItem # noqa: PLC0415
        deleted = self.deleted

        ended_shares: list[str] | Unset = UNSET
        if not isinstance(self.ended_shares, Unset):
            ended_shares = []
            for ended_shares_item_data in self.ended_shares:
                ended_shares_item = str(ended_shares_item_data)
                ended_shares.append(ended_shares_item)



        keys: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.keys, Unset):
            keys = []
            for keys_item_data in self.keys:
                keys_item = keys_item_data.to_dict()
                keys.append(keys_item)



        other_keys = self.other_keys

        share_notice = self.share_notice


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "deleted": deleted,
        })
        if ended_shares is not UNSET:
            field_dict["ended_shares"] = ended_shares
        if keys is not UNSET:
            field_dict["keys"] = keys
        if other_keys is not UNSET:
            field_dict["other_keys"] = other_keys
        if share_notice is not UNSET:
            field_dict["share_notice"] = share_notice

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.delete_email_rule_result_keys_item import DeleteEmailRuleResultKeysItem # noqa: PLC0415
        d = dict(src_dict)
        deleted = d.pop("deleted")

        _ended_shares = d.pop("ended_shares", UNSET)
        ended_shares: list[UUID] | Unset = UNSET
        if _ended_shares is not UNSET:
            ended_shares = []
            for ended_shares_item_data in _ended_shares:
                ended_shares_item = UUID(ended_shares_item_data)



                ended_shares.append(ended_shares_item)


        _keys = d.pop("keys", UNSET)
        keys: list[DeleteEmailRuleResultKeysItem] | Unset = UNSET
        if _keys is not UNSET:
            keys = []
            for keys_item_data in _keys:
                keys_item = DeleteEmailRuleResultKeysItem.from_dict(keys_item_data)



                keys.append(keys_item)


        other_keys = d.pop("other_keys", UNSET)

        share_notice = d.pop("share_notice", UNSET)

        delete_email_rule_result = cls(
            deleted=deleted,
            ended_shares=ended_shares,
            keys=keys,
            other_keys=other_keys,
            share_notice=share_notice,
        )


        delete_email_rule_result.additional_properties = d
        return delete_email_rule_result

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
