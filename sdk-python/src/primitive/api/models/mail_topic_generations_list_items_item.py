from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.mail_topic_generations_list_items_item_generation_type_0 import MailTopicGenerationsListItemsItemGenerationType0
  from ..models.mail_topic_generations_list_items_item_generation_type_1 import MailTopicGenerationsListItemsItemGenerationType1





T = TypeVar("T", bound="MailTopicGenerationsListItemsItem")



@_attrs_define
class MailTopicGenerationsListItemsItem:
    """ 
        Attributes:
            generation (MailTopicGenerationsListItemsItemGenerationType0 |
                MailTopicGenerationsListItemsItemGenerationType1):
            version (int):
            mutation_id (UUID):
            updated_at (str):
     """

    generation: MailTopicGenerationsListItemsItemGenerationType0 | MailTopicGenerationsListItemsItemGenerationType1
    version: int
    mutation_id: UUID
    updated_at: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.mail_topic_generations_list_items_item_generation_type_0 import MailTopicGenerationsListItemsItemGenerationType0 # noqa: PLC0415
        from ..models.mail_topic_generations_list_items_item_generation_type_1 import MailTopicGenerationsListItemsItemGenerationType1 # noqa: PLC0415
        generation: dict[str, Any]
        if isinstance(self.generation, MailTopicGenerationsListItemsItemGenerationType0):
            generation = self.generation.to_dict()
        else:
            generation = self.generation.to_dict()


        version = self.version

        mutation_id = str(self.mutation_id)

        updated_at = self.updated_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "generation": generation,
            "version": version,
            "mutation_id": mutation_id,
            "updated_at": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.mail_topic_generations_list_items_item_generation_type_0 import MailTopicGenerationsListItemsItemGenerationType0 # noqa: PLC0415
        from ..models.mail_topic_generations_list_items_item_generation_type_1 import MailTopicGenerationsListItemsItemGenerationType1 # noqa: PLC0415
        d = dict(src_dict)
        def _parse_generation(data: object) -> MailTopicGenerationsListItemsItemGenerationType0 | MailTopicGenerationsListItemsItemGenerationType1:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                generation_type_0 = MailTopicGenerationsListItemsItemGenerationType0.from_dict(data)



                return generation_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            generation_type_1 = MailTopicGenerationsListItemsItemGenerationType1.from_dict(data)



            return generation_type_1

        generation = _parse_generation(d.pop("generation"))


        version = d.pop("version")

        mutation_id = UUID(d.pop("mutation_id"))




        updated_at = d.pop("updated_at")

        mail_topic_generations_list_items_item = cls(
            generation=generation,
            version=version,
            mutation_id=mutation_id,
            updated_at=updated_at,
        )


        mail_topic_generations_list_items_item.additional_properties = d
        return mail_topic_generations_list_items_item

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
