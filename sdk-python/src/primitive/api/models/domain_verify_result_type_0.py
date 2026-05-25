from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.domain_dns_record import DomainDnsRecord





T = TypeVar("T", bound="DomainVerifyResultType0")



@_attrs_define
class DomainVerifyResultType0:
    """ 
        Attributes:
            verified (bool):
            dns_records (list[DomainDnsRecord] | Unset): Exact DNS records checked for this verification attempt.
     """

    verified: bool
    dns_records: list[DomainDnsRecord] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.domain_dns_record import DomainDnsRecord
        verified = self.verified

        dns_records: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.dns_records, Unset):
            dns_records = []
            for dns_records_item_data in self.dns_records:
                dns_records_item = dns_records_item_data.to_dict()
                dns_records.append(dns_records_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "verified": verified,
        })
        if dns_records is not UNSET:
            field_dict["dns_records"] = dns_records

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.domain_dns_record import DomainDnsRecord
        d = dict(src_dict)
        verified = d.pop("verified")

        _dns_records = d.pop("dns_records", UNSET)
        dns_records: list[DomainDnsRecord] | Unset = UNSET
        if _dns_records is not UNSET:
            dns_records = []
            for dns_records_item_data in _dns_records:
                dns_records_item = DomainDnsRecord.from_dict(dns_records_item_data)



                dns_records.append(dns_records_item)


        domain_verify_result_type_0 = cls(
            verified=verified,
            dns_records=dns_records,
        )


        domain_verify_result_type_0.additional_properties = d
        return domain_verify_result_type_0

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
