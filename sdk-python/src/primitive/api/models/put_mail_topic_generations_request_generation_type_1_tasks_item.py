from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="PutMailTopicGenerationsRequestGenerationType1TasksItem")



@_attrs_define
class PutMailTopicGenerationsRequestGenerationType1TasksItem:
    """ 
        Attributes:
            id (str):
            text (str):
            source_message_ids (list[UUID]):
            evidence (str):
     """

    id: str
    text: str
    source_message_ids: list[UUID]
    evidence: str





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        text = self.text

        source_message_ids = []
        for source_message_ids_item_data in self.source_message_ids:
            source_message_ids_item = str(source_message_ids_item_data)
            source_message_ids.append(source_message_ids_item)



        evidence = self.evidence


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "text": text,
            "source_message_ids": source_message_ids,
            "evidence": evidence,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        text = d.pop("text")

        source_message_ids = []
        _source_message_ids = d.pop("source_message_ids")
        for source_message_ids_item_data in (_source_message_ids):
            source_message_ids_item = UUID(source_message_ids_item_data)



            source_message_ids.append(source_message_ids_item)


        evidence = d.pop("evidence")

        put_mail_topic_generations_request_generation_type_1_tasks_item = cls(
            id=id,
            text=text,
            source_message_ids=source_message_ids,
            evidence=evidence,
        )

        return put_mail_topic_generations_request_generation_type_1_tasks_item

