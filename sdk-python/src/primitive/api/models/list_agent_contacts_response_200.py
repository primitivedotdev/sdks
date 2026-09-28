from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.list_agent_contacts_response_200_data_item import ListAgentContactsResponse200DataItem
  from ..models.list_agent_contacts_response_200_meta import ListAgentContactsResponse200Meta





T = TypeVar("T", bound="ListAgentContactsResponse200")



@_attrs_define
class ListAgentContactsResponse200:
    """ 
        Attributes:
            success (bool):
            data (list[ListAgentContactsResponse200DataItem]):
            meta (ListAgentContactsResponse200Meta | Unset):
     """

    success: bool
    data: list[ListAgentContactsResponse200DataItem]
    meta: ListAgentContactsResponse200Meta | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_agent_contacts_response_200_data_item import ListAgentContactsResponse200DataItem
        from ..models.list_agent_contacts_response_200_meta import ListAgentContactsResponse200Meta
        success = self.success

        data = []
        for data_item_data in self.data:
            data_item = data_item_data.to_dict()
            data.append(data_item)



        meta: dict[str, Any] | Unset = UNSET
        if not isinstance(self.meta, Unset):
            meta = self.meta.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "success": success,
            "data": data,
        })
        if meta is not UNSET:
            field_dict["meta"] = meta

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_agent_contacts_response_200_data_item import ListAgentContactsResponse200DataItem
        from ..models.list_agent_contacts_response_200_meta import ListAgentContactsResponse200Meta
        d = dict(src_dict)
        success = d.pop("success")

        data = []
        _data = d.pop("data")
        for data_item_data in (_data):
            data_item = ListAgentContactsResponse200DataItem.from_dict(data_item_data)



            data.append(data_item)


        _meta = d.pop("meta", UNSET)
        meta: ListAgentContactsResponse200Meta | Unset
        if isinstance(_meta,  Unset):
            meta = UNSET
        else:
            meta = ListAgentContactsResponse200Meta.from_dict(_meta)




        list_agent_contacts_response_200 = cls(
            success=success,
            data=data,
            meta=meta,
        )


        list_agent_contacts_response_200.additional_properties = d
        return list_agent_contacts_response_200

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
