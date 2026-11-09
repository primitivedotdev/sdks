from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.put_mail_topic_generations_request_generation_type_1_kind import PutMailTopicGenerationsRequestGenerationType1Kind
from ..models.put_mail_topic_generations_request_generation_type_1_provider import PutMailTopicGenerationsRequestGenerationType1Provider
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.put_mail_topic_generations_request_generation_type_1_sources_item import PutMailTopicGenerationsRequestGenerationType1SourcesItem
  from ..models.put_mail_topic_generations_request_generation_type_1_tasks_item import PutMailTopicGenerationsRequestGenerationType1TasksItem





T = TypeVar("T", bound="PutMailTopicGenerationsRequestGenerationType1")



@_attrs_define
class PutMailTopicGenerationsRequestGenerationType1:
    """ 
        Attributes:
            kind (PutMailTopicGenerationsRequestGenerationType1Kind):
            topic_id (str):
            sources (list[PutMailTopicGenerationsRequestGenerationType1SourcesItem]):
            input_digest (str):
            provider (PutMailTopicGenerationsRequestGenerationType1Provider):
            summary (str):
            summary_source_message_ids (list[UUID]):
            tasks (list[PutMailTopicGenerationsRequestGenerationType1TasksItem]):
     """

    kind: PutMailTopicGenerationsRequestGenerationType1Kind
    topic_id: str
    sources: list[PutMailTopicGenerationsRequestGenerationType1SourcesItem]
    input_digest: str
    provider: PutMailTopicGenerationsRequestGenerationType1Provider
    summary: str
    summary_source_message_ids: list[UUID]
    tasks: list[PutMailTopicGenerationsRequestGenerationType1TasksItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.put_mail_topic_generations_request_generation_type_1_sources_item import PutMailTopicGenerationsRequestGenerationType1SourcesItem # noqa: PLC0415
        from ..models.put_mail_topic_generations_request_generation_type_1_tasks_item import PutMailTopicGenerationsRequestGenerationType1TasksItem # noqa: PLC0415
        kind = self.kind.value

        topic_id = self.topic_id

        sources = []
        for sources_item_data in self.sources:
            sources_item = sources_item_data.to_dict()
            sources.append(sources_item)



        input_digest = self.input_digest

        provider = self.provider.value

        summary = self.summary

        summary_source_message_ids = []
        for summary_source_message_ids_item_data in self.summary_source_message_ids:
            summary_source_message_ids_item = str(summary_source_message_ids_item_data)
            summary_source_message_ids.append(summary_source_message_ids_item)



        tasks = []
        for tasks_item_data in self.tasks:
            tasks_item = tasks_item_data.to_dict()
            tasks.append(tasks_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "topic_id": topic_id,
            "sources": sources,
            "input_digest": input_digest,
            "provider": provider,
            "summary": summary,
            "summary_source_message_ids": summary_source_message_ids,
            "tasks": tasks,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.put_mail_topic_generations_request_generation_type_1_sources_item import PutMailTopicGenerationsRequestGenerationType1SourcesItem # noqa: PLC0415
        from ..models.put_mail_topic_generations_request_generation_type_1_tasks_item import PutMailTopicGenerationsRequestGenerationType1TasksItem # noqa: PLC0415
        d = dict(src_dict)
        kind = PutMailTopicGenerationsRequestGenerationType1Kind(d.pop("kind"))




        topic_id = d.pop("topic_id")

        sources = []
        _sources = d.pop("sources")
        for sources_item_data in (_sources):
            sources_item = PutMailTopicGenerationsRequestGenerationType1SourcesItem.from_dict(sources_item_data)



            sources.append(sources_item)


        input_digest = d.pop("input_digest")

        provider = PutMailTopicGenerationsRequestGenerationType1Provider(d.pop("provider"))




        summary = d.pop("summary")

        summary_source_message_ids = []
        _summary_source_message_ids = d.pop("summary_source_message_ids")
        for summary_source_message_ids_item_data in (_summary_source_message_ids):
            summary_source_message_ids_item = UUID(summary_source_message_ids_item_data)



            summary_source_message_ids.append(summary_source_message_ids_item)


        tasks = []
        _tasks = d.pop("tasks")
        for tasks_item_data in (_tasks):
            tasks_item = PutMailTopicGenerationsRequestGenerationType1TasksItem.from_dict(tasks_item_data)



            tasks.append(tasks_item)


        put_mail_topic_generations_request_generation_type_1 = cls(
            kind=kind,
            topic_id=topic_id,
            sources=sources,
            input_digest=input_digest,
            provider=provider,
            summary=summary,
            summary_source_message_ids=summary_source_message_ids,
            tasks=tasks,
        )

        return put_mail_topic_generations_request_generation_type_1

