from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.mail_topic_edits_list_items_item_edit_message_direction import MailTopicEditsListItemsItemEditMessageDirection
from uuid import UUID






T = TypeVar("T", bound="MailTopicEditsListItemsItemEditMessage")



@_attrs_define
class MailTopicEditsListItemsItemEditMessage:
    """ 
        Attributes:
            direction (MailTopicEditsListItemsItemEditMessageDirection):
            message_id (UUID):
     """

    direction: MailTopicEditsListItemsItemEditMessageDirection
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
        direction = MailTopicEditsListItemsItemEditMessageDirection(d.pop("direction"))




        message_id = UUID(d.pop("message_id"))




        mail_topic_edits_list_items_item_edit_message = cls(
            direction=direction,
            message_id=message_id,
        )


        mail_topic_edits_list_items_item_edit_message.additional_properties = d
        return mail_topic_edits_list_items_item_edit_message

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
