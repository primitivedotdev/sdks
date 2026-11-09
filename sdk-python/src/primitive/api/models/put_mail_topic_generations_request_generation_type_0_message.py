from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.put_mail_topic_generations_request_generation_type_0_message_direction import PutMailTopicGenerationsRequestGenerationType0MessageDirection
from uuid import UUID






T = TypeVar("T", bound="PutMailTopicGenerationsRequestGenerationType0Message")



@_attrs_define
class PutMailTopicGenerationsRequestGenerationType0Message:
    """ 
        Attributes:
            direction (PutMailTopicGenerationsRequestGenerationType0MessageDirection):
            message_id (UUID):
     """

    direction: PutMailTopicGenerationsRequestGenerationType0MessageDirection
    message_id: UUID





    def to_dict(self) -> dict[str, Any]:
        direction = self.direction.value

        message_id = str(self.message_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "direction": direction,
            "message_id": message_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        direction = PutMailTopicGenerationsRequestGenerationType0MessageDirection(d.pop("direction"))




        message_id = UUID(d.pop("message_id"))




        put_mail_topic_generations_request_generation_type_0_message = cls(
            direction=direction,
            message_id=message_id,
        )

        return put_mail_topic_generations_request_generation_type_0_message

