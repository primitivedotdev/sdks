from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_send_from_response_200_data_default_source_type_1 import GetSendFromResponse200DataDefaultSourceType1
from ..models.get_send_from_response_200_data_default_source_type_2_type_1 import GetSendFromResponse200DataDefaultSourceType2Type1
from ..models.get_send_from_response_200_data_default_source_type_3_type_1 import GetSendFromResponse200DataDefaultSourceType3Type1
from typing import cast

if TYPE_CHECKING:
  from ..models.get_send_from_response_200_data_addresses_item import GetSendFromResponse200DataAddressesItem





T = TypeVar("T", bound="GetSendFromResponse200Data")



@_attrs_define
class GetSendFromResponse200Data:
    """ 
        Attributes:
            default_from (None | str): The From a send that names none should use. Null when there is no single right
                answer; `reason` says why.
            default_source (GetSendFromResponse200DataDefaultSourceType1 | GetSendFromResponse200DataDefaultSourceType2Type1
                | GetSendFromResponse200DataDefaultSourceType3Type1 | None): Where default_from comes from. Null when
                default_from is null.
            addresses (list[GetSendFromResponse200DataAddressesItem]): Addresses this credential may send from, each one a
                send would accept as From for it, recipients aside.
            domains (list[str]): Domains at which this credential may send from any address, except one reserved to someone
                else (a member's own address, or an agent's) or left out of its grant. Never listed for a connected agent.
            reason (None | str): Why default_from is null, in plain English. Null when there is a default.
     """

    default_from: None | str
    default_source: GetSendFromResponse200DataDefaultSourceType1 | GetSendFromResponse200DataDefaultSourceType2Type1 | GetSendFromResponse200DataDefaultSourceType3Type1 | None
    addresses: list[GetSendFromResponse200DataAddressesItem]
    domains: list[str]
    reason: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_send_from_response_200_data_addresses_item import GetSendFromResponse200DataAddressesItem # noqa: PLC0415
        default_from: None | str
        default_from = self.default_from

        default_source: None | str
        if isinstance(self.default_source, GetSendFromResponse200DataDefaultSourceType1):
            default_source = self.default_source.value
        elif isinstance(self.default_source, GetSendFromResponse200DataDefaultSourceType2Type1):
            default_source = self.default_source.value
        elif isinstance(self.default_source, GetSendFromResponse200DataDefaultSourceType3Type1):
            default_source = self.default_source.value
        else:
            default_source = self.default_source

        addresses = []
        for addresses_item_data in self.addresses:
            addresses_item = addresses_item_data.to_dict()
            addresses.append(addresses_item)



        domains = self.domains



        reason: None | str
        reason = self.reason


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "default_from": default_from,
            "default_source": default_source,
            "addresses": addresses,
            "domains": domains,
            "reason": reason,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_send_from_response_200_data_addresses_item import GetSendFromResponse200DataAddressesItem # noqa: PLC0415
        d = dict(src_dict)
        def _parse_default_from(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        default_from = _parse_default_from(d.pop("default_from"))


        def _parse_default_source(data: object) -> GetSendFromResponse200DataDefaultSourceType1 | GetSendFromResponse200DataDefaultSourceType2Type1 | GetSendFromResponse200DataDefaultSourceType3Type1 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                default_source_type_1 = GetSendFromResponse200DataDefaultSourceType1(data)



                return default_source_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                default_source_type_2_type_1 = GetSendFromResponse200DataDefaultSourceType2Type1(data)



                return default_source_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                default_source_type_3_type_1 = GetSendFromResponse200DataDefaultSourceType3Type1(data)



                return default_source_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(GetSendFromResponse200DataDefaultSourceType1 | GetSendFromResponse200DataDefaultSourceType2Type1 | GetSendFromResponse200DataDefaultSourceType3Type1 | None, data)

        default_source = _parse_default_source(d.pop("default_source"))


        addresses = []
        _addresses = d.pop("addresses")
        for addresses_item_data in (_addresses):
            addresses_item = GetSendFromResponse200DataAddressesItem.from_dict(addresses_item_data)



            addresses.append(addresses_item)


        domains = cast(list[str], d.pop("domains"))


        def _parse_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        reason = _parse_reason(d.pop("reason"))


        get_send_from_response_200_data = cls(
            default_from=default_from,
            default_source=default_source,
            addresses=addresses,
            domains=domains,
            reason=reason,
        )


        get_send_from_response_200_data.additional_properties = d
        return get_send_from_response_200_data

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
