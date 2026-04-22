from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.send_result import SendResult





T = TypeVar("T", bound="SendEmailResponse200")



@_attrs_define
class SendEmailResponse200:
    """ 
        Attributes:
            success (bool):
            data (SendResult | Unset):
     """

    success: bool
    data: SendResult | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.send_result import SendResult
        success = self.success

        data: dict[str, Any] | Unset = UNSET
        if not isinstance(self.data, Unset):
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
        from ..models.send_result import SendResult
        d = dict(src_dict)
        success = d.pop("success")

        _data = d.pop("data", UNSET)
        data: SendResult | Unset
        if isinstance(_data,  Unset):
            data = UNSET
        else:
            data = SendResult.from_dict(_data)




        send_email_response_200 = cls(
            success=success,
            data=data,
        )


        send_email_response_200.additional_properties = d
        return send_email_response_200

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
