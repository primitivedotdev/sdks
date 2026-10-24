from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.caller_identity_member_address_type_0 import CallerIdentityMemberAddressType0
  from ..models.grant_description import GrantDescription
  from ..models.permission_check import PermissionCheck





T = TypeVar("T", bound="CallerIdentity")



@_attrs_define
class CallerIdentity:
    """ 
        Attributes:
            org_id (str):
            user_id (str):
            role (str):
            request_id (str):
            auth_method (None | str):
            key_id (None | str):
            member_address (CallerIdentityMemberAddressType0 | None):
            member_address_suggestion (None | str): Suggested personal address; nothing is assigned until explicitly saved.
            grant (GrantDescription | None | Unset): Present with `include=grant`. Null when the server has no grant for the
                caller.
            check (PermissionCheck | Unset): The decision `GET /whoami?check=<permission>` reports. Nothing is enforced by
                asking.
     """

    org_id: str
    user_id: str
    role: str
    request_id: str
    auth_method: None | str
    key_id: None | str
    member_address: CallerIdentityMemberAddressType0 | None
    member_address_suggestion: None | str
    grant: GrantDescription | None | Unset = UNSET
    check: PermissionCheck | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.caller_identity_member_address_type_0 import CallerIdentityMemberAddressType0 # noqa: PLC0415
        from ..models.grant_description import GrantDescription # noqa: PLC0415
        from ..models.permission_check import PermissionCheck # noqa: PLC0415
        org_id = self.org_id

        user_id = self.user_id

        role = self.role

        request_id = self.request_id

        auth_method: None | str
        auth_method = self.auth_method

        key_id: None | str
        key_id = self.key_id

        member_address: dict[str, Any] | None
        if isinstance(self.member_address, CallerIdentityMemberAddressType0):
            member_address = self.member_address.to_dict()
        else:
            member_address = self.member_address

        member_address_suggestion: None | str
        member_address_suggestion = self.member_address_suggestion

        grant: dict[str, Any] | None | Unset
        if isinstance(self.grant, Unset):
            grant = UNSET
        elif isinstance(self.grant, GrantDescription):
            grant = self.grant.to_dict()
        else:
            grant = self.grant

        check: dict[str, Any] | Unset = UNSET
        if not isinstance(self.check, Unset):
            check = self.check.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "org_id": org_id,
            "user_id": user_id,
            "role": role,
            "request_id": request_id,
            "auth_method": auth_method,
            "key_id": key_id,
            "member_address": member_address,
            "member_address_suggestion": member_address_suggestion,
        })
        if grant is not UNSET:
            field_dict["grant"] = grant
        if check is not UNSET:
            field_dict["check"] = check

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.caller_identity_member_address_type_0 import CallerIdentityMemberAddressType0 # noqa: PLC0415
        from ..models.grant_description import GrantDescription # noqa: PLC0415
        from ..models.permission_check import PermissionCheck # noqa: PLC0415
        d = dict(src_dict)
        org_id = d.pop("org_id")

        user_id = d.pop("user_id")

        role = d.pop("role")

        request_id = d.pop("request_id")

        def _parse_auth_method(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        auth_method = _parse_auth_method(d.pop("auth_method"))


        def _parse_key_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        key_id = _parse_key_id(d.pop("key_id"))


        def _parse_member_address(data: object) -> CallerIdentityMemberAddressType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                member_address_type_0 = CallerIdentityMemberAddressType0.from_dict(data)



                return member_address_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CallerIdentityMemberAddressType0 | None, data)

        member_address = _parse_member_address(d.pop("member_address"))


        def _parse_member_address_suggestion(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        member_address_suggestion = _parse_member_address_suggestion(d.pop("member_address_suggestion"))


        def _parse_grant(data: object) -> GrantDescription | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                grant_type_1 = GrantDescription.from_dict(data)



                return grant_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(GrantDescription | None | Unset, data)

        grant = _parse_grant(d.pop("grant", UNSET))


        _check = d.pop("check", UNSET)
        check: PermissionCheck | Unset
        if isinstance(_check,  Unset):
            check = UNSET
        else:
            check = PermissionCheck.from_dict(_check)




        caller_identity = cls(
            org_id=org_id,
            user_id=user_id,
            role=role,
            request_id=request_id,
            auth_method=auth_method,
            key_id=key_id,
            member_address=member_address,
            member_address_suggestion=member_address_suggestion,
            grant=grant,
            check=check,
        )


        caller_identity.additional_properties = d
        return caller_identity

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
