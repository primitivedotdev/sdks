from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ClaimVanityInboxNameResult")



@_attrs_define
class ClaimVanityInboxNameResult:
    """ 
        Attributes:
            subdomain (str):
            domain (str):
            outbound_ready (bool):
     """

    subdomain: str
    domain: str
    outbound_ready: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        subdomain = self.subdomain

        domain = self.domain

        outbound_ready = self.outbound_ready


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "subdomain": subdomain,
            "domain": domain,
            "outbound_ready": outbound_ready,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        subdomain = d.pop("subdomain")

        domain = d.pop("domain")

        outbound_ready = d.pop("outbound_ready")

        claim_vanity_inbox_name_result = cls(
            subdomain=subdomain,
            domain=domain,
            outbound_ready=outbound_ready,
        )


        claim_vanity_inbox_name_result.additional_properties = d
        return claim_vanity_inbox_name_result

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
