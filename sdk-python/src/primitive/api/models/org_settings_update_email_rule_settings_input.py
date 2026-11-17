from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="OrgSettingsUpdateEmailRuleSettingsInput")



@_attrs_define
class OrgSettingsUpdateEmailRuleSettingsInput:
    """ 
        Attributes:
            rules_read_attachments (bool):
     """

    rules_read_attachments: bool





    def to_dict(self) -> dict[str, Any]:
        rules_read_attachments = self.rules_read_attachments


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "rules_read_attachments": rules_read_attachments,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        rules_read_attachments = d.pop("rules_read_attachments")

        org_settings_update_email_rule_settings_input = cls(
            rules_read_attachments=rules_read_attachments,
        )

        return org_settings_update_email_rule_settings_input

