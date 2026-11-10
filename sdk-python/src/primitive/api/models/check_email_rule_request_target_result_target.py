from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="CheckEmailRuleRequestTargetResultTarget")



@_attrs_define
class CheckEmailRuleRequestTargetResultTarget:
    """ 
        Attributes:
            user_id (UUID):
            name (None | str):
            email (None | str):
     """

    user_id: UUID
    name: None | str
    email: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        user_id = str(self.user_id)

        name: None | str
        name = self.name

        email: None | str
        email = self.email


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "user_id": user_id,
            "name": name,
            "email": email,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        user_id = UUID(d.pop("user_id"))




        def _parse_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        name = _parse_name(d.pop("name"))


        def _parse_email(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        email = _parse_email(d.pop("email"))


        check_email_rule_request_target_result_target = cls(
            user_id=user_id,
            name=name,
            email=email,
        )


        check_email_rule_request_target_result_target.additional_properties = d
        return check_email_rule_request_target_result_target

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
