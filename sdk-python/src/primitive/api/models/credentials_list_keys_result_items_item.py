from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credentials_list_keys_result_items_item_kind import CredentialsListKeysResultItemsItemKind
from ..models.credentials_list_keys_result_items_item_status import CredentialsListKeysResultItemsItemStatus
from typing import cast

if TYPE_CHECKING:
  from ..models.credentials_list_keys_result_items_item_grant import CredentialsListKeysResultItemsItemGrant





T = TypeVar("T", bound="CredentialsListKeysResultItemsItem")



@_attrs_define
class CredentialsListKeysResultItemsItem:
    """ 
        Attributes:
            id (str):
            kind (CredentialsListKeysResultItemsItemKind):
            name (None | str):
            key_prefix (str):
            grant (CredentialsListKeysResultItemsItemGrant):
            agent_address (None | str):
            created_by_user_id (None | str):
            created_at (None | str):
            last_used_at (None | str):
            expires_at (None | str):
            suspended (bool):
            status (CredentialsListKeysResultItemsItemStatus | Unset): Whether the key works now: active; suspended (refused
                until the suspension is lifted); expired (refused since expires_at); inactive, for an agent connection key whose
                connection cannot act (not claimed, revoked, its domain not verified, or its owner no longer a member); or
                revoked, which it stays for good and which no unrevoked key ever shows. A revoked key is listed only with
                include_revoked=true, and GET /v1/keys/{id} answers it. An endpoint's owner_key_status reports an expired key as
                suspended.
            revoked_at (None | str | Unset): When the key was revoked (ISO 8601); null for a key that is not revoked.
            revoked_by (None | str | Unset): The user id of the person who revoked the key from their own dashboard session,
                step-up or Primitive CLI login; null for a key that is not revoked, and for one revoked any other way (by an API
                key, another app or token, or an automatic process such as secret scanning).
     """

    id: str
    kind: CredentialsListKeysResultItemsItemKind
    name: None | str
    key_prefix: str
    grant: CredentialsListKeysResultItemsItemGrant
    agent_address: None | str
    created_by_user_id: None | str
    created_at: None | str
    last_used_at: None | str
    expires_at: None | str
    suspended: bool
    status: CredentialsListKeysResultItemsItemStatus | Unset = UNSET
    revoked_at: None | str | Unset = UNSET
    revoked_by: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.credentials_list_keys_result_items_item_grant import CredentialsListKeysResultItemsItemGrant # noqa: PLC0415
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

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credentials_list_keys_result_items_item_grant import CredentialsListKeysResultItemsItemGrant # noqa: PLC0415
        d = dict(src_dict)
        id = d.pop("id")

        kind = CredentialsListKeysResultItemsItemKind(d.pop("kind"))




        def _parse_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        name = _parse_name(d.pop("name"))


        key_prefix = d.pop("key_prefix")

        grant = CredentialsListKeysResultItemsItemGrant.from_dict(d.pop("grant"))




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
        status: CredentialsListKeysResultItemsItemStatus | Unset
        if isinstance(_status,  Unset):
            status = UNSET
        else:
            status = CredentialsListKeysResultItemsItemStatus(_status)




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


        credentials_list_keys_result_items_item = cls(
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
        )


        credentials_list_keys_result_items_item.additional_properties = d
        return credentials_list_keys_result_items_item

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
