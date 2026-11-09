from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="OrgSettingsUpdateSearchSettingsInput")



@_attrs_define
class OrgSettingsUpdateSearchSettingsInput:
    """ 
        Attributes:
            semantic_search_opt_in (bool):
     """

    semantic_search_opt_in: bool





    def to_dict(self) -> dict[str, Any]:
        semantic_search_opt_in = self.semantic_search_opt_in


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "semantic_search_opt_in": semantic_search_opt_in,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        semantic_search_opt_in = d.pop("semantic_search_opt_in")

        org_settings_update_search_settings_input = cls(
            semantic_search_opt_in=semantic_search_opt_in,
        )

        return org_settings_update_search_settings_input

