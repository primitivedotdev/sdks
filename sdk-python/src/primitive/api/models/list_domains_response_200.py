from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.unverified_domain import UnverifiedDomain
  from ..models.verified_domain import VerifiedDomain





T = TypeVar("T", bound="ListDomainsResponse200")



@_attrs_define
class ListDomainsResponse200:
    """ 
        Attributes:
            success (bool):
            data (list[UnverifiedDomain | VerifiedDomain] | Unset):
     """

    success: bool
    data: list[UnverifiedDomain | VerifiedDomain] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.unverified_domain import UnverifiedDomain
        from ..models.verified_domain import VerifiedDomain
        success = self.success

        data: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.data, Unset):
            data = []
            for data_item_data in self.data:
                data_item: dict[str, Any]
                if isinstance(data_item_data, VerifiedDomain):
                    data_item = data_item_data.to_dict()
                else:
                    data_item = data_item_data.to_dict()

                data.append(data_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "success": success,
        })
        if data is not UNSET:
            field_dict["data"] = data

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.unverified_domain import UnverifiedDomain
        from ..models.verified_domain import VerifiedDomain
        d = dict(src_dict)
        success = d.pop("success")

        _data = d.pop("data", UNSET)
        data: list[UnverifiedDomain | VerifiedDomain] | Unset = UNSET
        if _data is not UNSET:
            data = []
            for data_item_data in _data:
                def _parse_data_item(data: object) -> UnverifiedDomain | VerifiedDomain:
                    try:
                        if not isinstance(data, dict):
                            raise TypeError()
                        componentsschemas_domain_type_0 = VerifiedDomain.from_dict(data)



                        return componentsschemas_domain_type_0
                    except (TypeError, ValueError, AttributeError, KeyError):
                        pass
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_domain_type_1 = UnverifiedDomain.from_dict(data)



                    return componentsschemas_domain_type_1

                data_item = _parse_data_item(data_item_data)

                data.append(data_item)


        list_domains_response_200 = cls(
            success=success,
            data=data,
        )


        list_domains_response_200.additional_properties = d
        return list_domains_response_200

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
