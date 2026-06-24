from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="RegistryRequest")



@_attrs_define
class RegistryRequest:
    """ A pending publication request, as the registry owner sees it.

        Attributes:
            id (UUID):
            address (str):
            display_name (str):
            handle (None | str):
            requested_at (datetime.datetime):
     """

    id: UUID
    address: str
    display_name: str
    handle: None | str
    requested_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        address = self.address

        display_name = self.display_name

        handle: None | str
        handle = self.handle

        requested_at = self.requested_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "address": address,
            "display_name": display_name,
            "handle": handle,
            "requested_at": requested_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        address = d.pop("address")

        display_name = d.pop("display_name")

        def _parse_handle(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        handle = _parse_handle(d.pop("handle"))


        requested_at = isoparse(d.pop("requested_at"))




        registry_request = cls(
            id=id,
            address=address,
            display_name=display_name,
            handle=handle,
            requested_at=requested_at,
        )


        registry_request.additional_properties = d
        return registry_request

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
