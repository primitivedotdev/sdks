from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.domain_verify_result_type_0 import DomainVerifyResultType0
  from ..models.domain_verify_result_type_1 import DomainVerifyResultType1





T = TypeVar("T", bound="VerifyDomainResponse200")



@_attrs_define
class VerifyDomainResponse200:
    """ 
        Attributes:
            success (bool):
            data (DomainVerifyResultType0 | DomainVerifyResultType1 | Unset):
     """

    success: bool
    data: DomainVerifyResultType0 | DomainVerifyResultType1 | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.domain_verify_result_type_0 import DomainVerifyResultType0
        from ..models.domain_verify_result_type_1 import DomainVerifyResultType1
        success = self.success

        data: dict[str, Any] | Unset
        if isinstance(self.data, Unset):
            data = UNSET
        elif isinstance(self.data, DomainVerifyResultType0):
            data = self.data.to_dict()
        else:
            data = self.data.to_dict()



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
        from ..models.domain_verify_result_type_0 import DomainVerifyResultType0
        from ..models.domain_verify_result_type_1 import DomainVerifyResultType1
        d = dict(src_dict)
        success = d.pop("success")

        def _parse_data(data: object) -> DomainVerifyResultType0 | DomainVerifyResultType1 | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_domain_verify_result_type_0 = DomainVerifyResultType0.from_dict(data)



                return componentsschemas_domain_verify_result_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_domain_verify_result_type_1 = DomainVerifyResultType1.from_dict(data)



            return componentsschemas_domain_verify_result_type_1

        data = _parse_data(d.pop("data", UNSET))


        verify_domain_response_200 = cls(
            success=success,
            data=data,
        )


        verify_domain_response_200.additional_properties = d
        return verify_domain_response_200

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
