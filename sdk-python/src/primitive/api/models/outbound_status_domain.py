from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.outbound_status_domain_status import OutboundStatusDomainStatus
from uuid import UUID






T = TypeVar("T", bound="OutboundStatusDomain")



@_attrs_define
class OutboundStatusDomain:
    """ Per-domain outbound (sending) readiness.

        Attributes:
            id (UUID):
            domain (str):
            status (OutboundStatusDomainStatus): Single actionable state collapsing the sending
                prerequisites: `sendable` (you may send From this domain
                now), `pending_ownership` (ownership TXT not verified),
                `pending_outbound_dns` (ownership done, SPF/DKIM/DMARC
                not verified), or `inactive` (domain deactivated;
                re-adding it, not publishing DNS, is the fix).
            ownership_verified (bool):
            outbound_verified (bool): Whether the domain has an active outbound key with verified outbound DNS.
     """

    id: UUID
    domain: str
    status: OutboundStatusDomainStatus
    ownership_verified: bool
    outbound_verified: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        domain = self.domain

        status = self.status.value

        ownership_verified = self.ownership_verified

        outbound_verified = self.outbound_verified


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "domain": domain,
            "status": status,
            "ownership_verified": ownership_verified,
            "outbound_verified": outbound_verified,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        domain = d.pop("domain")

        status = OutboundStatusDomainStatus(d.pop("status"))




        ownership_verified = d.pop("ownership_verified")

        outbound_verified = d.pop("outbound_verified")

        outbound_status_domain = cls(
            id=id,
            domain=domain,
            status=status,
            ownership_verified=ownership_verified,
            outbound_verified=outbound_verified,
        )


        outbound_status_domain.additional_properties = d
        return outbound_status_domain

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
