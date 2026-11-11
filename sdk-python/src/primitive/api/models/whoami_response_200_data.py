from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.whoami_response_200_data_check import WhoamiResponse200DataCheck
  from ..models.whoami_response_200_data_grant_type_0 import WhoamiResponse200DataGrantType0
  from ..models.whoami_response_200_data_member_address_type_0 import WhoamiResponse200DataMemberAddressType0





T = TypeVar("T", bound="WhoamiResponse200Data")



@_attrs_define
class WhoamiResponse200Data:
    """ 
        Attributes:
            member_address (None | WhoamiResponse200DataMemberAddressType0):
            member_address_suggestion (None | str):
            org_id (UUID):
            user_id (str):
            role (str):
            request_id (str):
            auth_method (None | str):
            key_id (None | str):
            email (None | str): Your own sign-in email, when you are signed in as yourself: in the dashboard, or with your
                own Primitive CLI or app login. Null for API keys, Functions, connected agents, agent signup logins and other
                apps acting for you.
            role_name (None | str): Your role as the organization's members list labels it: a template or custom role as
                "<name> (template)" or "<name> (custom)", otherwise Owner, Admin, Member or Restricted. Null for the same
                credentials as email.
            grant (None | Unset | WhoamiResponse200DataGrantType0):
            check (WhoamiResponse200DataCheck | Unset):
     """

    member_address: None | WhoamiResponse200DataMemberAddressType0
    member_address_suggestion: None | str
    org_id: UUID
    user_id: str
    role: str
    request_id: str
    auth_method: None | str
    key_id: None | str
    email: None | str
    role_name: None | str
    grant: None | Unset | WhoamiResponse200DataGrantType0 = UNSET
    check: WhoamiResponse200DataCheck | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.whoami_response_200_data_check import WhoamiResponse200DataCheck # noqa: PLC0415
        from ..models.whoami_response_200_data_grant_type_0 import WhoamiResponse200DataGrantType0 # noqa: PLC0415
        from ..models.whoami_response_200_data_member_address_type_0 import WhoamiResponse200DataMemberAddressType0 # noqa: PLC0415
        member_address: dict[str, Any] | None
        if isinstance(self.member_address, WhoamiResponse200DataMemberAddressType0):
            member_address = self.member_address.to_dict()
        else:
            member_address = self.member_address

        member_address_suggestion: None | str
        member_address_suggestion = self.member_address_suggestion

        org_id = str(self.org_id)

        user_id = self.user_id

        role = self.role

        request_id = self.request_id

        auth_method: None | str
        auth_method = self.auth_method

        key_id: None | str
        key_id = self.key_id

        email: None | str
        email = self.email

        role_name: None | str
        role_name = self.role_name

        grant: dict[str, Any] | None | Unset
        if isinstance(self.grant, Unset):
            grant = UNSET
        elif isinstance(self.grant, WhoamiResponse200DataGrantType0):
            grant = self.grant.to_dict()
        else:
            grant = self.grant

        check: dict[str, Any] | Unset = UNSET
        if not isinstance(self.check, Unset):
            check = self.check.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "member_address": member_address,
            "member_address_suggestion": member_address_suggestion,
            "org_id": org_id,
            "user_id": user_id,
            "role": role,
            "request_id": request_id,
            "auth_method": auth_method,
            "key_id": key_id,
            "email": email,
            "role_name": role_name,
        })
        if grant is not UNSET:
            field_dict["grant"] = grant
        if check is not UNSET:
            field_dict["check"] = check

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.whoami_response_200_data_check import WhoamiResponse200DataCheck # noqa: PLC0415
        from ..models.whoami_response_200_data_grant_type_0 import WhoamiResponse200DataGrantType0 # noqa: PLC0415
        from ..models.whoami_response_200_data_member_address_type_0 import WhoamiResponse200DataMemberAddressType0 # noqa: PLC0415
        d = dict(src_dict)
        def _parse_member_address(data: object) -> None | WhoamiResponse200DataMemberAddressType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                member_address_type_0 = WhoamiResponse200DataMemberAddressType0.from_dict(data)



                return member_address_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | WhoamiResponse200DataMemberAddressType0, data)

        member_address = _parse_member_address(d.pop("member_address"))


        def _parse_member_address_suggestion(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        member_address_suggestion = _parse_member_address_suggestion(d.pop("member_address_suggestion"))


        org_id = UUID(d.pop("org_id"))




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


        def _parse_email(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        email = _parse_email(d.pop("email"))


        def _parse_role_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        role_name = _parse_role_name(d.pop("role_name"))


        def _parse_grant(data: object) -> None | Unset | WhoamiResponse200DataGrantType0:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                grant_type_0 = WhoamiResponse200DataGrantType0.from_dict(data)



                return grant_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | WhoamiResponse200DataGrantType0, data)

        grant = _parse_grant(d.pop("grant", UNSET))


        _check = d.pop("check", UNSET)
        check: WhoamiResponse200DataCheck | Unset
        if isinstance(_check,  Unset):
            check = UNSET
        else:
            check = WhoamiResponse200DataCheck.from_dict(_check)




        whoami_response_200_data = cls(
            member_address=member_address,
            member_address_suggestion=member_address_suggestion,
            org_id=org_id,
            user_id=user_id,
            role=role,
            request_id=request_id,
            auth_method=auth_method,
            key_id=key_id,
            email=email,
            role_name=role_name,
            grant=grant,
            check=check,
        )


        whoami_response_200_data.additional_properties = d
        return whoami_response_200_data

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
