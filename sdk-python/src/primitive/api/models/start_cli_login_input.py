from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.start_cli_login_input_metadata import StartCliLoginInputMetadata





T = TypeVar("T", bound="StartCliLoginInput")



@_attrs_define
class StartCliLoginInput:
    """ 
        Attributes:
            device_name (str | Unset): Human-readable device name shown during browser approval
            metadata (StartCliLoginInputMetadata | Unset): Optional client metadata stored with the login session
     """

    device_name: str | Unset = UNSET
    metadata: StartCliLoginInputMetadata | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.start_cli_login_input_metadata import StartCliLoginInputMetadata
        device_name = self.device_name

        metadata: dict[str, Any] | Unset = UNSET
        if not isinstance(self.metadata, Unset):
            metadata = self.metadata.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if device_name is not UNSET:
            field_dict["device_name"] = device_name
        if metadata is not UNSET:
            field_dict["metadata"] = metadata

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.start_cli_login_input_metadata import StartCliLoginInputMetadata
        d = dict(src_dict)
        device_name = d.pop("device_name", UNSET)

        _metadata = d.pop("metadata", UNSET)
        metadata: StartCliLoginInputMetadata | Unset
        if isinstance(_metadata,  Unset):
            metadata = UNSET
        else:
            metadata = StartCliLoginInputMetadata.from_dict(_metadata)




        start_cli_login_input = cls(
            device_name=device_name,
            metadata=metadata,
        )

        return start_cli_login_input

