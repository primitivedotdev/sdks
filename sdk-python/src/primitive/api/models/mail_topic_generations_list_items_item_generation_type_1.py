from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.mail_topic_generations_list_items_item_generation_type_1_kind import MailTopicGenerationsListItemsItemGenerationType1Kind
from ..models.mail_topic_generations_list_items_item_generation_type_1_provider import MailTopicGenerationsListItemsItemGenerationType1Provider
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.mail_topic_generations_list_items_item_generation_type_1_sources_item import MailTopicGenerationsListItemsItemGenerationType1SourcesItem
  from ..models.mail_topic_generations_list_items_item_generation_type_1_tasks_item import MailTopicGenerationsListItemsItemGenerationType1TasksItem





T = TypeVar("T", bound="MailTopicGenerationsListItemsItemGenerationType1")



@_attrs_define
class MailTopicGenerationsListItemsItemGenerationType1:
    """ 
        Attributes:
            kind (MailTopicGenerationsListItemsItemGenerationType1Kind):
            topic_id (None | str):
            sources (list[MailTopicGenerationsListItemsItemGenerationType1SourcesItem]):
            input_digest (str):
            provider (MailTopicGenerationsListItemsItemGenerationType1Provider):
            summary (None | str):
            summary_source_message_ids (list[UUID]):
            tasks (list[MailTopicGenerationsListItemsItemGenerationType1TasksItem]):
     """

    kind: MailTopicGenerationsListItemsItemGenerationType1Kind
    topic_id: None | str
    sources: list[MailTopicGenerationsListItemsItemGenerationType1SourcesItem]
    input_digest: str
    provider: MailTopicGenerationsListItemsItemGenerationType1Provider
    summary: None | str
    summary_source_message_ids: list[UUID]
    tasks: list[MailTopicGenerationsListItemsItemGenerationType1TasksItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.mail_topic_generations_list_items_item_generation_type_1_sources_item import MailTopicGenerationsListItemsItemGenerationType1SourcesItem # noqa: PLC0415
        from ..models.mail_topic_generations_list_items_item_generation_type_1_tasks_item import MailTopicGenerationsListItemsItemGenerationType1TasksItem # noqa: PLC0415
        kind = self.kind.value

        topic_id: None | str
        topic_id = self.topic_id

        sources = []
        for sources_item_data in self.sources:
            sources_item = sources_item_data.to_dict()
            sources.append(sources_item)



        input_digest = self.input_digest

        provider = self.provider.value

        summary: None | str
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
        field_dict.update(self.additional_properties)
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
        from ..models.mail_topic_generations_list_items_item_generation_type_1_sources_item import MailTopicGenerationsListItemsItemGenerationType1SourcesItem # noqa: PLC0415
        from ..models.mail_topic_generations_list_items_item_generation_type_1_tasks_item import MailTopicGenerationsListItemsItemGenerationType1TasksItem # noqa: PLC0415
        d = dict(src_dict)
        kind = MailTopicGenerationsListItemsItemGenerationType1Kind(d.pop("kind"))




        def _parse_topic_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        topic_id = _parse_topic_id(d.pop("topic_id"))


        sources = []
        _sources = d.pop("sources")
        for sources_item_data in (_sources):
            sources_item = MailTopicGenerationsListItemsItemGenerationType1SourcesItem.from_dict(sources_item_data)



            sources.append(sources_item)


        input_digest = d.pop("input_digest")

        provider = MailTopicGenerationsListItemsItemGenerationType1Provider(d.pop("provider"))




        def _parse_summary(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        summary = _parse_summary(d.pop("summary"))


        summary_source_message_ids = []
        _summary_source_message_ids = d.pop("summary_source_message_ids")
        for summary_source_message_ids_item_data in (_summary_source_message_ids):
            summary_source_message_ids_item = UUID(summary_source_message_ids_item_data)



            summary_source_message_ids.append(summary_source_message_ids_item)


        tasks = []
        _tasks = d.pop("tasks")
        for tasks_item_data in (_tasks):
            tasks_item = MailTopicGenerationsListItemsItemGenerationType1TasksItem.from_dict(tasks_item_data)



            tasks.append(tasks_item)


        mail_topic_generations_list_items_item_generation_type_1 = cls(
            kind=kind,
            topic_id=topic_id,
            sources=sources,
            input_digest=input_digest,
            provider=provider,
            summary=summary,
            summary_source_message_ids=summary_source_message_ids,
            tasks=tasks,
        )


        mail_topic_generations_list_items_item_generation_type_1.additional_properties = d
        return mail_topic_generations_list_items_item_generation_type_1

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
