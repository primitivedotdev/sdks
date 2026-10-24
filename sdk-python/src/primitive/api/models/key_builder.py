from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.credential_policy import CredentialPolicy
  from ..models.key_builder_matrix_item import KeyBuilderMatrixItem
  from ..models.key_builder_presets_item import KeyBuilderPresetsItem





T = TypeVar("T", bound="KeyBuilder")



@_attrs_define
class KeyBuilder:
    """ 
        Attributes:
            enabled (bool):
            presets (list[KeyBuilderPresetsItem]):
            matrix (list[KeyBuilderMatrixItem]):
            policy (CredentialPolicy):
     """

    enabled: bool
    presets: list[KeyBuilderPresetsItem]
    matrix: list[KeyBuilderMatrixItem]
    policy: CredentialPolicy
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.credential_policy import CredentialPolicy # noqa: PLC0415
        from ..models.key_builder_matrix_item import KeyBuilderMatrixItem # noqa: PLC0415
        from ..models.key_builder_presets_item import KeyBuilderPresetsItem # noqa: PLC0415
        enabled = self.enabled

        presets = []
        for presets_item_data in self.presets:
            presets_item = presets_item_data.to_dict()
            presets.append(presets_item)



        matrix = []
        for matrix_item_data in self.matrix:
            matrix_item = matrix_item_data.to_dict()
            matrix.append(matrix_item)



        policy = self.policy.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "enabled": enabled,
            "presets": presets,
            "matrix": matrix,
            "policy": policy,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credential_policy import CredentialPolicy # noqa: PLC0415
        from ..models.key_builder_matrix_item import KeyBuilderMatrixItem # noqa: PLC0415
        from ..models.key_builder_presets_item import KeyBuilderPresetsItem # noqa: PLC0415
        d = dict(src_dict)
        enabled = d.pop("enabled")

        presets = []
        _presets = d.pop("presets")
        for presets_item_data in (_presets):
            presets_item = KeyBuilderPresetsItem.from_dict(presets_item_data)



            presets.append(presets_item)


        matrix = []
        _matrix = d.pop("matrix")
        for matrix_item_data in (_matrix):
            matrix_item = KeyBuilderMatrixItem.from_dict(matrix_item_data)



            matrix.append(matrix_item)


        policy = CredentialPolicy.from_dict(d.pop("policy"))




        key_builder = cls(
            enabled=enabled,
            presets=presets,
            matrix=matrix,
            policy=policy,
        )


        key_builder.additional_properties = d
        return key_builder

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
