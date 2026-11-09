from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_own_grant_response_200_data_grant_type_0_send_scope_type_1_depth import GetOwnGrantResponse200DataGrantType0SendScopeType1Depth
from ..models.get_own_grant_response_200_data_grant_type_0_send_scope_type_1_direction import GetOwnGrantResponse200DataGrantType0SendScopeType1Direction
from typing import cast






T = TypeVar("T", bound="GetOwnGrantResponse200DataGrantType0SendScopeType1")



@_attrs_define
class GetOwnGrantResponse200DataGrantType0SendScopeType1:
    """ 
        Attributes:
            addresses (list[str]):
            domains (list[str]):
            depth (GetOwnGrantResponse200DataGrantType0SendScopeType1Depth): Deprecated: raw for every scope that reaches
                mail, which reads the full email; raw MIME follows mail.raw:read. Metadata only for a scope that reaches no
                mail.
            direction (GetOwnGrantResponse200DataGrantType0SendScopeType1Direction | Unset):
            excluded_personal_mailboxes (int | Unset):
     """

    addresses: list[str]
    domains: list[str]
    depth: GetOwnGrantResponse200DataGrantType0SendScopeType1Depth
    direction: GetOwnGrantResponse200DataGrantType0SendScopeType1Direction | Unset = UNSET
    excluded_personal_mailboxes: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        addresses = self.addresses



        domains = self.domains



        depth = self.depth.value

        direction: str | Unset = UNSET
        if not isinstance(self.direction, Unset):
            direction = self.direction.value


        excluded_personal_mailboxes = self.excluded_personal_mailboxes


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "addresses": addresses,
            "domains": domains,
            "depth": depth,
        })
        if direction is not UNSET:
            field_dict["direction"] = direction
        if excluded_personal_mailboxes is not UNSET:
            field_dict["excluded_personal_mailboxes"] = excluded_personal_mailboxes

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        addresses = cast(list[str], d.pop("addresses"))


        domains = cast(list[str], d.pop("domains"))


        depth = GetOwnGrantResponse200DataGrantType0SendScopeType1Depth(d.pop("depth"))




        _direction = d.pop("direction", UNSET)
        direction: GetOwnGrantResponse200DataGrantType0SendScopeType1Direction | Unset
        if isinstance(_direction,  Unset):
            direction = UNSET
        else:
            direction = GetOwnGrantResponse200DataGrantType0SendScopeType1Direction(_direction)




        excluded_personal_mailboxes = d.pop("excluded_personal_mailboxes", UNSET)

        get_own_grant_response_200_data_grant_type_0_send_scope_type_1 = cls(
            addresses=addresses,
            domains=domains,
            depth=depth,
            direction=direction,
            excluded_personal_mailboxes=excluded_personal_mailboxes,
        )


        get_own_grant_response_200_data_grant_type_0_send_scope_type_1.additional_properties = d
        return get_own_grant_response_200_data_grant_type_0_send_scope_type_1

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
