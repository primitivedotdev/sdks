from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="GetInteractionResultStepsItem")



@_attrs_define
class GetInteractionResultStepsItem:
    """ 
        Attributes:
            id (UUID):
            wire_step_id (str):
            step (str):
            direction (str):
            accepted (bool):
            reject_reason (None | str):
            created_at (str):
            email_id (None | UUID):
            sent_email_id (None | UUID):
     """

    id: UUID
    wire_step_id: str
    step: str
    direction: str
    accepted: bool
    reject_reason: None | str
    created_at: str
    email_id: None | UUID
    sent_email_id: None | UUID
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        wire_step_id = self.wire_step_id

        step = self.step

        direction = self.direction

        accepted = self.accepted

        reject_reason: None | str
        reject_reason = self.reject_reason

        created_at = self.created_at

        email_id: None | str
        if isinstance(self.email_id, UUID):
            email_id = str(self.email_id)
        else:
            email_id = self.email_id

        sent_email_id: None | str
        if isinstance(self.sent_email_id, UUID):
            sent_email_id = str(self.sent_email_id)
        else:
            sent_email_id = self.sent_email_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "wire_step_id": wire_step_id,
            "step": step,
            "direction": direction,
            "accepted": accepted,
            "reject_reason": reject_reason,
            "created_at": created_at,
            "email_id": email_id,
            "sent_email_id": sent_email_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        wire_step_id = d.pop("wire_step_id")

        step = d.pop("step")

        direction = d.pop("direction")

        accepted = d.pop("accepted")

        def _parse_reject_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        reject_reason = _parse_reject_reason(d.pop("reject_reason"))


        created_at = d.pop("created_at")

        def _parse_email_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                email_id_type_0 = UUID(data)



                return email_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        email_id = _parse_email_id(d.pop("email_id"))


        def _parse_sent_email_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                sent_email_id_type_0 = UUID(data)



                return sent_email_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        sent_email_id = _parse_sent_email_id(d.pop("sent_email_id"))


        get_interaction_result_steps_item = cls(
            id=id,
            wire_step_id=wire_step_id,
            step=step,
            direction=direction,
            accepted=accepted,
            reject_reason=reject_reason,
            created_at=created_at,
            email_id=email_id,
            sent_email_id=sent_email_id,
        )


        get_interaction_result_steps_item.additional_properties = d
        return get_interaction_result_steps_item

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
