from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="PublicAddressNote")



@_attrs_define
class PublicAddressNote:
    """ 
        Attributes:
            address (str): Bare email address, normalized to lowercase. Plus tags are preserved.
            name (str): Case-sensitive note name. AGENT_INFO, AGENT_USES and AGENT_RUNTIME (where the agent runs, e.g. its
                runtime, machine and working directory) are conventions, with no required value schema.
            value (Any): Any JSON value. Both UTF-8 serialized JSON and stored JSONB text must fit within 65536 bytes.
            updated_at (datetime.datetime):
     """

    address: str
    name: str
    value: Any
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        address = self.address

        name = self.name

        value = self.value

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "address": address,
            "name": name,
            "value": value,
            "updated_at": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        address = d.pop("address")

        name = d.pop("name")

        value = d.pop("value")

        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))




        public_address_note = cls(
            address=address,
            name=name,
            value=value,
            updated_at=updated_at,
        )


        public_address_note.additional_properties = d
        return public_address_note

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
