from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="AddDomainInput")



@_attrs_define
class AddDomainInput:
    """ 
        Attributes:
            domain (str): The domain name to claim (e.g. "example.com")
            confirmed (bool | Unset): Set to true to confirm replacing an existing mailbox provider after an mx_conflict
                response.
            outbound (bool | Unset): Deprecated and ignored. Outbound DNS is provisioned for every new domain claim.
     """

    domain: str
    confirmed: bool | Unset = UNSET
    outbound: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        domain = self.domain

        confirmed = self.confirmed

        outbound = self.outbound


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "domain": domain,
        })
        if confirmed is not UNSET:
            field_dict["confirmed"] = confirmed
        if outbound is not UNSET:
            field_dict["outbound"] = outbound

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        domain = d.pop("domain")

        confirmed = d.pop("confirmed", UNSET)

        outbound = d.pop("outbound", UNSET)

        add_domain_input = cls(
            domain=domain,
            confirmed=confirmed,
            outbound=outbound,
        )

        return add_domain_input

