from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.org_settings_list_o_auth_grants_result_items_item_client import OrgSettingsListOAuthGrantsResultItemsItemClient





T = TypeVar("T", bound="OrgSettingsListOAuthGrantsResultItemsItem")



@_attrs_define
class OrgSettingsListOAuthGrantsResultItemsItem:
    """ 
        Attributes:
            id (str):
            client (OrgSettingsListOAuthGrantsResultItemsItemClient):
            user_id (str):
            created_at (datetime.datetime):
            last_used_at (datetime.datetime | None):
            reuse_held (bool):
     """

    id: str
    client: OrgSettingsListOAuthGrantsResultItemsItemClient
    user_id: str
    created_at: datetime.datetime
    last_used_at: datetime.datetime | None
    reuse_held: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.org_settings_list_o_auth_grants_result_items_item_client import OrgSettingsListOAuthGrantsResultItemsItemClient # noqa: PLC0415
        id = self.id

        client = self.client.to_dict()

        user_id = self.user_id

        created_at = self.created_at.isoformat()

        last_used_at: None | str
        if isinstance(self.last_used_at, datetime.datetime):
            last_used_at = self.last_used_at.isoformat()
        else:
            last_used_at = self.last_used_at

        reuse_held = self.reuse_held


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "client": client,
            "user_id": user_id,
            "created_at": created_at,
            "last_used_at": last_used_at,
            "reuse_held": reuse_held,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.org_settings_list_o_auth_grants_result_items_item_client import OrgSettingsListOAuthGrantsResultItemsItemClient # noqa: PLC0415
        d = dict(src_dict)
        id = d.pop("id")

        client = OrgSettingsListOAuthGrantsResultItemsItemClient.from_dict(d.pop("client"))




        user_id = d.pop("user_id")

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

        org_settings_list_o_auth_grants_result_items_item = cls(
            id=id,
            client=client,
            user_id=user_id,
            created_at=created_at,
            last_used_at=last_used_at,
            reuse_held=reuse_held,
        )


        org_settings_list_o_auth_grants_result_items_item.additional_properties = d
        return org_settings_list_o_auth_grants_result_items_item

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
