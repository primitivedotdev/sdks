from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ProvisionMemberAddressBody")



@_attrs_define
class ProvisionMemberAddressBody:
    """ 
        Attributes:
            address (str):
            confirm_existing_mail (bool | Unset):
     """

    address: str
    confirm_existing_mail: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        address = self.address

        confirm_existing_mail = self.confirm_existing_mail


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "address": address,
        })
        if confirm_existing_mail is not UNSET:
            field_dict["confirm_existing_mail"] = confirm_existing_mail

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        address = d.pop("address")

        confirm_existing_mail = d.pop("confirm_existing_mail", UNSET)

        provision_member_address_body = cls(
            address=address,
            confirm_existing_mail=confirm_existing_mail,
        )

        return provision_member_address_body

