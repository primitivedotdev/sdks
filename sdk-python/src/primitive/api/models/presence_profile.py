from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast






T = TypeVar("T", bound="PresenceProfile")



@_attrs_define
class PresenceProfile:
    """
        Attributes:
            protocol (Literal['primitive.presence']):
            version (Literal[1]):
            authentication_profile (Literal['primitive-issued-v1']):
            return_address (str):
     """

    protocol: Literal['primitive.presence']
    version: Literal[1]
    authentication_profile: Literal['primitive-issued-v1']
    return_address: str





    def to_dict(self) -> dict[str, Any]:
        protocol = self.protocol

        version = self.version

        authentication_profile = self.authentication_profile

        return_address = self.return_address


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "protocol": protocol,
            "version": version,
            "authentication_profile": authentication_profile,
            "return_address": return_address,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        protocol = cast(Literal['primitive.presence'] , d.pop("protocol"))
        if protocol != 'primitive.presence':
            raise ValueError(f"protocol must match const 'primitive.presence', got '{protocol}'")

        version = cast(Literal[1] , d.pop("version"))
        if version != 1:
            raise ValueError(f"version must match const 1, got '{version}'")

        authentication_profile = cast(Literal['primitive-issued-v1'] , d.pop("authentication_profile"))
        if authentication_profile != 'primitive-issued-v1':
            raise ValueError(f"authentication_profile must match const 'primitive-issued-v1', got '{authentication_profile}'")

        return_address = d.pop("return_address")

        presence_profile = cls(
            protocol=protocol,
            version=version,
            authentication_profile=authentication_profile,
            return_address=return_address,
        )

        return presence_profile
