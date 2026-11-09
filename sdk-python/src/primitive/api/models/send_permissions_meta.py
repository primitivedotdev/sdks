from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="SendPermissionsMeta")



@_attrs_define
class SendPermissionsMeta:
    """ Response metadata for /send-permissions. The `address_cap`
    bounds the size of the `address` rule subset; orgs with more
    than `address_cap` known addresses almost always also hold a
    broader rule type (`any_recipient` or `your_domain`), so the
    cap is a response-size bound rather than a meaningful
    product limit.

        Attributes:
            address_cap (int): Maximum number of `address` rules included in `data`.
            truncated (bool): True when the org has more than `address_cap` known
                addresses and the list was truncated. False when every
                known address is represented or when the org holds no
                address rules at all.
            replies_only (bool | Unset): Present and true when this credential can only reply to mail it received (it holds
                mail:reply but not mail:send). The rules in `data` then apply to its replies; it cannot start a new message.
     """

    address_cap: int
    truncated: bool
    replies_only: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        address_cap = self.address_cap

        truncated = self.truncated

        replies_only = self.replies_only


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "address_cap": address_cap,
            "truncated": truncated,
        })
        if replies_only is not UNSET:
            field_dict["replies_only"] = replies_only

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        address_cap = d.pop("address_cap")

        truncated = d.pop("truncated")

        replies_only = d.pop("replies_only", UNSET)

        send_permissions_meta = cls(
            address_cap=address_cap,
            truncated=truncated,
            replies_only=replies_only,
        )


        send_permissions_meta.additional_properties = d
        return send_permissions_meta

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
