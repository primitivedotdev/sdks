from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.cli_user_login_poll_result_auth_method import CliUserLoginPollResultAuthMethod
from ..models.cli_user_login_poll_result_token_type import CliUserLoginPollResultTokenType
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.cli_org_access_token import CliOrgAccessToken
  from ..models.cli_org_refusal import CliOrgRefusal





T = TypeVar("T", bound="CliUserLoginPollResult")



@_attrs_define
class CliUserLoginPollResult:
    """ A successful poll of a CLI login started with `login_kind: "user"`.
    The identity token (`prim_uat_`) and refresh token (`prim_urt_`)
    belong to the person, not to an organization: they authenticate
    only `GET /cli/orgs` and the token exchange. `org` is a ready access
    token for the organization chosen in the browser, or null with
    `org_refusal` saying why the CLI cannot be used there.

        Attributes:
            auth_method (CliUserLoginPollResultAuthMethod):
            user_grant_id (UUID):
            user_id (UUID):
            access_token (str): Identity access token for the org list and the token exchange
            refresh_token (str): Refresh token for the identity access token
            token_type (CliUserLoginPollResultTokenType):
            expires_in (int): Seconds until access_token expires
            oauth_client_id (str):
            org (CliOrgAccessToken | None):
            org_refusal (CliOrgRefusal | None):
     """

    auth_method: CliUserLoginPollResultAuthMethod
    user_grant_id: UUID
    user_id: UUID
    access_token: str
    refresh_token: str
    token_type: CliUserLoginPollResultTokenType
    expires_in: int
    oauth_client_id: str
    org: CliOrgAccessToken | None
    org_refusal: CliOrgRefusal | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.cli_org_access_token import CliOrgAccessToken # noqa: PLC0415
        from ..models.cli_org_refusal import CliOrgRefusal # noqa: PLC0415
        auth_method = self.auth_method.value

        user_grant_id = str(self.user_grant_id)

        user_id = str(self.user_id)

        access_token = self.access_token

        refresh_token = self.refresh_token

        token_type = self.token_type.value

        expires_in = self.expires_in

        oauth_client_id = self.oauth_client_id

        org: dict[str, Any] | None
        if isinstance(self.org, CliOrgAccessToken):
            org = self.org.to_dict()
        else:
            org = self.org

        org_refusal: dict[str, Any] | None
        if isinstance(self.org_refusal, CliOrgRefusal):
            org_refusal = self.org_refusal.to_dict()
        else:
            org_refusal = self.org_refusal


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "auth_method": auth_method,
            "user_grant_id": user_grant_id,
            "user_id": user_id,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": token_type,
            "expires_in": expires_in,
            "oauth_client_id": oauth_client_id,
            "org": org,
            "org_refusal": org_refusal,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.cli_org_access_token import CliOrgAccessToken # noqa: PLC0415
        from ..models.cli_org_refusal import CliOrgRefusal # noqa: PLC0415
        d = dict(src_dict)
        auth_method = CliUserLoginPollResultAuthMethod(d.pop("auth_method"))




        user_grant_id = UUID(d.pop("user_grant_id"))




        user_id = UUID(d.pop("user_id"))




        access_token = d.pop("access_token")

        refresh_token = d.pop("refresh_token")

        token_type = CliUserLoginPollResultTokenType(d.pop("token_type"))




        expires_in = d.pop("expires_in")

        oauth_client_id = d.pop("oauth_client_id")

        def _parse_org(data: object) -> CliOrgAccessToken | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                org_type_1 = CliOrgAccessToken.from_dict(data)



                return org_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CliOrgAccessToken | None, data)

        org = _parse_org(d.pop("org"))


        def _parse_org_refusal(data: object) -> CliOrgRefusal | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                org_refusal_type_1 = CliOrgRefusal.from_dict(data)



                return org_refusal_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CliOrgRefusal | None, data)

        org_refusal = _parse_org_refusal(d.pop("org_refusal"))


        cli_user_login_poll_result = cls(
            auth_method=auth_method,
            user_grant_id=user_grant_id,
            user_id=user_id,
            access_token=access_token,
            refresh_token=refresh_token,
            token_type=token_type,
            expires_in=expires_in,
            oauth_client_id=oauth_client_id,
            org=org,
            org_refusal=org_refusal,
        )


        cli_user_login_poll_result.additional_properties = d
        return cli_user_login_poll_result

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
