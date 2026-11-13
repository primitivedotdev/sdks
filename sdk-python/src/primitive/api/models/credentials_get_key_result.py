from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credentials_get_key_result_kind import CredentialsGetKeyResultKind
from ..models.credentials_get_key_result_status import CredentialsGetKeyResultStatus
from typing import cast

if TYPE_CHECKING:
  from ..models.credentials_get_key_result_address_warnings_item import CredentialsGetKeyResultAddressWarningsItem
  from ..models.credentials_get_key_result_grant import CredentialsGetKeyResultGrant





T = TypeVar("T", bound="CredentialsGetKeyResult")



@_attrs_define
class CredentialsGetKeyResult:
    """ 
        Attributes:
            id (str):
            kind (CredentialsGetKeyResultKind):
            name (None | str):
            key_prefix (str):
            grant (CredentialsGetKeyResultGrant):
            agent_address (None | str):
            created_by_user_id (None | str):
            created_at (None | str):
            last_used_at (None | str):
            expires_at (None | str):
            suspended (bool):
            status (CredentialsGetKeyResultStatus | Unset): Whether the key works now: active; suspended (refused until the
                suspension is lifted); expired (refused since expires_at); inactive, for an agent connection key whose
                connection cannot act (not claimed, revoked, its domain not verified, or its owner no longer a member); or
                revoked, which it stays for good and which no unrevoked key ever shows. A revoked key is listed only with
                include_revoked=true, and GET /v1/keys/{id} answers it. An endpoint's owner_key_status reports an expired key as
                suspended.
            revoked_at (None | str | Unset): When the key was revoked (ISO 8601); null for a key that is not revoked.
            revoked_by (None | str | Unset): The user id of the person who revoked the key from their own dashboard session,
                step-up or Primitive CLI login; null for a key that is not revoked, and for one revoked any other way (by an API
                key, another app or token, or an automatic process such as secret scanning).
            rotated_from (None | str | Unset): The id of the key this key was rotated from (POST /v1/keys/{id}/rotate made
                this key in its place); null for a key not made by rotation, when the caller may not read that key, or when its
                record is gone. A revoked one is still named: GET /v1/keys/{id} answers it.
            rotated_to (None | str | Unset): The id of the newest key rotated from this key that the caller may read; null
                until it is rotated, or when the caller may read no key rotated from it. A revoked one is still named: GET
                /v1/keys/{id} answers it.
            address_warnings (list[CredentialsGetKeyResultAddressWarningsItem] | Unset): Notes on the key's grant, worked
                out from it on every read: whole_mailbox, an address or domain listed beside email rules, which the key reads in
                full; no_send_address, with address empty, a key that can send but lists only email rules. The notes that need
                the organization's mailboxes and domains (member_address, unowned_domain) are given only when the grant is
                written. Only rules not deleted and shares not ended count. Empty, or absent, for a key on a template, and empty
                for a revoked key.
     """

    id: str
    kind: CredentialsGetKeyResultKind
    name: None | str
    key_prefix: str
    grant: CredentialsGetKeyResultGrant
    agent_address: None | str
    created_by_user_id: None | str
    created_at: None | str
    last_used_at: None | str
    expires_at: None | str
    suspended: bool
    status: CredentialsGetKeyResultStatus | Unset = UNSET
    revoked_at: None | str | Unset = UNSET
    revoked_by: None | str | Unset = UNSET
    rotated_from: None | str | Unset = UNSET
    rotated_to: None | str | Unset = UNSET
    address_warnings: list[CredentialsGetKeyResultAddressWarningsItem] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.credentials_get_key_result_address_warnings_item import CredentialsGetKeyResultAddressWarningsItem # noqa: PLC0415
        from ..models.credentials_get_key_result_grant import CredentialsGetKeyResultGrant # noqa: PLC0415
        id = self.id

        kind = self.kind.value

        name: None | str
        name = self.name

        key_prefix = self.key_prefix

        grant = self.grant.to_dict()

        agent_address: None | str
        agent_address = self.agent_address

        created_by_user_id: None | str
        created_by_user_id = self.created_by_user_id

        created_at: None | str
        created_at = self.created_at

        last_used_at: None | str
        last_used_at = self.last_used_at

        expires_at: None | str
        expires_at = self.expires_at

        suspended = self.suspended

        status: str | Unset = UNSET
        if not isinstance(self.status, Unset):
            status = self.status.value


        revoked_at: None | str | Unset
        if isinstance(self.revoked_at, Unset):
            revoked_at = UNSET
        else:
            revoked_at = self.revoked_at

        revoked_by: None | str | Unset
        if isinstance(self.revoked_by, Unset):
            revoked_by = UNSET
        else:
            revoked_by = self.revoked_by

        rotated_from: None | str | Unset
        if isinstance(self.rotated_from, Unset):
            rotated_from = UNSET
        else:
            rotated_from = self.rotated_from

        rotated_to: None | str | Unset
        if isinstance(self.rotated_to, Unset):
            rotated_to = UNSET
        else:
            rotated_to = self.rotated_to

        address_warnings: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.address_warnings, Unset):
            address_warnings = []
            for address_warnings_item_data in self.address_warnings:
                address_warnings_item = address_warnings_item_data.to_dict()
                address_warnings.append(address_warnings_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "kind": kind,
            "name": name,
            "key_prefix": key_prefix,
            "grant": grant,
            "agent_address": agent_address,
            "created_by_user_id": created_by_user_id,
            "created_at": created_at,
            "last_used_at": last_used_at,
            "expires_at": expires_at,
            "suspended": suspended,
        })
        if status is not UNSET:
            field_dict["status"] = status
        if revoked_at is not UNSET:
            field_dict["revoked_at"] = revoked_at
        if revoked_by is not UNSET:
            field_dict["revoked_by"] = revoked_by
        if rotated_from is not UNSET:
            field_dict["rotated_from"] = rotated_from
        if rotated_to is not UNSET:
            field_dict["rotated_to"] = rotated_to
        if address_warnings is not UNSET:
            field_dict["address_warnings"] = address_warnings

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credentials_get_key_result_address_warnings_item import CredentialsGetKeyResultAddressWarningsItem # noqa: PLC0415
        from ..models.credentials_get_key_result_grant import CredentialsGetKeyResultGrant # noqa: PLC0415
        d = dict(src_dict)
        id = d.pop("id")

        kind = CredentialsGetKeyResultKind(d.pop("kind"))




        def _parse_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        name = _parse_name(d.pop("name"))


        key_prefix = d.pop("key_prefix")

        grant = CredentialsGetKeyResultGrant.from_dict(d.pop("grant"))




        def _parse_agent_address(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        agent_address = _parse_agent_address(d.pop("agent_address"))


        def _parse_created_by_user_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        created_by_user_id = _parse_created_by_user_id(d.pop("created_by_user_id"))


        def _parse_created_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        created_at = _parse_created_at(d.pop("created_at"))


        def _parse_last_used_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        last_used_at = _parse_last_used_at(d.pop("last_used_at"))


        def _parse_expires_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        expires_at = _parse_expires_at(d.pop("expires_at"))


        suspended = d.pop("suspended")

        _status = d.pop("status", UNSET)
        status: CredentialsGetKeyResultStatus | Unset
        if isinstance(_status,  Unset):
            status = UNSET
        else:
            status = CredentialsGetKeyResultStatus(_status)




        def _parse_revoked_at(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        revoked_at = _parse_revoked_at(d.pop("revoked_at", UNSET))


        def _parse_revoked_by(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        revoked_by = _parse_revoked_by(d.pop("revoked_by", UNSET))


        def _parse_rotated_from(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        rotated_from = _parse_rotated_from(d.pop("rotated_from", UNSET))


        def _parse_rotated_to(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        rotated_to = _parse_rotated_to(d.pop("rotated_to", UNSET))


        _address_warnings = d.pop("address_warnings", UNSET)
        address_warnings: list[CredentialsGetKeyResultAddressWarningsItem] | Unset = UNSET
        if _address_warnings is not UNSET:
            address_warnings = []
            for address_warnings_item_data in _address_warnings:
                address_warnings_item = CredentialsGetKeyResultAddressWarningsItem.from_dict(address_warnings_item_data)



                address_warnings.append(address_warnings_item)


        credentials_get_key_result = cls(
            id=id,
            kind=kind,
            name=name,
            key_prefix=key_prefix,
            grant=grant,
            agent_address=agent_address,
            created_by_user_id=created_by_user_id,
            created_at=created_at,
            last_used_at=last_used_at,
            expires_at=expires_at,
            suspended=suspended,
            status=status,
            revoked_at=revoked_at,
            revoked_by=revoked_by,
            rotated_from=rotated_from,
            rotated_to=rotated_to,
            address_warnings=address_warnings,
        )


        credentials_get_key_result.additional_properties = d
        return credentials_get_key_result

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
