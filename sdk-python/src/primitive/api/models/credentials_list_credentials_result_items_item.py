from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credentials_list_credentials_result_items_item_actions_item import CredentialsListCredentialsResultItemsItemActionsItem
from ..models.credentials_list_credentials_result_items_item_kind import CredentialsListCredentialsResultItemsItemKind
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.credentials_list_credentials_result_items_item_belongs_to import CredentialsListCredentialsResultItemsItemBelongsTo
  from ..models.credentials_list_credentials_result_items_item_cli import CredentialsListCredentialsResultItemsItemCli
  from ..models.credentials_list_credentials_result_items_item_client_type_0 import CredentialsListCredentialsResultItemsItemClientType0
  from ..models.credentials_list_credentials_result_items_item_conditions_type_0 import CredentialsListCredentialsResultItemsItemConditionsType0
  from ..models.credentials_list_credentials_result_items_item_creator import CredentialsListCredentialsResultItemsItemCreator
  from ..models.credentials_list_credentials_result_items_item_grant import CredentialsListCredentialsResultItemsItemGrant





T = TypeVar("T", bound="CredentialsListCredentialsResultItemsItem")



@_attrs_define
class CredentialsListCredentialsResultItemsItem:
    """ 
        Attributes:
            kind (CredentialsListCredentialsResultItemsItemKind):
            id (str):
            name (None | str):
            prefix (None | str):
            client (CredentialsListCredentialsResultItemsItemClientType0 | None):
            grant (CredentialsListCredentialsResultItemsItemGrant):
            creator (CredentialsListCredentialsResultItemsItemCreator):
            created_at (datetime.datetime | None):
            last_used_at (datetime.datetime | None):
            last_used_ip (None | str):
            expires_at (datetime.datetime | None):
            conditions (CredentialsListCredentialsResultItemsItemConditionsType0 | None):
            flags (list[str]):
            actions (list[CredentialsListCredentialsResultItemsItemActionsItem]):
            cli (CredentialsListCredentialsResultItemsItemCli | Unset):
            belongs_to (CredentialsListCredentialsResultItemsItemBelongsTo | Unset):
     """

    kind: CredentialsListCredentialsResultItemsItemKind
    id: str
    name: None | str
    prefix: None | str
    client: CredentialsListCredentialsResultItemsItemClientType0 | None
    grant: CredentialsListCredentialsResultItemsItemGrant
    creator: CredentialsListCredentialsResultItemsItemCreator
    created_at: datetime.datetime | None
    last_used_at: datetime.datetime | None
    last_used_ip: None | str
    expires_at: datetime.datetime | None
    conditions: CredentialsListCredentialsResultItemsItemConditionsType0 | None
    flags: list[str]
    actions: list[CredentialsListCredentialsResultItemsItemActionsItem]
    cli: CredentialsListCredentialsResultItemsItemCli | Unset = UNSET
    belongs_to: CredentialsListCredentialsResultItemsItemBelongsTo | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.credentials_list_credentials_result_items_item_belongs_to import CredentialsListCredentialsResultItemsItemBelongsTo # noqa: PLC0415
        from ..models.credentials_list_credentials_result_items_item_cli import CredentialsListCredentialsResultItemsItemCli # noqa: PLC0415
        from ..models.credentials_list_credentials_result_items_item_client_type_0 import CredentialsListCredentialsResultItemsItemClientType0 # noqa: PLC0415
        from ..models.credentials_list_credentials_result_items_item_conditions_type_0 import CredentialsListCredentialsResultItemsItemConditionsType0 # noqa: PLC0415
        from ..models.credentials_list_credentials_result_items_item_creator import CredentialsListCredentialsResultItemsItemCreator # noqa: PLC0415
        from ..models.credentials_list_credentials_result_items_item_grant import CredentialsListCredentialsResultItemsItemGrant # noqa: PLC0415
        kind = self.kind.value

        id = self.id

        name: None | str
        name = self.name

        prefix: None | str
        prefix = self.prefix

        client: dict[str, Any] | None
        if isinstance(self.client, CredentialsListCredentialsResultItemsItemClientType0):
            client = self.client.to_dict()
        else:
            client = self.client

        grant = self.grant.to_dict()

        creator = self.creator.to_dict()

        created_at: None | str
        if isinstance(self.created_at, datetime.datetime):
            created_at = self.created_at.isoformat()
        else:
            created_at = self.created_at

        last_used_at: None | str
        if isinstance(self.last_used_at, datetime.datetime):
            last_used_at = self.last_used_at.isoformat()
        else:
            last_used_at = self.last_used_at

        last_used_ip: None | str
        last_used_ip = self.last_used_ip

        expires_at: None | str
        if isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
            expires_at = self.expires_at

        conditions: dict[str, Any] | None
        if isinstance(self.conditions, CredentialsListCredentialsResultItemsItemConditionsType0):
            conditions = self.conditions.to_dict()
        else:
            conditions = self.conditions

        flags = self.flags



        actions = []
        for actions_item_data in self.actions:
            actions_item = actions_item_data.value
            actions.append(actions_item)



        cli: dict[str, Any] | Unset = UNSET
        if not isinstance(self.cli, Unset):
            cli = self.cli.to_dict()

        belongs_to: dict[str, Any] | Unset = UNSET
        if not isinstance(self.belongs_to, Unset):
            belongs_to = self.belongs_to.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "id": id,
            "name": name,
            "prefix": prefix,
            "client": client,
            "grant": grant,
            "creator": creator,
            "created_at": created_at,
            "last_used_at": last_used_at,
            "last_used_ip": last_used_ip,
            "expires_at": expires_at,
            "conditions": conditions,
            "flags": flags,
            "actions": actions,
        })
        if cli is not UNSET:
            field_dict["cli"] = cli
        if belongs_to is not UNSET:
            field_dict["belongs_to"] = belongs_to

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credentials_list_credentials_result_items_item_belongs_to import CredentialsListCredentialsResultItemsItemBelongsTo # noqa: PLC0415
        from ..models.credentials_list_credentials_result_items_item_cli import CredentialsListCredentialsResultItemsItemCli # noqa: PLC0415
        from ..models.credentials_list_credentials_result_items_item_client_type_0 import CredentialsListCredentialsResultItemsItemClientType0 # noqa: PLC0415
        from ..models.credentials_list_credentials_result_items_item_conditions_type_0 import CredentialsListCredentialsResultItemsItemConditionsType0 # noqa: PLC0415
        from ..models.credentials_list_credentials_result_items_item_creator import CredentialsListCredentialsResultItemsItemCreator # noqa: PLC0415
        from ..models.credentials_list_credentials_result_items_item_grant import CredentialsListCredentialsResultItemsItemGrant # noqa: PLC0415
        d = dict(src_dict)
        kind = CredentialsListCredentialsResultItemsItemKind(d.pop("kind"))




        id = d.pop("id")

        def _parse_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        name = _parse_name(d.pop("name"))


        def _parse_prefix(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        prefix = _parse_prefix(d.pop("prefix"))


        def _parse_client(data: object) -> CredentialsListCredentialsResultItemsItemClientType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                client_type_0 = CredentialsListCredentialsResultItemsItemClientType0.from_dict(data)



                return client_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CredentialsListCredentialsResultItemsItemClientType0 | None, data)

        client = _parse_client(d.pop("client"))


        grant = CredentialsListCredentialsResultItemsItemGrant.from_dict(d.pop("grant"))




        creator = CredentialsListCredentialsResultItemsItemCreator.from_dict(d.pop("creator"))




        def _parse_created_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                created_at_type_0 = datetime.datetime.fromisoformat(data)



                return created_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        created_at = _parse_created_at(d.pop("created_at"))


        def _parse_last_used_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_used_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_used_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_used_at = _parse_last_used_at(d.pop("last_used_at"))


        def _parse_last_used_ip(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        last_used_ip = _parse_last_used_ip(d.pop("last_used_ip"))


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


        def _parse_conditions(data: object) -> CredentialsListCredentialsResultItemsItemConditionsType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                conditions_type_0 = CredentialsListCredentialsResultItemsItemConditionsType0.from_dict(data)



                return conditions_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CredentialsListCredentialsResultItemsItemConditionsType0 | None, data)

        conditions = _parse_conditions(d.pop("conditions"))


        flags = cast(list[str], d.pop("flags"))


        actions = []
        _actions = d.pop("actions")
        for actions_item_data in (_actions):
            actions_item = CredentialsListCredentialsResultItemsItemActionsItem(actions_item_data)



            actions.append(actions_item)


        _cli = d.pop("cli", UNSET)
        cli: CredentialsListCredentialsResultItemsItemCli | Unset
        if isinstance(_cli,  Unset):
            cli = UNSET
        else:
            cli = CredentialsListCredentialsResultItemsItemCli.from_dict(_cli)




        _belongs_to = d.pop("belongs_to", UNSET)
        belongs_to: CredentialsListCredentialsResultItemsItemBelongsTo | Unset
        if isinstance(_belongs_to,  Unset):
            belongs_to = UNSET
        else:
            belongs_to = CredentialsListCredentialsResultItemsItemBelongsTo.from_dict(_belongs_to)




        credentials_list_credentials_result_items_item = cls(
            kind=kind,
            id=id,
            name=name,
            prefix=prefix,
            client=client,
            grant=grant,
            creator=creator,
            created_at=created_at,
            last_used_at=last_used_at,
            last_used_ip=last_used_ip,
            expires_at=expires_at,
            conditions=conditions,
            flags=flags,
            actions=actions,
            cli=cli,
            belongs_to=belongs_to,
        )


        credentials_list_credentials_result_items_item.additional_properties = d
        return credentials_list_credentials_result_items_item

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
