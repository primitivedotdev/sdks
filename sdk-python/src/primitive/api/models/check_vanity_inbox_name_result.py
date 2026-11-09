from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.check_vanity_inbox_name_result_status import CheckVanityInboxNameResultStatus
from typing import cast






T = TypeVar("T", bound="CheckVanityInboxNameResult")



@_attrs_define
class CheckVanityInboxNameResult:
    """ 
        Attributes:
            status (CheckVanityInboxNameResultStatus):
            name (None | str):
            message (None | str):
     """

    status: CheckVanityInboxNameResultStatus
    name: None | str
    message: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        status = self.status.value

        name: None | str
        name = self.name

        message: None | str
        message = self.message


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "status": status,
            "name": name,
            "message": message,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        status = CheckVanityInboxNameResultStatus(d.pop("status"))




        def _parse_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        name = _parse_name(d.pop("name"))


        def _parse_message(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        message = _parse_message(d.pop("message"))


        check_vanity_inbox_name_result = cls(
            status=status,
            name=name,
            message=message,
        )


        check_vanity_inbox_name_result.additional_properties = d
        return check_vanity_inbox_name_result

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
