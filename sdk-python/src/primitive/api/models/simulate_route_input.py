from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="SimulateRouteInput")



@_attrs_define
class SimulateRouteInput:
    """ 
        Attributes:
            recipient (str): The recipient address to resolve.
            event_type (str | Unset): Which event type to model. Defaults to email.received.
     """

    recipient: str
    event_type: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        recipient = self.recipient

        event_type = self.event_type


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "recipient": recipient,
        })
        if event_type is not UNSET:
            field_dict["event_type"] = event_type

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        recipient = d.pop("recipient")

        event_type = d.pop("event_type", UNSET)

        simulate_route_input = cls(
            recipient=recipient,
            event_type=event_type,
        )

        return simulate_route_input

