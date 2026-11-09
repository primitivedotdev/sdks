from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.mail_topic_generations_update_item_generation_type_0_kind import MailTopicGenerationsUpdateItemGenerationType0Kind
from ..models.mail_topic_generations_update_item_generation_type_0_provider import MailTopicGenerationsUpdateItemGenerationType0Provider
from typing import cast

if TYPE_CHECKING:
  from ..models.mail_topic_generations_update_item_generation_type_0_message import MailTopicGenerationsUpdateItemGenerationType0Message
  from ..models.mail_topic_generations_update_item_generation_type_0_sources_item import MailTopicGenerationsUpdateItemGenerationType0SourcesItem





T = TypeVar("T", bound="MailTopicGenerationsUpdateItemGenerationType0")



@_attrs_define
class MailTopicGenerationsUpdateItemGenerationType0:
    """ 
        Attributes:
            kind (MailTopicGenerationsUpdateItemGenerationType0Kind):
            topic_id (None | str):
            sources (list[MailTopicGenerationsUpdateItemGenerationType0SourcesItem]):
            input_digest (str):
            provider (MailTopicGenerationsUpdateItemGenerationType0Provider):
            message (MailTopicGenerationsUpdateItemGenerationType0Message):
     """

    kind: MailTopicGenerationsUpdateItemGenerationType0Kind
    topic_id: None | str
    sources: list[MailTopicGenerationsUpdateItemGenerationType0SourcesItem]
    input_digest: str
    provider: MailTopicGenerationsUpdateItemGenerationType0Provider
    message: MailTopicGenerationsUpdateItemGenerationType0Message
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.mail_topic_generations_update_item_generation_type_0_message import MailTopicGenerationsUpdateItemGenerationType0Message # noqa: PLC0415
        from ..models.mail_topic_generations_update_item_generation_type_0_sources_item import MailTopicGenerationsUpdateItemGenerationType0SourcesItem # noqa: PLC0415
        kind = self.kind.value

        topic_id: None | str
        topic_id = self.topic_id

        sources = []
        for sources_item_data in self.sources:
            sources_item = sources_item_data.to_dict()
            sources.append(sources_item)



        input_digest = self.input_digest

        provider = self.provider.value

        message = self.message.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
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
        from ..models.mail_topic_generations_update_item_generation_type_0_message import MailTopicGenerationsUpdateItemGenerationType0Message # noqa: PLC0415
        from ..models.mail_topic_generations_update_item_generation_type_0_sources_item import MailTopicGenerationsUpdateItemGenerationType0SourcesItem # noqa: PLC0415
        d = dict(src_dict)
        kind = MailTopicGenerationsUpdateItemGenerationType0Kind(d.pop("kind"))




        def _parse_topic_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        topic_id = _parse_topic_id(d.pop("topic_id"))


        sources = []
        _sources = d.pop("sources")
        for sources_item_data in (_sources):
            sources_item = MailTopicGenerationsUpdateItemGenerationType0SourcesItem.from_dict(sources_item_data)



            sources.append(sources_item)


        input_digest = d.pop("input_digest")

        provider = MailTopicGenerationsUpdateItemGenerationType0Provider(d.pop("provider"))




        message = MailTopicGenerationsUpdateItemGenerationType0Message.from_dict(d.pop("message"))




        mail_topic_generations_update_item_generation_type_0 = cls(
            kind=kind,
            topic_id=topic_id,
            sources=sources,
            input_digest=input_digest,
            provider=provider,
            message=message,
        )


        mail_topic_generations_update_item_generation_type_0.additional_properties = d
        return mail_topic_generations_update_item_generation_type_0

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
