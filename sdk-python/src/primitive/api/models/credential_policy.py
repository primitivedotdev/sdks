from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credential_policy_cli_access import CredentialPolicyCliAccess
from ..models.credential_policy_super_admin_key_creators import CredentialPolicySuperAdminKeyCreators
from typing import cast






T = TypeVar("T", bound="CredentialPolicy")



@_attrs_define
class CredentialPolicy:
    """ 
        Attributes:
            max_key_lifetime_days (int | None):
            require_key_expiry (bool):
            super_admin_key_creators (CredentialPolicySuperAdminKeyCreators):
            members_may_mint_keys (bool):
            allow_org_mail_scope_keys (bool):
            cap_agents_below_person (bool):
            removal_suspends_created (bool):
            oauth_consent_admin_only (bool):
            cli_access (CredentialPolicyCliAccess | Unset): Who may use the CLI in the organization. Present only where CLI
                user logins exist.
     """

    max_key_lifetime_days: int | None
    require_key_expiry: bool
    super_admin_key_creators: CredentialPolicySuperAdminKeyCreators
    members_may_mint_keys: bool
    allow_org_mail_scope_keys: bool
    cap_agents_below_person: bool
    removal_suspends_created: bool
    oauth_consent_admin_only: bool
    cli_access: CredentialPolicyCliAccess | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        max_key_lifetime_days: int | None
        max_key_lifetime_days = self.max_key_lifetime_days

        require_key_expiry = self.require_key_expiry

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
        field_dict.update(self.additional_properties)
        field_dict.update({
            "max_key_lifetime_days": max_key_lifetime_days,
            "require_key_expiry": require_key_expiry,
            "super_admin_key_creators": super_admin_key_creators,
            "members_may_mint_keys": members_may_mint_keys,
            "allow_org_mail_scope_keys": allow_org_mail_scope_keys,
            "cap_agents_below_person": cap_agents_below_person,
            "removal_suspends_created": removal_suspends_created,
            "oauth_consent_admin_only": oauth_consent_admin_only,
        })
        if cli_access is not UNSET:
            field_dict["cli_access"] = cli_access

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_max_key_lifetime_days(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        max_key_lifetime_days = _parse_max_key_lifetime_days(d.pop("max_key_lifetime_days"))


        require_key_expiry = d.pop("require_key_expiry")

        super_admin_key_creators = CredentialPolicySuperAdminKeyCreators(d.pop("super_admin_key_creators"))




        members_may_mint_keys = d.pop("members_may_mint_keys")

        allow_org_mail_scope_keys = d.pop("allow_org_mail_scope_keys")

        cap_agents_below_person = d.pop("cap_agents_below_person")

        removal_suspends_created = d.pop("removal_suspends_created")

        oauth_consent_admin_only = d.pop("oauth_consent_admin_only")

        _cli_access = d.pop("cli_access", UNSET)
        cli_access: CredentialPolicyCliAccess | Unset
        if isinstance(_cli_access,  Unset):
            cli_access = UNSET
        else:
            cli_access = CredentialPolicyCliAccess(_cli_access)




        credential_policy = cls(
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


        credential_policy.additional_properties = d
        return credential_policy

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
