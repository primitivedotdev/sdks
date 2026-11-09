from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.mail_topic_generations_update_item import MailTopicGenerationsUpdateItem





T = TypeVar("T", bound="MailTopicGenerationsUpdate")



@_attrs_define
class MailTopicGenerationsUpdate:
    """ 
        Attributes:
            mailbox (str):
            item (MailTopicGenerationsUpdateItem):
     """

    mailbox: str
    item: MailTopicGenerationsUpdateItem
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.mail_topic_generations_update_item import MailTopicGenerationsUpdateItem # noqa: PLC0415
        mailbox = self.mailbox

        item = self.item.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "mailbox": mailbox,
            "item": item,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.mail_topic_generations_update_item import MailTopicGenerationsUpdateItem # noqa: PLC0415
        d = dict(src_dict)
        mailbox = d.pop("mailbox")

        item = MailTopicGenerationsUpdateItem.from_dict(d.pop("item"))




        mail_topic_generations_update = cls(
            mailbox=mailbox,
            item=item,
        )


        mail_topic_generations_update.additional_properties = d
        return mail_topic_generations_update

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
