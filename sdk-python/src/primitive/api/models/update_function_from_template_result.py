from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_function_from_template_result_status import UpdateFunctionFromTemplateResultStatus
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="UpdateFunctionFromTemplateResult")



@_attrs_define
class UpdateFunctionFromTemplateResult:
    """ 
        Attributes:
            status (UpdateFunctionFromTemplateResultStatus):
            function_id (UUID):
            content_sha (None | str):
     """

    status: UpdateFunctionFromTemplateResultStatus
    function_id: UUID
    content_sha: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        status = self.status.value

        function_id = str(self.function_id)

        content_sha: None | str
        content_sha = self.content_sha


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "status": status,
            "function_id": function_id,
            "content_sha": content_sha,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        status = UpdateFunctionFromTemplateResultStatus(d.pop("status"))




        function_id = UUID(d.pop("function_id"))




        def _parse_content_sha(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        content_sha = _parse_content_sha(d.pop("content_sha"))


        update_function_from_template_result = cls(
            status=status,
            function_id=function_id,
            content_sha=content_sha,
        )


        update_function_from_template_result.additional_properties = d
        return update_function_from_template_result

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
