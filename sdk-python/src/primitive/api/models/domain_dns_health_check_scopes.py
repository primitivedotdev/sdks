from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.domain_dns_health_scope import DomainDnsHealthScope





T = TypeVar("T", bound="DomainDnsHealthCheckScopes")



@_attrs_define
class DomainDnsHealthCheckScopes:
    """ 
        Attributes:
            ownership (DomainDnsHealthScope): Health of one DNS scope: `ownership` (verification TXT),
                `inbound` (MX), or `outbound` (SPF, DKIM, DMARC, TLS-RPT).
            inbound (DomainDnsHealthScope): Health of one DNS scope: `ownership` (verification TXT),
                `inbound` (MX), or `outbound` (SPF, DKIM, DMARC, TLS-RPT).
            outbound (DomainDnsHealthScope | Unset): Health of one DNS scope: `ownership` (verification TXT),
                `inbound` (MX), or `outbound` (SPF, DKIM, DMARC, TLS-RPT).
     """

    ownership: DomainDnsHealthScope
    inbound: DomainDnsHealthScope
    outbound: DomainDnsHealthScope | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.domain_dns_health_scope import DomainDnsHealthScope
        ownership = self.ownership.to_dict()

        inbound = self.inbound.to_dict()

        outbound: dict[str, Any] | Unset = UNSET
        if not isinstance(self.outbound, Unset):
            outbound = self.outbound.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "ownership": ownership,
            "inbound": inbound,
        })
        if outbound is not UNSET:
            field_dict["outbound"] = outbound

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.domain_dns_health_scope import DomainDnsHealthScope
        d = dict(src_dict)
        ownership = DomainDnsHealthScope.from_dict(d.pop("ownership"))




        inbound = DomainDnsHealthScope.from_dict(d.pop("inbound"))




        _outbound = d.pop("outbound", UNSET)
        outbound: DomainDnsHealthScope | Unset
        if isinstance(_outbound,  Unset):
            outbound = UNSET
        else:
            outbound = DomainDnsHealthScope.from_dict(_outbound)




        domain_dns_health_check_scopes = cls(
            ownership=ownership,
            inbound=inbound,
            outbound=outbound,
        )


        domain_dns_health_check_scopes.additional_properties = d
        return domain_dns_health_check_scopes

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
