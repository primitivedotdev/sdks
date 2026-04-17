from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="TestResult")



@_attrs_define
class TestResult:
    """ 
        Attributes:
            status (int): HTTP status code returned by the endpoint
            body (str): Response body (truncated to 1000 characters)
            signature (str | Unset): The signature header value sent (if webhook secret is configured)
     """

    status: int
    body: str
    signature: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        status = self.status

        body = self.body

        signature = self.signature


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "status": status,
            "body": body,
        })
        if signature is not UNSET:
            field_dict["signature"] = signature

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        status = d.pop("status")

        body = d.pop("body")

        signature = d.pop("signature", UNSET)

        test_result = cls(
            status=status,
            body=body,
            signature=signature,
        )


        test_result.additional_properties = d
        return test_result

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
