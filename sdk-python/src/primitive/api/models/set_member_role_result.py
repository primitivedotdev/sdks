from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.set_member_role_result_reduction_type_0 import SetMemberRoleResultReductionType0





T = TypeVar("T", bound="SetMemberRoleResult")



@_attrs_define
class SetMemberRoleResult:
    """ 
        Attributes:
            user_id (str):
            role (str):
            stored_role (str):
            reduction (None | SetMemberRoleResultReductionType0):
            role_id (str | Unset):
     """

    user_id: str
    role: str
    stored_role: str
    reduction: None | SetMemberRoleResultReductionType0
    role_id: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.set_member_role_result_reduction_type_0 import SetMemberRoleResultReductionType0 # noqa: PLC0415
        user_id = self.user_id

        role = self.role

        stored_role = self.stored_role

        reduction: dict[str, Any] | None
        if isinstance(self.reduction, SetMemberRoleResultReductionType0):
            reduction = self.reduction.to_dict()
        else:
            reduction = self.reduction

        role_id = self.role_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "user_id": user_id,
            "role": role,
            "stored_role": stored_role,
            "reduction": reduction,
        })
        if role_id is not UNSET:
            field_dict["role_id"] = role_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.set_member_role_result_reduction_type_0 import SetMemberRoleResultReductionType0 # noqa: PLC0415
        d = dict(src_dict)
        user_id = d.pop("user_id")

        role = d.pop("role")

        stored_role = d.pop("stored_role")

        def _parse_reduction(data: object) -> None | SetMemberRoleResultReductionType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                reduction_type_0 = SetMemberRoleResultReductionType0.from_dict(data)



                return reduction_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | SetMemberRoleResultReductionType0, data)

        reduction = _parse_reduction(d.pop("reduction"))


        role_id = d.pop("role_id", UNSET)

        set_member_role_result = cls(
            user_id=user_id,
            role=role,
            stored_role=stored_role,
            reduction=reduction,
            role_id=role_id,
        )


        set_member_role_result.additional_properties = d
        return set_member_role_result

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
