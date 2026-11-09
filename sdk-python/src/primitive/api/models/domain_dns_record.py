from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.domain_dns_record_purpose import DomainDnsRecordPurpose
from ..models.domain_dns_record_status import DomainDnsRecordStatus
from ..models.domain_dns_record_type import DomainDnsRecordType






T = TypeVar("T", bound="DomainDnsRecord")



@_attrs_define
class DomainDnsRecord:
    """ 
        Attributes:
            type_ (DomainDnsRecordType): DNS record type.
            name (str): DNS-provider host/name value relative to the managed root zone.
            fqdn (str): Fully-qualified DNS record name.
            value (str): Exact value to publish.
            required (bool):
            purpose (DomainDnsRecordPurpose):
            status (DomainDnsRecordStatus): `legacy` means the MX routes mail to Primitive through a legacy host: mail is
                delivered and the domain stays healthy, but the record should be updated to `value`. `unresolved` means the DNS
                lookup itself was inconclusive.
            priority (int | Unset): MX priority. Present only for MX records.
            ttl (int | Unset): Suggested TTL in seconds when the API can provide one.
            message (str | Unset): Short explanation of why this record is needed.
     """

    type_: DomainDnsRecordType
    name: str
    fqdn: str
    value: str
    required: bool
    purpose: DomainDnsRecordPurpose
    status: DomainDnsRecordStatus
    priority: int | Unset = UNSET
    ttl: int | Unset = UNSET
    message: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        name = self.name

        fqdn = self.fqdn

        value = self.value

        required = self.required

        purpose = self.purpose.value

        status = self.status.value

        priority = self.priority

        ttl = self.ttl

        message = self.message


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "name": name,
            "fqdn": fqdn,
            "value": value,
            "required": required,
            "purpose": purpose,
            "status": status,
        })
        if priority is not UNSET:
            field_dict["priority"] = priority
        if ttl is not UNSET:
            field_dict["ttl"] = ttl
        if message is not UNSET:
            field_dict["message"] = message

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = DomainDnsRecordType(d.pop("type"))




        name = d.pop("name")

        fqdn = d.pop("fqdn")

        value = d.pop("value")

        required = d.pop("required")

        purpose = DomainDnsRecordPurpose(d.pop("purpose"))




        status = DomainDnsRecordStatus(d.pop("status"))




        priority = d.pop("priority", UNSET)

        ttl = d.pop("ttl", UNSET)

        message = d.pop("message", UNSET)

        domain_dns_record = cls(
            type_=type_,
            name=name,
            fqdn=fqdn,
            value=value,
            required=required,
            purpose=purpose,
            status=status,
            priority=priority,
            ttl=ttl,
            message=message,
        )


        domain_dns_record.additional_properties = d
        return domain_dns_record

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
