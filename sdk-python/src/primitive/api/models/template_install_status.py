from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.template_install_state import TemplateInstallState
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="TemplateInstallStatus")



@_attrs_define
class TemplateInstallStatus:
    """ 
        Attributes:
            id (UUID):
            template_slug (str): Template slug for this install.
            state (TemplateInstallState):
            address (None | str):
            function_id (None | UUID):
            error (None | str):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
     """

    id: UUID
    template_slug: str
    state: TemplateInstallState
    address: None | str
    function_id: None | UUID
    error: None | str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        template_slug = self.template_slug

        state = self.state.value

        address: None | str
        address = self.address

        function_id: None | str
        if isinstance(self.function_id, UUID):
            function_id = str(self.function_id)
        else:
            function_id = self.function_id

        error: None | str
        error = self.error

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "template_slug": template_slug,
            "state": state,
            "address": address,
            "function_id": function_id,
            "error": error,
            "created_at": created_at,
            "updated_at": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        template_slug = d.pop("template_slug")

        state = TemplateInstallState(d.pop("state"))




        def _parse_address(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        address = _parse_address(d.pop("address"))


        def _parse_function_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                function_id_type_0 = UUID(data)



                return function_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        function_id = _parse_function_id(d.pop("function_id"))


        def _parse_error(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        error = _parse_error(d.pop("error"))


        created_at = isoparse(d.pop("created_at"))




        updated_at = isoparse(d.pop("updated_at"))




        template_install_status = cls(
            id=id,
            template_slug=template_slug,
            state=state,
            address=address,
            function_id=function_id,
            error=error,
            created_at=created_at,
            updated_at=updated_at,
        )


        template_install_status.additional_properties = d
        return template_install_status

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
