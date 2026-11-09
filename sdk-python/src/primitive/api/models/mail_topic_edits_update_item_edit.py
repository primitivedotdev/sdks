from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.mail_topic_edits_update_item_edit_kind import MailTopicEditsUpdateItemEditKind
from typing import cast

if TYPE_CHECKING:
  from ..models.mail_topic_edits_update_item_edit_message import MailTopicEditsUpdateItemEditMessage
  from ..models.mail_topic_edits_update_item_edit_sources_item import MailTopicEditsUpdateItemEditSourcesItem





T = TypeVar("T", bound="MailTopicEditsUpdateItemEdit")



@_attrs_define
class MailTopicEditsUpdateItemEdit:
    """ 
        Attributes:
            kind (MailTopicEditsUpdateItemEditKind):
            topic_id (None | str):
            message (MailTopicEditsUpdateItemEditMessage | Unset):
            text (None | str | Unset):
            sources (list[MailTopicEditsUpdateItemEditSourcesItem] | Unset):
            task_id (None | str | Unset):
            completed (bool | Unset):
            dismissed (bool | Unset):
            evidence (None | str | Unset):
     """

    kind: MailTopicEditsUpdateItemEditKind
    topic_id: None | str
    message: MailTopicEditsUpdateItemEditMessage | Unset = UNSET
    text: None | str | Unset = UNSET
    sources: list[MailTopicEditsUpdateItemEditSourcesItem] | Unset = UNSET
    task_id: None | str | Unset = UNSET
    completed: bool | Unset = UNSET
    dismissed: bool | Unset = UNSET
    evidence: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.mail_topic_edits_update_item_edit_message import MailTopicEditsUpdateItemEditMessage # noqa: PLC0415
        from ..models.mail_topic_edits_update_item_edit_sources_item import MailTopicEditsUpdateItemEditSourcesItem # noqa: PLC0415
        kind = self.kind.value

        topic_id: None | str
        topic_id = self.topic_id

        message: dict[str, Any] | Unset = UNSET
        if not isinstance(self.message, Unset):
            message = self.message.to_dict()

        text: None | str | Unset
        if isinstance(self.text, Unset):
            text = UNSET
        else:
            text = self.text

        sources: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.sources, Unset):
            sources = []
            for sources_item_data in self.sources:
                sources_item = sources_item_data.to_dict()
                sources.append(sources_item)



        task_id: None | str | Unset
        if isinstance(self.task_id, Unset):
            task_id = UNSET
        else:
            task_id = self.task_id

        completed = self.completed

        dismissed = self.dismissed

        evidence: None | str | Unset
        if isinstance(self.evidence, Unset):
            evidence = UNSET
        else:
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
        from ..models.mail_topic_edits_update_item_edit_message import MailTopicEditsUpdateItemEditMessage # noqa: PLC0415
        from ..models.mail_topic_edits_update_item_edit_sources_item import MailTopicEditsUpdateItemEditSourcesItem # noqa: PLC0415
        d = dict(src_dict)
        kind = MailTopicEditsUpdateItemEditKind(d.pop("kind"))




        def _parse_topic_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        topic_id = _parse_topic_id(d.pop("topic_id"))


        _message = d.pop("message", UNSET)
        message: MailTopicEditsUpdateItemEditMessage | Unset
        if isinstance(_message,  Unset):
            message = UNSET
        else:
            message = MailTopicEditsUpdateItemEditMessage.from_dict(_message)




        def _parse_text(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        text = _parse_text(d.pop("text", UNSET))


        _sources = d.pop("sources", UNSET)
        sources: list[MailTopicEditsUpdateItemEditSourcesItem] | Unset = UNSET
        if _sources is not UNSET:
            sources = []
            for sources_item_data in _sources:
                sources_item = MailTopicEditsUpdateItemEditSourcesItem.from_dict(sources_item_data)



                sources.append(sources_item)


        def _parse_task_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        task_id = _parse_task_id(d.pop("task_id", UNSET))


        completed = d.pop("completed", UNSET)

        dismissed = d.pop("dismissed", UNSET)

        def _parse_evidence(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        evidence = _parse_evidence(d.pop("evidence", UNSET))


        mail_topic_edits_update_item_edit = cls(
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


        mail_topic_edits_update_item_edit.additional_properties = d
        return mail_topic_edits_update_item_edit

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
