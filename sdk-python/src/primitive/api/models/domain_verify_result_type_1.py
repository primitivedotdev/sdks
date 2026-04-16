from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="DomainVerifyResultType1")



@_attrs_define
class DomainVerifyResultType1:
    """ 
        Attributes:
            verified (bool):
            mx_found (bool): Whether MX records point to Primitive
            txt_found (bool): Whether the TXT verification record was found
            error (str): Human-readable verification failure reason
     """

    verified: bool
    mx_found: bool
    txt_found: bool
    error: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        verified = self.verified

        mx_found = self.mx_found

        txt_found = self.txt_found

        error = self.error


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "verified": verified,
            "mxFound": mx_found,
            "txtFound": txt_found,
            "error": error,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        verified = d.pop("verified")

        mx_found = d.pop("mxFound")

        txt_found = d.pop("txtFound")

        error = d.pop("error")

        domain_verify_result_type_1 = cls(
            verified=verified,
            mx_found=mx_found,
            txt_found=txt_found,
            error=error,
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
