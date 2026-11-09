from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_role_request_mail_scope_type_1_depth import UpdateRoleRequestMailScopeType1Depth
from typing import cast






T = TypeVar("T", bound="UpdateRoleRequestMailScopeType1")



@_attrs_define
class UpdateRoleRequestMailScopeType1:
    """ 
        Attributes:
            addresses (list[str] | Unset):
            domains (list[str] | Unset):
            depth (UpdateRoleRequestMailScopeType1Depth | Unset): Deprecated and ignored: every scope that reaches mail
                reads the full email, and raw MIME follows mail.raw:read.
            self_ (bool | Unset):
     """

    addresses: list[str] | Unset = UNSET
    domains: list[str] | Unset = UNSET
    depth: UpdateRoleRequestMailScopeType1Depth | Unset = UNSET
    self_: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        addresses: list[str] | Unset = UNSET
        if not isinstance(self.addresses, Unset):
            addresses = self.addresses



        domains: list[str] | Unset = UNSET
        if not isinstance(self.domains, Unset):
            domains = self.domains



        depth: str | Unset = UNSET
        if not isinstance(self.depth, Unset):
            depth = self.depth.value


        self_ = self.self_


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if addresses is not UNSET:
            field_dict["addresses"] = addresses
        if domains is not UNSET:
            field_dict["domains"] = domains
        if depth is not UNSET:
            field_dict["depth"] = depth
        if self_ is not UNSET:
            field_dict["self"] = self_

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        addresses = cast(list[str], d.pop("addresses", UNSET))


        domains = cast(list[str], d.pop("domains", UNSET))


        _depth = d.pop("depth", UNSET)
        depth: UpdateRoleRequestMailScopeType1Depth | Unset
        if isinstance(_depth,  Unset):
            depth = UNSET
        else:
            depth = UpdateRoleRequestMailScopeType1Depth(_depth)




        self_ = d.pop("self", UNSET)

        update_role_request_mail_scope_type_1 = cls(
            addresses=addresses,
            domains=domains,
            depth=depth,
            self_=self_,
        )


        update_role_request_mail_scope_type_1.additional_properties = d
        return update_role_request_mail_scope_type_1

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
