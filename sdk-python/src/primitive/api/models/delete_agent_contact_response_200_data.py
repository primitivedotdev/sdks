from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="DeleteAgentContactResponse200Data")



@_attrs_define
class DeleteAgentContactResponse200Data:
    """ 
        Attributes:
            deleted (bool):
     """

    deleted: bool





    def to_dict(self) -> dict[str, Any]:
        deleted = self.deleted


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "deleted": deleted,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        deleted = d.pop("deleted")

        delete_agent_contact_response_200_data = cls(
            deleted=deleted,
        )

        return delete_agent_contact_response_200_data

