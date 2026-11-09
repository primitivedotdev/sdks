from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="PrepareContactAcceptanceBody")



@_attrs_define
class PrepareContactAcceptanceBody:
    """ 
        Attributes:
            email_id (UUID): The received contact request email.
     """

    email_id: UUID





    def to_dict(self) -> dict[str, Any]:
        email_id = str(self.email_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "email_id": email_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        email_id = UUID(d.pop("email_id"))




        prepare_contact_acceptance_body = cls(
            email_id=email_id,
        )

        return prepare_contact_acceptance_body

