from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credential_kind import CredentialKind
from ..models.credential_row_actions_item import CredentialRowActionsItem
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.credential_row_client_type_0 import CredentialRowClientType0
  from ..models.credential_row_creator import CredentialRowCreator
  from ..models.credential_row_grant import CredentialRowGrant
  from ..models.key_conditions import KeyConditions





T = TypeVar("T", bound="CredentialRow")



@_attrs_define
class CredentialRow:
    """ 
        Attributes:
            kind (CredentialKind): `org_key`, `function_key`, `connected_key`, `oauth`,
                `agent_delegate`, or `cli_user_access` (a person's CLI access in the
                organization through a CLI user login, listed only where those
                logins exist).
            id (str):
            name (None | str):
            grant (CredentialRowGrant):
            creator (CredentialRowCreator):
            expires_at (datetime.datetime | None):
            flags (list[str]):
            actions (list[CredentialRowActionsItem]):
            prefix (None | str | Unset):
            client (CredentialRowClientType0 | None | Unset):
            created_at (datetime.datetime | None | Unset):
            last_used_at (datetime.datetime | None | Unset):
            last_used_ip (None | str | Unset):
            conditions (KeyConditions | None | Unset):
     """

    kind: CredentialKind
    id: str
    name: None | str
    grant: CredentialRowGrant
    creator: CredentialRowCreator
    expires_at: datetime.datetime | None
    flags: list[str]
    actions: list[CredentialRowActionsItem]
    prefix: None | str | Unset = UNSET
    client: CredentialRowClientType0 | None | Unset = UNSET
    created_at: datetime.datetime | None | Unset = UNSET
    last_used_at: datetime.datetime | None | Unset = UNSET
    last_used_ip: None | str | Unset = UNSET
    conditions: KeyConditions | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.credential_row_client_type_0 import CredentialRowClientType0 # noqa: PLC0415
        from ..models.credential_row_creator import CredentialRowCreator # noqa: PLC0415
        from ..models.credential_row_grant import CredentialRowGrant # noqa: PLC0415
        from ..models.key_conditions import KeyConditions # noqa: PLC0415
        kind = self.kind.value

        id = self.id

        name: None | str
        name = self.name

        grant = self.grant.to_dict()

        creator = self.creator.to_dict()

        expires_at: None | str
        if isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
            expires_at = self.expires_at

        flags = self.flags



        actions = []
        for actions_item_data in self.actions:
            actions_item = actions_item_data.value
            actions.append(actions_item)



        prefix: None | str | Unset
        if isinstance(self.prefix, Unset):
            prefix = UNSET
        else:
            prefix = self.prefix

        client: dict[str, Any] | None | Unset
        if isinstance(self.client, Unset):
            client = UNSET
        elif isinstance(self.client, CredentialRowClientType0):
            client = self.client.to_dict()
        else:
            client = self.client

        created_at: None | str | Unset
        if isinstance(self.created_at, Unset):
            created_at = UNSET
        elif isinstance(self.created_at, datetime.datetime):
            created_at = self.created_at.isoformat()
        else:
            created_at = self.created_at

        last_used_at: None | str | Unset
        if isinstance(self.last_used_at, Unset):
            last_used_at = UNSET
        elif isinstance(self.last_used_at, datetime.datetime):
            last_used_at = self.last_used_at.isoformat()
        else:
            last_used_at = self.last_used_at

        last_used_ip: None | str | Unset
        if isinstance(self.last_used_ip, Unset):
            last_used_ip = UNSET
        else:
            last_used_ip = self.last_used_ip

        conditions: dict[str, Any] | None | Unset
        if isinstance(self.conditions, Unset):
            conditions = UNSET
        elif isinstance(self.conditions, KeyConditions):
            conditions = self.conditions.to_dict()
        else:
            conditions = self.conditions


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "id": id,
            "name": name,
            "grant": grant,
            "creator": creator,
            "expires_at": expires_at,
            "flags": flags,
            "actions": actions,
        })
        if prefix is not UNSET:
            field_dict["prefix"] = prefix
        if client is not UNSET:
            field_dict["client"] = client
        if created_at is not UNSET:
            field_dict["created_at"] = created_at
        if last_used_at is not UNSET:
            field_dict["last_used_at"] = last_used_at
        if last_used_ip is not UNSET:
            field_dict["last_used_ip"] = last_used_ip
        if conditions is not UNSET:
            field_dict["conditions"] = conditions

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credential_row_client_type_0 import CredentialRowClientType0 # noqa: PLC0415
        from ..models.credential_row_creator import CredentialRowCreator # noqa: PLC0415
        from ..models.credential_row_grant import CredentialRowGrant # noqa: PLC0415
        from ..models.key_conditions import KeyConditions # noqa: PLC0415
        d = dict(src_dict)
        kind = CredentialKind(d.pop("kind"))




        id = d.pop("id")

        def _parse_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        name = _parse_name(d.pop("name"))


        grant = CredentialRowGrant.from_dict(d.pop("grant"))




        creator = CredentialRowCreator.from_dict(d.pop("creator"))




        def _parse_expires_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                expires_at_type_0 = datetime.datetime.fromisoformat(data)



                return expires_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        expires_at = _parse_expires_at(d.pop("expires_at"))


        flags = cast(list[str], d.pop("flags"))


        actions = []
        _actions = d.pop("actions")
        for actions_item_data in (_actions):
            actions_item = CredentialRowActionsItem(actions_item_data)



            actions.append(actions_item)


        def _parse_prefix(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        prefix = _parse_prefix(d.pop("prefix", UNSET))


        def _parse_client(data: object) -> CredentialRowClientType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                client_type_0 = CredentialRowClientType0.from_dict(data)



                return client_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CredentialRowClientType0 | None | Unset, data)

        client = _parse_client(d.pop("client", UNSET))


        def _parse_created_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                created_at_type_0 = datetime.datetime.fromisoformat(data)



                return created_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        created_at = _parse_created_at(d.pop("created_at", UNSET))


        def _parse_last_used_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_used_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_used_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        last_used_at = _parse_last_used_at(d.pop("last_used_at", UNSET))


        def _parse_last_used_ip(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        last_used_ip = _parse_last_used_ip(d.pop("last_used_ip", UNSET))


        def _parse_conditions(data: object) -> KeyConditions | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                conditions_type_1 = KeyConditions.from_dict(data)



                return conditions_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(KeyConditions | None | Unset, data)

        conditions = _parse_conditions(d.pop("conditions", UNSET))


        credential_row = cls(
            kind=kind,
            id=id,
            name=name,
            grant=grant,
            creator=creator,
            expires_at=expires_at,
            flags=flags,
            actions=actions,
            prefix=prefix,
            client=client,
            created_at=created_at,
            last_used_at=last_used_at,
            last_used_ip=last_used_ip,
            conditions=conditions,
        )


        credential_row.additional_properties = d
        return credential_row

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
