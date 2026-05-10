from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="CreateFunctionSecretInput")



@_attrs_define
class CreateFunctionSecretInput:
    """ Body for POST /functions/{id}/secrets.

        Attributes:
            key (str): Uppercase letters, digits, and underscores. Must start with
                a letter or underscore. System-managed keys (e.g.
                PRIMITIVE_WEBHOOK_SECRET) are reserved.
            value (str): Secret value, up to 4096 UTF-8 bytes. Encrypted at rest.
                Never returned by any read endpoint.
     """

    key: str
    value: str





    def to_dict(self) -> dict[str, Any]:
        key = self.key

        value = self.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "value": value,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = d.pop("key")

        value = d.pop("value")

        create_function_secret_input = cls(
            key=key,
            value=value,
        )

        return create_function_secret_input

