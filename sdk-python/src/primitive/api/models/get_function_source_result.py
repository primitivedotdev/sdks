from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.get_function_source_result_files_item import GetFunctionSourceResultFilesItem





T = TypeVar("T", bound="GetFunctionSourceResult")



@_attrs_define
class GetFunctionSourceResult:
    """ 
        Attributes:
            deployment_id (None | UUID):
            files (list[GetFunctionSourceResultFilesItem]):
     """

    deployment_id: None | UUID
    files: list[GetFunctionSourceResultFilesItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_function_source_result_files_item import GetFunctionSourceResultFilesItem # noqa: PLC0415
        deployment_id: None | str
        if isinstance(self.deployment_id, UUID):
            deployment_id = str(self.deployment_id)
        else:
            deployment_id = self.deployment_id

        files = []
        for files_item_data in self.files:
            files_item = files_item_data.to_dict()
            files.append(files_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "deploymentId": deployment_id,
            "files": files,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_function_source_result_files_item import GetFunctionSourceResultFilesItem # noqa: PLC0415
        d = dict(src_dict)
        def _parse_deployment_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                deployment_id_type_0 = UUID(data)



                return deployment_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        deployment_id = _parse_deployment_id(d.pop("deploymentId"))


        files = []
        _files = d.pop("files")
        for files_item_data in (_files):
            files_item = GetFunctionSourceResultFilesItem.from_dict(files_item_data)



            files.append(files_item)


        get_function_source_result = cls(
            deployment_id=deployment_id,
            files=files,
        )


        get_function_source_result.additional_properties = d
        return get_function_source_result

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
