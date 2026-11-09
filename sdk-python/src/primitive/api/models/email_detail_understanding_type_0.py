from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.email_detail_understanding_type_0_facts import EmailDetailUnderstandingType0Facts





T = TypeVar("T", bound="EmailDetailUnderstandingType0")



@_attrs_define
class EmailDetailUnderstandingType0:
    """ Classification facts for this email. Present only for an org with email rules, where the body is shown. May be null:
    this field carries message content, which is withheld when the content is not available to your credential.

        Attributes:
            version (int): The block's shape version.
            status (str): `ready`, `pending` (not classified yet) or `unavailable` (will not be classified). Treat an
                unfamiliar value as added after your client was built.
            classification_id (UUID | Unset): The classification, when `ready`.
            vocabulary (str | Unset): The fact vocabulary, when `ready`.
            classified_at (datetime.datetime | Unset): When it was classified, when `ready`.
            facts (EmailDetailUnderstandingType0Facts | Unset): Facts by name, when `ready`. A fact the classification did
                not produce is absent.
     """

    version: int
    status: str
    classification_id: UUID | Unset = UNSET
    vocabulary: str | Unset = UNSET
    classified_at: datetime.datetime | Unset = UNSET
    facts: EmailDetailUnderstandingType0Facts | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_detail_understanding_type_0_facts import EmailDetailUnderstandingType0Facts # noqa: PLC0415
        version = self.version

        status = self.status

        classification_id: str | Unset = UNSET
        if not isinstance(self.classification_id, Unset):
            classification_id = str(self.classification_id)

        vocabulary = self.vocabulary

        classified_at: str | Unset = UNSET
        if not isinstance(self.classified_at, Unset):
            classified_at = self.classified_at.isoformat()

        facts: dict[str, Any] | Unset = UNSET
        if not isinstance(self.facts, Unset):
            facts = self.facts.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "version": version,
            "status": status,
        })
        if classification_id is not UNSET:
            field_dict["classification_id"] = classification_id
        if vocabulary is not UNSET:
            field_dict["vocabulary"] = vocabulary
        if classified_at is not UNSET:
            field_dict["classified_at"] = classified_at
        if facts is not UNSET:
            field_dict["facts"] = facts

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_detail_understanding_type_0_facts import EmailDetailUnderstandingType0Facts # noqa: PLC0415
        d = dict(src_dict)
        version = d.pop("version")

        status = d.pop("status")

        _classification_id = d.pop("classification_id", UNSET)
        classification_id: UUID | Unset
        if isinstance(_classification_id,  Unset):
            classification_id = UNSET
        else:
            classification_id = UUID(_classification_id)




        vocabulary = d.pop("vocabulary", UNSET)

        _classified_at = d.pop("classified_at", UNSET)
        classified_at: datetime.datetime | Unset
        if isinstance(_classified_at,  Unset):
            classified_at = UNSET
        else:
            classified_at = datetime.datetime.fromisoformat(_classified_at)




        _facts = d.pop("facts", UNSET)
        facts: EmailDetailUnderstandingType0Facts | Unset
        if isinstance(_facts,  Unset):
            facts = UNSET
        else:
            facts = EmailDetailUnderstandingType0Facts.from_dict(_facts)




        email_detail_understanding_type_0 = cls(
            version=version,
            status=status,
            classification_id=classification_id,
            vocabulary=vocabulary,
            classified_at=classified_at,
            facts=facts,
        )


        email_detail_understanding_type_0.additional_properties = d
        return email_detail_understanding_type_0

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
