from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.endpoint_receiver_capabilities_completion_modes_item import EndpointReceiverCapabilitiesCompletionModesItem
from ..models.endpoint_receiver_capabilities_stream_protocols_item import EndpointReceiverCapabilitiesStreamProtocolsItem
from typing import cast






T = TypeVar("T", bound="EndpointReceiverCapabilities")



@_attrs_define
class EndpointReceiverCapabilities:
    """ 
        Attributes:
            completion_modes (list[EndpointReceiverCapabilitiesCompletionModesItem]):
            stream_protocols (list[EndpointReceiverCapabilitiesStreamProtocolsItem]):
     """

    completion_modes: list[EndpointReceiverCapabilitiesCompletionModesItem]
    stream_protocols: list[EndpointReceiverCapabilitiesStreamProtocolsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        completion_modes = []
        for completion_modes_item_data in self.completion_modes:
            completion_modes_item = completion_modes_item_data.value
            completion_modes.append(completion_modes_item)



        stream_protocols = []
        for stream_protocols_item_data in self.stream_protocols:
            stream_protocols_item = stream_protocols_item_data.value
            stream_protocols.append(stream_protocols_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "completion_modes": completion_modes,
            "stream_protocols": stream_protocols,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        completion_modes = []
        _completion_modes = d.pop("completion_modes")
        for completion_modes_item_data in (_completion_modes):
            completion_modes_item = EndpointReceiverCapabilitiesCompletionModesItem(completion_modes_item_data)



            completion_modes.append(completion_modes_item)


        stream_protocols = []
        _stream_protocols = d.pop("stream_protocols")
        for stream_protocols_item_data in (_stream_protocols):
            stream_protocols_item = EndpointReceiverCapabilitiesStreamProtocolsItem(stream_protocols_item_data)



            stream_protocols.append(stream_protocols_item)


        endpoint_receiver_capabilities = cls(
            completion_modes=completion_modes,
            stream_protocols=stream_protocols,
        )


        endpoint_receiver_capabilities.additional_properties = d
        return endpoint_receiver_capabilities

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
