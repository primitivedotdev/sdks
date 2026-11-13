from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.credentials_get_key_builder_result_matrix_item import CredentialsGetKeyBuilderResultMatrixItem
  from ..models.credentials_get_key_builder_result_policy import CredentialsGetKeyBuilderResultPolicy
  from ..models.credentials_get_key_builder_result_presets_item import CredentialsGetKeyBuilderResultPresetsItem





T = TypeVar("T", bound="CredentialsGetKeyBuilderResult")



@_attrs_define
class CredentialsGetKeyBuilderResult:
    """ 
        Attributes:
            enabled (bool):
            presets (list[CredentialsGetKeyBuilderResultPresetsItem]):
            matrix (list[CredentialsGetKeyBuilderResultMatrixItem]):
            policy (CredentialsGetKeyBuilderResultPolicy):
            mail_limits_available (bool | Unset): Whether a key limited to some mail (addresses, domains or email rules)
                would be created now. While false, creating one is refused, so a client offers neither the listed-address
                presets nor a listed mail reach for a custom key.
            org_reach_available (bool | Unset): Whether the credential policy lets a new key reach every mailbox. While
                false, creating one is refused, so a client offers no preset that reaches every mailbox, and a custom key lists
                its addresses or domains. With mail_limits_available false as well, no key can be created and every preset is
                unavailable.
     """

    enabled: bool
    presets: list[CredentialsGetKeyBuilderResultPresetsItem]
    matrix: list[CredentialsGetKeyBuilderResultMatrixItem]
    policy: CredentialsGetKeyBuilderResultPolicy
    mail_limits_available: bool | Unset = UNSET
    org_reach_available: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.credentials_get_key_builder_result_matrix_item import CredentialsGetKeyBuilderResultMatrixItem # noqa: PLC0415
        from ..models.credentials_get_key_builder_result_policy import CredentialsGetKeyBuilderResultPolicy # noqa: PLC0415
        from ..models.credentials_get_key_builder_result_presets_item import CredentialsGetKeyBuilderResultPresetsItem # noqa: PLC0415
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

        mail_limits_available = self.mail_limits_available

        org_reach_available = self.org_reach_available


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "enabled": enabled,
            "presets": presets,
            "matrix": matrix,
            "policy": policy,
        })
        if mail_limits_available is not UNSET:
            field_dict["mail_limits_available"] = mail_limits_available
        if org_reach_available is not UNSET:
            field_dict["org_reach_available"] = org_reach_available

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credentials_get_key_builder_result_matrix_item import CredentialsGetKeyBuilderResultMatrixItem # noqa: PLC0415
        from ..models.credentials_get_key_builder_result_policy import CredentialsGetKeyBuilderResultPolicy # noqa: PLC0415
        from ..models.credentials_get_key_builder_result_presets_item import CredentialsGetKeyBuilderResultPresetsItem # noqa: PLC0415
        d = dict(src_dict)
        enabled = d.pop("enabled")

        presets = []
        _presets = d.pop("presets")
        for presets_item_data in (_presets):
            presets_item = CredentialsGetKeyBuilderResultPresetsItem.from_dict(presets_item_data)



            presets.append(presets_item)


        matrix = []
        _matrix = d.pop("matrix")
        for matrix_item_data in (_matrix):
            matrix_item = CredentialsGetKeyBuilderResultMatrixItem.from_dict(matrix_item_data)



            matrix.append(matrix_item)


        policy = CredentialsGetKeyBuilderResultPolicy.from_dict(d.pop("policy"))




        mail_limits_available = d.pop("mail_limits_available", UNSET)

        org_reach_available = d.pop("org_reach_available", UNSET)

        credentials_get_key_builder_result = cls(
            enabled=enabled,
            presets=presets,
            matrix=matrix,
            policy=policy,
            mail_limits_available=mail_limits_available,
            org_reach_available=org_reach_available,
        )


        credentials_get_key_builder_result.additional_properties = d
        return credentials_get_key_builder_result

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
