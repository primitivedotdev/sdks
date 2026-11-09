from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="UnverifiedDomainDkim")



@_attrs_define
class UnverifiedDomainDkim:
    """ The DKIM key to publish for this domain, once it is ready. Absent while the key is still being prepared.

        Attributes:
            selector (str): The DKIM selector.
            dns_record_value (str): The DKIM public key TXT record value.
            cname_namespace (str | Unset): Present when the key is published through delegated CNAME records rather than a
                TXT record at the selector.
     """

    selector: str
    dns_record_value: str
    cname_namespace: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        selector = self.selector

        dns_record_value = self.dns_record_value

        cname_namespace = self.cname_namespace


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "selector": selector,
            "dnsRecordValue": dns_record_value,
        })
        if cname_namespace is not UNSET:
            field_dict["cnameNamespace"] = cname_namespace

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        selector = d.pop("selector")

        dns_record_value = d.pop("dnsRecordValue")

        cname_namespace = d.pop("cnameNamespace", UNSET)

        unverified_domain_dkim = cls(
            selector=selector,
            dns_record_value=dns_record_value,
            cname_namespace=cname_namespace,
        )


        unverified_domain_dkim.additional_properties = d
        return unverified_domain_dkim

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
