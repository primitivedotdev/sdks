from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.mail_topic_generations_update_item_generation_type_0_message_direction import MailTopicGenerationsUpdateItemGenerationType0MessageDirection
from uuid import UUID






T = TypeVar("T", bound="MailTopicGenerationsUpdateItemGenerationType0Message")



@_attrs_define
class MailTopicGenerationsUpdateItemGenerationType0Message:
    """ 
        Attributes:
            direction (MailTopicGenerationsUpdateItemGenerationType0MessageDirection):
            message_id (UUID):
     """

    direction: MailTopicGenerationsUpdateItemGenerationType0MessageDirection
    message_id: UUID
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        direction = self.direction.value

        message_id = str(self.message_id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "direction": direction,
            "message_id": message_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        direction = MailTopicGenerationsUpdateItemGenerationType0MessageDirection(d.pop("direction"))




        message_id = UUID(d.pop("message_id"))




        mail_topic_generations_update_item_generation_type_0_message = cls(
            direction=direction,
            message_id=message_id,
        )


        mail_topic_generations_update_item_generation_type_0_message.additional_properties = d
        return mail_topic_generations_update_item_generation_type_0_message

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
