from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.put_mail_topic_edits_request_edit import PutMailTopicEditsRequestEdit





T = TypeVar("T", bound="PutMailTopicEditsRequest")



@_attrs_define
class PutMailTopicEditsRequest:
    """ 
        Attributes:
            mailbox (str):
            participants (list[str]):
            edit (PutMailTopicEditsRequestEdit):
            expected_version (int):
            mutation_id (UUID):
     """

    mailbox: str
    participants: list[str]
    edit: PutMailTopicEditsRequestEdit
    expected_version: int
    mutation_id: UUID





    def to_dict(self) -> dict[str, Any]:
        from ..models.put_mail_topic_edits_request_edit import PutMailTopicEditsRequestEdit # noqa: PLC0415
        mailbox = self.mailbox

        participants = self.participants



        edit = self.edit.to_dict()

        expected_version = self.expected_version

        mutation_id = str(self.mutation_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "mailbox": mailbox,
            "participants": participants,
            "edit": edit,
            "expected_version": expected_version,
            "mutation_id": mutation_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.put_mail_topic_edits_request_edit import PutMailTopicEditsRequestEdit # noqa: PLC0415
        d = dict(src_dict)
        mailbox = d.pop("mailbox")

        participants = cast(list[str], d.pop("participants"))


        edit = PutMailTopicEditsRequestEdit.from_dict(d.pop("edit"))




        expected_version = d.pop("expected_version")

        mutation_id = UUID(d.pop("mutation_id"))




        put_mail_topic_edits_request = cls(
            mailbox=mailbox,
            participants=participants,
            edit=edit,
            expected_version=expected_version,
            mutation_id=mutation_id,
        )

        return put_mail_topic_edits_request

