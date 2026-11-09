from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.put_mail_topic_generations_request_generation_type_0_kind import PutMailTopicGenerationsRequestGenerationType0Kind
from ..models.put_mail_topic_generations_request_generation_type_0_provider import PutMailTopicGenerationsRequestGenerationType0Provider
from typing import cast

if TYPE_CHECKING:
  from ..models.put_mail_topic_generations_request_generation_type_0_message import PutMailTopicGenerationsRequestGenerationType0Message
  from ..models.put_mail_topic_generations_request_generation_type_0_sources_item import PutMailTopicGenerationsRequestGenerationType0SourcesItem





T = TypeVar("T", bound="PutMailTopicGenerationsRequestGenerationType0")



@_attrs_define
class PutMailTopicGenerationsRequestGenerationType0:
    """ 
        Attributes:
            kind (PutMailTopicGenerationsRequestGenerationType0Kind):
            topic_id (str):
            sources (list[PutMailTopicGenerationsRequestGenerationType0SourcesItem]):
            input_digest (str):
            provider (PutMailTopicGenerationsRequestGenerationType0Provider):
            message (PutMailTopicGenerationsRequestGenerationType0Message):
     """

    kind: PutMailTopicGenerationsRequestGenerationType0Kind
    topic_id: str
    sources: list[PutMailTopicGenerationsRequestGenerationType0SourcesItem]
    input_digest: str
    provider: PutMailTopicGenerationsRequestGenerationType0Provider
    message: PutMailTopicGenerationsRequestGenerationType0Message





    def to_dict(self) -> dict[str, Any]:
        from ..models.put_mail_topic_generations_request_generation_type_0_message import PutMailTopicGenerationsRequestGenerationType0Message # noqa: PLC0415
        from ..models.put_mail_topic_generations_request_generation_type_0_sources_item import PutMailTopicGenerationsRequestGenerationType0SourcesItem # noqa: PLC0415
        kind = self.kind.value

        topic_id = self.topic_id

        sources = []
        for sources_item_data in self.sources:
            sources_item = sources_item_data.to_dict()
            sources.append(sources_item)



        input_digest = self.input_digest

        provider = self.provider.value

        message = self.message.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "topic_id": topic_id,
            "sources": sources,
            "input_digest": input_digest,
            "provider": provider,
            "message": message,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.put_mail_topic_generations_request_generation_type_0_message import PutMailTopicGenerationsRequestGenerationType0Message # noqa: PLC0415
        from ..models.put_mail_topic_generations_request_generation_type_0_sources_item import PutMailTopicGenerationsRequestGenerationType0SourcesItem # noqa: PLC0415
        d = dict(src_dict)
        kind = PutMailTopicGenerationsRequestGenerationType0Kind(d.pop("kind"))




        topic_id = d.pop("topic_id")

        sources = []
        _sources = d.pop("sources")
        for sources_item_data in (_sources):
            sources_item = PutMailTopicGenerationsRequestGenerationType0SourcesItem.from_dict(sources_item_data)



            sources.append(sources_item)


        input_digest = d.pop("input_digest")

        provider = PutMailTopicGenerationsRequestGenerationType0Provider(d.pop("provider"))




        message = PutMailTopicGenerationsRequestGenerationType0Message.from_dict(d.pop("message"))




        put_mail_topic_generations_request_generation_type_0 = cls(
            kind=kind,
            topic_id=topic_id,
            sources=sources,
            input_digest=input_digest,
            provider=provider,
            message=message,
        )

        return put_mail_topic_generations_request_generation_type_0

