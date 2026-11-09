from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.cli_org_refusal_reason import CliOrgRefusalReason
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="CliOrg")



@_attrs_define
class CliOrg:
    """ 
        Attributes:
            id (UUID):
            name (None | str):
            available (bool): Whether the CLI can switch to this organization.
            reason (CliOrgRefusalReason | None):
            role (None | str | Unset): Your role's key in the organization, such as a `BuiltinRoleKey` value.
            message (None | str | Unset):
     """

    id: UUID
    name: None | str
    available: bool
    reason: CliOrgRefusalReason | None
    role: None | str | Unset = UNSET
    message: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name: None | str
        name = self.name

        available = self.available

        reason: None | str
        if isinstance(self.reason, CliOrgRefusalReason):
            reason = self.reason.value
        else:
            reason = self.reason

        role: None | str | Unset
        if isinstance(self.role, Unset):
            role = UNSET
        else:
            role = self.role

        message: None | str | Unset
        if isinstance(self.message, Unset):
            message = UNSET
        else:
            message = self.message


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "available": available,
            "reason": reason,
        })
        if role is not UNSET:
            field_dict["role"] = role
        if message is not UNSET:
            field_dict["message"] = message

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        def _parse_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        name = _parse_name(d.pop("name"))


        available = d.pop("available")

        def _parse_reason(data: object) -> CliOrgRefusalReason | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                reason_type_1 = CliOrgRefusalReason(data)



                return reason_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CliOrgRefusalReason | None, data)

        reason = _parse_reason(d.pop("reason"))


        def _parse_role(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        role = _parse_role(d.pop("role", UNSET))


        def _parse_message(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        message = _parse_message(d.pop("message", UNSET))


        cli_org = cls(
            id=id,
            name=name,
            available=available,
            reason=reason,
            role=role,
            message=message,
        )


        cli_org.additional_properties = d
        return cli_org

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
