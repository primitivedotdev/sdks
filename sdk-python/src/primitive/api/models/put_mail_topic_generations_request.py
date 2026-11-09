from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.put_mail_topic_generations_request_generation_type_0 import PutMailTopicGenerationsRequestGenerationType0
  from ..models.put_mail_topic_generations_request_generation_type_1 import PutMailTopicGenerationsRequestGenerationType1





T = TypeVar("T", bound="PutMailTopicGenerationsRequest")



@_attrs_define
class PutMailTopicGenerationsRequest:
    """ 
        Attributes:
            mailbox (str):
            participants (list[str]):
            generation (PutMailTopicGenerationsRequestGenerationType0 | PutMailTopicGenerationsRequestGenerationType1):
            expected_version (int):
            mutation_id (UUID):
     """

    mailbox: str
    participants: list[str]
    generation: PutMailTopicGenerationsRequestGenerationType0 | PutMailTopicGenerationsRequestGenerationType1
    expected_version: int
    mutation_id: UUID





    def to_dict(self) -> dict[str, Any]:
        from ..models.put_mail_topic_generations_request_generation_type_0 import PutMailTopicGenerationsRequestGenerationType0 # noqa: PLC0415
        from ..models.put_mail_topic_generations_request_generation_type_1 import PutMailTopicGenerationsRequestGenerationType1 # noqa: PLC0415
        mailbox = self.mailbox

        participants = self.participants



        generation: dict[str, Any]
        if isinstance(self.generation, PutMailTopicGenerationsRequestGenerationType0):
            generation = self.generation.to_dict()
        else:
            generation = self.generation.to_dict()


        expected_version = self.expected_version

        mutation_id = str(self.mutation_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "mailbox": mailbox,
            "participants": participants,
            "generation": generation,
            "expected_version": expected_version,
            "mutation_id": mutation_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.put_mail_topic_generations_request_generation_type_0 import PutMailTopicGenerationsRequestGenerationType0 # noqa: PLC0415
        from ..models.put_mail_topic_generations_request_generation_type_1 import PutMailTopicGenerationsRequestGenerationType1 # noqa: PLC0415
        d = dict(src_dict)
        mailbox = d.pop("mailbox")

        participants = cast(list[str], d.pop("participants"))


        def _parse_generation(data: object) -> PutMailTopicGenerationsRequestGenerationType0 | PutMailTopicGenerationsRequestGenerationType1:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                generation_type_0 = PutMailTopicGenerationsRequestGenerationType0.from_dict(data)



                return generation_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            generation_type_1 = PutMailTopicGenerationsRequestGenerationType1.from_dict(data)



            return generation_type_1

        generation = _parse_generation(d.pop("generation"))


        expected_version = d.pop("expected_version")

        mutation_id = UUID(d.pop("mutation_id"))




        put_mail_topic_generations_request = cls(
            mailbox=mailbox,
            participants=participants,
            generation=generation,
            expected_version=expected_version,
            mutation_id=mutation_id,
        )

        return put_mail_topic_generations_request

