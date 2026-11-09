from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="StartInteractionResult")



@_attrs_define
class StartInteractionResult:
    """ 
        Attributes:
            interaction_id (None | UUID):
            wire_id (str):
            step_id (str):
            send_id (None | str):
            events (list[str]):
     """

    interaction_id: None | UUID
    wire_id: str
    step_id: str
    send_id: None | str
    events: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        interaction_id: None | str
        if isinstance(self.interaction_id, UUID):
            interaction_id = str(self.interaction_id)
        else:
            interaction_id = self.interaction_id

        wire_id = self.wire_id

        step_id = self.step_id

        send_id: None | str
        send_id = self.send_id

        events = self.events




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "interaction_id": interaction_id,
            "wire_id": wire_id,
            "step_id": step_id,
            "send_id": send_id,
            "events": events,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_interaction_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                interaction_id_type_0 = UUID(data)



                return interaction_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        interaction_id = _parse_interaction_id(d.pop("interaction_id"))


        wire_id = d.pop("wire_id")

        step_id = d.pop("step_id")

        def _parse_send_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        send_id = _parse_send_id(d.pop("send_id"))


        events = cast(list[str], d.pop("events"))


        start_interaction_result = cls(
            interaction_id=interaction_id,
            wire_id=wire_id,
            step_id=step_id,
            send_id=send_id,
            events=events,
        )


        start_interaction_result.additional_properties = d
        return start_interaction_result

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
