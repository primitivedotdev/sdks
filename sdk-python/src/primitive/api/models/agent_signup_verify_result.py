from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_signup_verify_result_auth_method import AgentSignupVerifyResultAuthMethod
from ..models.agent_signup_verify_result_token_type import AgentSignupVerifyResultTokenType
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.agent_org_ref import AgentOrgRef





T = TypeVar("T", bound="AgentSignupVerifyResult")



@_attrs_define
class AgentSignupVerifyResult:
    """ 
        Attributes:
            api_key (str): Legacy alias for access_token. New CLI builds should persist access_token and refresh_token.
            key_id (UUID): Legacy alias for oauth_grant_id
            key_prefix (str): Legacy display prefix derived from access_token
            access_token (str): OAuth access token for CLI API authentication
            refresh_token (str): OAuth refresh token used by the CLI to renew access
            token_type (AgentSignupVerifyResultTokenType):
            expires_in (int): Seconds until access_token expires
            auth_method (AgentSignupVerifyResultAuthMethod):
            oauth_grant_id (UUID):
            oauth_client_id (str):
            org_id (UUID):
            org_name (None | str):
            orgs (list[AgentOrgRef]): Workspaces available to the verified email. The minted session targets `org_id`.
     """

    api_key: str
    key_id: UUID
    key_prefix: str
    access_token: str
    refresh_token: str
    token_type: AgentSignupVerifyResultTokenType
    expires_in: int
    auth_method: AgentSignupVerifyResultAuthMethod
    oauth_grant_id: UUID
    oauth_client_id: str
    org_id: UUID
    org_name: None | str
    orgs: list[AgentOrgRef]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_org_ref import AgentOrgRef
        api_key = self.api_key

        key_id = str(self.key_id)

        key_prefix = self.key_prefix

        access_token = self.access_token

        refresh_token = self.refresh_token

        token_type = self.token_type.value

        expires_in = self.expires_in

        auth_method = self.auth_method.value

        oauth_grant_id = str(self.oauth_grant_id)

        oauth_client_id = self.oauth_client_id

        org_id = str(self.org_id)

        org_name: None | str
        org_name = self.org_name

        orgs = []
        for orgs_item_data in self.orgs:
            orgs_item = orgs_item_data.to_dict()
            orgs.append(orgs_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "api_key": api_key,
            "key_id": key_id,
            "key_prefix": key_prefix,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": token_type,
            "expires_in": expires_in,
            "auth_method": auth_method,
            "oauth_grant_id": oauth_grant_id,
            "oauth_client_id": oauth_client_id,
            "org_id": org_id,
            "org_name": org_name,
            "orgs": orgs,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_org_ref import AgentOrgRef
        d = dict(src_dict)
        api_key = d.pop("api_key")

        key_id = UUID(d.pop("key_id"))




        key_prefix = d.pop("key_prefix")

        access_token = d.pop("access_token")

        refresh_token = d.pop("refresh_token")

        token_type = AgentSignupVerifyResultTokenType(d.pop("token_type"))




        expires_in = d.pop("expires_in")

        auth_method = AgentSignupVerifyResultAuthMethod(d.pop("auth_method"))




        oauth_grant_id = UUID(d.pop("oauth_grant_id"))




        oauth_client_id = d.pop("oauth_client_id")

        org_id = UUID(d.pop("org_id"))




        def _parse_org_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        org_name = _parse_org_name(d.pop("org_name"))


        orgs = []
        _orgs = d.pop("orgs")
        for orgs_item_data in (_orgs):
            orgs_item = AgentOrgRef.from_dict(orgs_item_data)



            orgs.append(orgs_item)


        agent_signup_verify_result = cls(
            api_key=api_key,
            key_id=key_id,
            key_prefix=key_prefix,
            access_token=access_token,
            refresh_token=refresh_token,
            token_type=token_type,
            expires_in=expires_in,
            auth_method=auth_method,
            oauth_grant_id=oauth_grant_id,
            oauth_client_id=oauth_client_id,
            org_id=org_id,
            org_name=org_name,
            orgs=orgs,
        )


        agent_signup_verify_result.additional_properties = d
        return agent_signup_verify_result

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
