from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.put_mail_topic_edits_request_edit_kind import PutMailTopicEditsRequestEditKind
from typing import cast

if TYPE_CHECKING:
  from ..models.put_mail_topic_edits_request_edit_message import PutMailTopicEditsRequestEditMessage
  from ..models.put_mail_topic_edits_request_edit_sources_item import PutMailTopicEditsRequestEditSourcesItem





T = TypeVar("T", bound="PutMailTopicEditsRequestEdit")



@_attrs_define
class PutMailTopicEditsRequestEdit:
    """ 
        Attributes:
            kind (PutMailTopicEditsRequestEditKind):
            topic_id (str):
            message (PutMailTopicEditsRequestEditMessage | Unset):
            text (str | Unset):
            sources (list[PutMailTopicEditsRequestEditSourcesItem] | Unset):
            task_id (str | Unset):
            completed (bool | Unset):
            dismissed (bool | Unset):
            evidence (str | Unset):
     """

    kind: PutMailTopicEditsRequestEditKind
    topic_id: str
    message: PutMailTopicEditsRequestEditMessage | Unset = UNSET
    text: str | Unset = UNSET
    sources: list[PutMailTopicEditsRequestEditSourcesItem] | Unset = UNSET
    task_id: str | Unset = UNSET
    completed: bool | Unset = UNSET
    dismissed: bool | Unset = UNSET
    evidence: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.put_mail_topic_edits_request_edit_message import PutMailTopicEditsRequestEditMessage # noqa: PLC0415
        from ..models.put_mail_topic_edits_request_edit_sources_item import PutMailTopicEditsRequestEditSourcesItem # noqa: PLC0415
        kind = self.kind.value

        topic_id = self.topic_id

        message: dict[str, Any] | Unset = UNSET
        if not isinstance(self.message, Unset):
            message = self.message.to_dict()

        text = self.text

        sources: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.sources, Unset):
            sources = []
            for sources_item_data in self.sources:
                sources_item = sources_item_data.to_dict()
                sources.append(sources_item)



        task_id = self.task_id

        completed = self.completed

        dismissed = self.dismissed

        evidence = self.evidence


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "topic_id": topic_id,
        })
        if message is not UNSET:
            field_dict["message"] = message
        if text is not UNSET:
            field_dict["text"] = text
        if sources is not UNSET:
            field_dict["sources"] = sources
        if task_id is not UNSET:
            field_dict["task_id"] = task_id
        if completed is not UNSET:
            field_dict["completed"] = completed
        if dismissed is not UNSET:
            field_dict["dismissed"] = dismissed
        if evidence is not UNSET:
            field_dict["evidence"] = evidence

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.put_mail_topic_edits_request_edit_message import PutMailTopicEditsRequestEditMessage # noqa: PLC0415
        from ..models.put_mail_topic_edits_request_edit_sources_item import PutMailTopicEditsRequestEditSourcesItem # noqa: PLC0415
        d = dict(src_dict)
        kind = PutMailTopicEditsRequestEditKind(d.pop("kind"))




        topic_id = d.pop("topic_id")

        _message = d.pop("message", UNSET)
        message: PutMailTopicEditsRequestEditMessage | Unset
        if isinstance(_message,  Unset):
            message = UNSET
        else:
            message = PutMailTopicEditsRequestEditMessage.from_dict(_message)




        text = d.pop("text", UNSET)

        _sources = d.pop("sources", UNSET)
        sources: list[PutMailTopicEditsRequestEditSourcesItem] | Unset = UNSET
        if _sources is not UNSET:
            sources = []
            for sources_item_data in _sources:
                sources_item = PutMailTopicEditsRequestEditSourcesItem.from_dict(sources_item_data)



                sources.append(sources_item)


        task_id = d.pop("task_id", UNSET)

        completed = d.pop("completed", UNSET)

        dismissed = d.pop("dismissed", UNSET)

        evidence = d.pop("evidence", UNSET)

        put_mail_topic_edits_request_edit = cls(
            kind=kind,
            topic_id=topic_id,
            message=message,
            text=text,
            sources=sources,
            task_id=task_id,
            completed=completed,
            dismissed=dismissed,
            evidence=evidence,
        )


        put_mail_topic_edits_request_edit.additional_properties = d
        return put_mail_topic_edits_request_edit

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
