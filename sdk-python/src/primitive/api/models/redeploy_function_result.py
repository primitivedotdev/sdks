from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="RedeployFunctionResult")



@_attrs_define
class RedeployFunctionResult:
    """ 
        Attributes:
            redeployed (bool):
            id (UUID):
            deployment_id (UUID):
     """

    redeployed: bool
    id: UUID
    deployment_id: UUID
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        redeployed = self.redeployed

        id = str(self.id)

        deployment_id = str(self.deployment_id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "redeployed": redeployed,
            "id": id,
            "deployment_id": deployment_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        redeployed = d.pop("redeployed")

        id = UUID(d.pop("id"))




        deployment_id = UUID(d.pop("deployment_id"))




        redeploy_function_result = cls(
            redeployed=redeployed,
            id=id,
            deployment_id=deployment_id,
        )


        redeploy_function_result.additional_properties = d
        return redeploy_function_result

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
