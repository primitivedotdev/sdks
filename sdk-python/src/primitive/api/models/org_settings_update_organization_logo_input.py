from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.org_settings_update_organization_logo_input_content_type import OrgSettingsUpdateOrganizationLogoInputContentType






T = TypeVar("T", bound="OrgSettingsUpdateOrganizationLogoInput")



@_attrs_define
class OrgSettingsUpdateOrganizationLogoInput:
    """ 
        Attributes:
            content_type (OrgSettingsUpdateOrganizationLogoInputContentType):
            data_base64 (str):
     """

    content_type: OrgSettingsUpdateOrganizationLogoInputContentType
    data_base64: str





    def to_dict(self) -> dict[str, Any]:
        content_type = self.content_type.value

        data_base64 = self.data_base64


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "content_type": content_type,
            "data_base64": data_base64,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        content_type = OrgSettingsUpdateOrganizationLogoInputContentType(d.pop("content_type"))




        data_base64 = d.pop("data_base64")

        org_settings_update_organization_logo_input = cls(
            content_type=content_type,
            data_base64=data_base64,
        )

        return org_settings_update_organization_logo_input

