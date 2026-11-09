from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.put_mail_topic_generations_request_generation_type_0_sources_item_direction import PutMailTopicGenerationsRequestGenerationType0SourcesItemDirection
from uuid import UUID






T = TypeVar("T", bound="PutMailTopicGenerationsRequestGenerationType0SourcesItem")



@_attrs_define
class PutMailTopicGenerationsRequestGenerationType0SourcesItem:
    """ 
        Attributes:
            direction (PutMailTopicGenerationsRequestGenerationType0SourcesItemDirection):
            message_id (UUID):
     """

    direction: PutMailTopicGenerationsRequestGenerationType0SourcesItemDirection
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
        direction = PutMailTopicGenerationsRequestGenerationType0SourcesItemDirection(d.pop("direction"))




        message_id = UUID(d.pop("message_id"))




        put_mail_topic_generations_request_generation_type_0_sources_item = cls(
            direction=direction,
            message_id=message_id,
        )

        return put_mail_topic_generations_request_generation_type_0_sources_item

