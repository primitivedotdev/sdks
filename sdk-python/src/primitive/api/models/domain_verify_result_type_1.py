from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.domain_dns_record import DomainDnsRecord





T = TypeVar("T", bound="DomainVerifyResultType1")



@_attrs_define
class DomainVerifyResultType1:
    """ 
        Attributes:
            verified (bool):
            mx_found (bool): Whether MX records point to Primitive
            txt_found (bool): Whether the TXT verification record was found
            error (str): Human-readable verification failure reason
            spf_found (bool | Unset): Whether the SPF record includes Primitive.
            dkim_found (bool | Unset): Whether the DKIM public key record was found.
            dmarc_found (bool | Unset): Whether the DMARC record was found.
            tls_rpt_found (bool | Unset): Whether the TLS-RPT record was found.
            dns_records (list[DomainDnsRecord] | Unset): Exact DNS records checked for this verification attempt.
     """

    verified: bool
    mx_found: bool
    txt_found: bool
    error: str
    spf_found: bool | Unset = UNSET
    dkim_found: bool | Unset = UNSET
    dmarc_found: bool | Unset = UNSET
    tls_rpt_found: bool | Unset = UNSET
    dns_records: list[DomainDnsRecord] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.domain_dns_record import DomainDnsRecord
        verified = self.verified

        mx_found = self.mx_found

        txt_found = self.txt_found

        error = self.error

        spf_found = self.spf_found

        dkim_found = self.dkim_found

        dmarc_found = self.dmarc_found

        tls_rpt_found = self.tls_rpt_found

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
            "mxFound": mx_found,
            "txtFound": txt_found,
            "error": error,
        })
        if spf_found is not UNSET:
            field_dict["spfFound"] = spf_found
        if dkim_found is not UNSET:
            field_dict["dkimFound"] = dkim_found
        if dmarc_found is not UNSET:
            field_dict["dmarcFound"] = dmarc_found
        if tls_rpt_found is not UNSET:
            field_dict["tlsRptFound"] = tls_rpt_found
        if dns_records is not UNSET:
            field_dict["dns_records"] = dns_records

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.domain_dns_record import DomainDnsRecord
        d = dict(src_dict)
        verified = d.pop("verified")

        mx_found = d.pop("mxFound")

        txt_found = d.pop("txtFound")

        error = d.pop("error")

        spf_found = d.pop("spfFound", UNSET)

        dkim_found = d.pop("dkimFound", UNSET)

        dmarc_found = d.pop("dmarcFound", UNSET)

        tls_rpt_found = d.pop("tlsRptFound", UNSET)

        _dns_records = d.pop("dns_records", UNSET)
        dns_records: list[DomainDnsRecord] | Unset = UNSET
        if _dns_records is not UNSET:
            dns_records = []
            for dns_records_item_data in _dns_records:
                dns_records_item = DomainDnsRecord.from_dict(dns_records_item_data)



                dns_records.append(dns_records_item)


        domain_verify_result_type_1 = cls(
            verified=verified,
            mx_found=mx_found,
            txt_found=txt_found,
            error=error,
            spf_found=spf_found,
            dkim_found=dkim_found,
            dmarc_found=dmarc_found,
            tls_rpt_found=tls_rpt_found,
            dns_records=dns_records,
        )


        domain_verify_result_type_1.additional_properties = d
        return domain_verify_result_type_1

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
