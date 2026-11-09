from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credentials_update_credential_policy_input_cli_access import CredentialsUpdateCredentialPolicyInputCliAccess
from ..models.credentials_update_credential_policy_input_super_admin_key_creators import CredentialsUpdateCredentialPolicyInputSuperAdminKeyCreators
from typing import cast






T = TypeVar("T", bound="CredentialsUpdateCredentialPolicyInput")



@_attrs_define
class CredentialsUpdateCredentialPolicyInput:
    """ 
        Attributes:
            max_key_lifetime_days (int | None | Unset):
            require_key_expiry (bool | Unset):
            super_admin_key_creators (CredentialsUpdateCredentialPolicyInputSuperAdminKeyCreators | Unset):
            members_may_mint_keys (bool | Unset):
            allow_org_mail_scope_keys (bool | Unset):
            cap_agents_below_person (bool | Unset):
            removal_suspends_created (bool | Unset):
            oauth_consent_admin_only (bool | Unset):
            cli_access (CredentialsUpdateCredentialPolicyInputCliAccess | Unset):
     """

    max_key_lifetime_days: int | None | Unset = UNSET
    require_key_expiry: bool | Unset = UNSET
    super_admin_key_creators: CredentialsUpdateCredentialPolicyInputSuperAdminKeyCreators | Unset = UNSET
    members_may_mint_keys: bool | Unset = UNSET
    allow_org_mail_scope_keys: bool | Unset = UNSET
    cap_agents_below_person: bool | Unset = UNSET
    removal_suspends_created: bool | Unset = UNSET
    oauth_consent_admin_only: bool | Unset = UNSET
    cli_access: CredentialsUpdateCredentialPolicyInputCliAccess | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        max_key_lifetime_days: int | None | Unset
        if isinstance(self.max_key_lifetime_days, Unset):
            max_key_lifetime_days = UNSET
        else:
            max_key_lifetime_days = self.max_key_lifetime_days

        require_key_expiry = self.require_key_expiry

        super_admin_key_creators: str | Unset = UNSET
        if not isinstance(self.super_admin_key_creators, Unset):
            super_admin_key_creators = self.super_admin_key_creators.value


        members_may_mint_keys = self.members_may_mint_keys

        allow_org_mail_scope_keys = self.allow_org_mail_scope_keys

        cap_agents_below_person = self.cap_agents_below_person

        removal_suspends_created = self.removal_suspends_created

        oauth_consent_admin_only = self.oauth_consent_admin_only

        cli_access: str | Unset = UNSET
        if not isinstance(self.cli_access, Unset):
            cli_access = self.cli_access.value



        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if max_key_lifetime_days is not UNSET:
            field_dict["max_key_lifetime_days"] = max_key_lifetime_days
        if require_key_expiry is not UNSET:
            field_dict["require_key_expiry"] = require_key_expiry
        if super_admin_key_creators is not UNSET:
            field_dict["super_admin_key_creators"] = super_admin_key_creators
        if members_may_mint_keys is not UNSET:
            field_dict["members_may_mint_keys"] = members_may_mint_keys
        if allow_org_mail_scope_keys is not UNSET:
            field_dict["allow_org_mail_scope_keys"] = allow_org_mail_scope_keys
        if cap_agents_below_person is not UNSET:
            field_dict["cap_agents_below_person"] = cap_agents_below_person
        if removal_suspends_created is not UNSET:
            field_dict["removal_suspends_created"] = removal_suspends_created
        if oauth_consent_admin_only is not UNSET:
            field_dict["oauth_consent_admin_only"] = oauth_consent_admin_only
        if cli_access is not UNSET:
            field_dict["cli_access"] = cli_access

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_max_key_lifetime_days(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        max_key_lifetime_days = _parse_max_key_lifetime_days(d.pop("max_key_lifetime_days", UNSET))


        require_key_expiry = d.pop("require_key_expiry", UNSET)

        _super_admin_key_creators = d.pop("super_admin_key_creators", UNSET)
        super_admin_key_creators: CredentialsUpdateCredentialPolicyInputSuperAdminKeyCreators | Unset
        if isinstance(_super_admin_key_creators,  Unset):
            super_admin_key_creators = UNSET
        else:
            super_admin_key_creators = CredentialsUpdateCredentialPolicyInputSuperAdminKeyCreators(_super_admin_key_creators)




        members_may_mint_keys = d.pop("members_may_mint_keys", UNSET)

        allow_org_mail_scope_keys = d.pop("allow_org_mail_scope_keys", UNSET)

        cap_agents_below_person = d.pop("cap_agents_below_person", UNSET)

        removal_suspends_created = d.pop("removal_suspends_created", UNSET)

        oauth_consent_admin_only = d.pop("oauth_consent_admin_only", UNSET)

        _cli_access = d.pop("cli_access", UNSET)
        cli_access: CredentialsUpdateCredentialPolicyInputCliAccess | Unset
        if isinstance(_cli_access,  Unset):
            cli_access = UNSET
        else:
            cli_access = CredentialsUpdateCredentialPolicyInputCliAccess(_cli_access)




        credentials_update_credential_policy_input = cls(
            max_key_lifetime_days=max_key_lifetime_days,
            require_key_expiry=require_key_expiry,
            super_admin_key_creators=super_admin_key_creators,
            members_may_mint_keys=members_may_mint_keys,
            allow_org_mail_scope_keys=allow_org_mail_scope_keys,
            cap_agents_below_person=cap_agents_below_person,
            removal_suspends_created=removal_suspends_created,
            oauth_consent_admin_only=oauth_consent_admin_only,
            cli_access=cli_access,
        )

        return credentials_update_credential_policy_input

