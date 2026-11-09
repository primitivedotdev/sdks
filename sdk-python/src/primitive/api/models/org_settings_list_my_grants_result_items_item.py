from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.org_settings_list_my_grants_result_items_item_kind import OrgSettingsListMyGrantsResultItemsItemKind
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.org_settings_list_my_grants_result_items_item_client_type_0 import OrgSettingsListMyGrantsResultItemsItemClientType0





T = TypeVar("T", bound="OrgSettingsListMyGrantsResultItemsItem")



@_attrs_define
class OrgSettingsListMyGrantsResultItemsItem:
    """ 
        Attributes:
            kind (OrgSettingsListMyGrantsResultItemsItemKind):
            id (str):
            client (None | OrgSettingsListMyGrantsResultItemsItemClientType0):
            device_name (None | str):
            created_at (datetime.datetime):
            last_used_at (datetime.datetime | None):
            reuse_held (bool):
            logged_out (bool):
     """

    kind: OrgSettingsListMyGrantsResultItemsItemKind
    id: str
    client: None | OrgSettingsListMyGrantsResultItemsItemClientType0
    device_name: None | str
    created_at: datetime.datetime
    last_used_at: datetime.datetime | None
    reuse_held: bool
    logged_out: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.org_settings_list_my_grants_result_items_item_client_type_0 import OrgSettingsListMyGrantsResultItemsItemClientType0 # noqa: PLC0415
        kind = self.kind.value

        id = self.id

        client: dict[str, Any] | None
        if isinstance(self.client, OrgSettingsListMyGrantsResultItemsItemClientType0):
            client = self.client.to_dict()
        else:
            client = self.client

        device_name: None | str
        device_name = self.device_name

        created_at = self.created_at.isoformat()

        last_used_at: None | str
        if isinstance(self.last_used_at, datetime.datetime):
            last_used_at = self.last_used_at.isoformat()
        else:
            last_used_at = self.last_used_at

        reuse_held = self.reuse_held

        logged_out = self.logged_out


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "id": id,
            "client": client,
            "device_name": device_name,
            "created_at": created_at,
            "last_used_at": last_used_at,
            "reuse_held": reuse_held,
            "logged_out": logged_out,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.org_settings_list_my_grants_result_items_item_client_type_0 import OrgSettingsListMyGrantsResultItemsItemClientType0 # noqa: PLC0415
        d = dict(src_dict)
        kind = OrgSettingsListMyGrantsResultItemsItemKind(d.pop("kind"))




        id = d.pop("id")

        def _parse_client(data: object) -> None | OrgSettingsListMyGrantsResultItemsItemClientType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                client_type_0 = OrgSettingsListMyGrantsResultItemsItemClientType0.from_dict(data)



                return client_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | OrgSettingsListMyGrantsResultItemsItemClientType0, data)

        client = _parse_client(d.pop("client"))


        def _parse_device_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        device_name = _parse_device_name(d.pop("device_name"))


        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




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


        reuse_held = d.pop("reuse_held")

        logged_out = d.pop("logged_out")

        org_settings_list_my_grants_result_items_item = cls(
            kind=kind,
            id=id,
            client=client,
            device_name=device_name,
            created_at=created_at,
            last_used_at=last_used_at,
            reuse_held=reuse_held,
            logged_out=logged_out,
        )


        org_settings_list_my_grants_result_items_item.additional_properties = d
        return org_settings_list_my_grants_result_items_item

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
