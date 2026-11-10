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
                suspension is lifted); expired (refused since expires_at); or inactive, for an agent connection key whose
                connection cannot act (not claimed, revoked, its domain not verified, or its owner no longer a member). A
                revoked key is not listed. An endpoint's owner_key_status reports an expired key as suspended.
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
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
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

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
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
