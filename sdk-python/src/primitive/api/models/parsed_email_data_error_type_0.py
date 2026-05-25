from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ParsedEmailDataErrorType0")



@_attrs_define
class ParsedEmailDataErrorType0:
    """ Present (non-null) only when `status` is `failed`. When
    present, all three fields are populated, so a consumer can
    branch on `code` without defensive null checks.

        Attributes:
            code (str): Stable failure code (e.g. `PARSE_FAILED`).
            message (str):
            retryable (bool):
     """

    code: str
    message: str
    retryable: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        code = self.code

        message = self.message

        retryable = self.retryable


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "code": code,
            "message": message,
            "retryable": retryable,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        code = d.pop("code")

        message = d.pop("message")

        retryable = d.pop("retryable")

        parsed_email_data_error_type_0 = cls(
            code=code,
            message=message,
            retryable=retryable,
        )


        parsed_email_data_error_type_0.additional_properties = d
        return parsed_email_data_error_type_0

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
