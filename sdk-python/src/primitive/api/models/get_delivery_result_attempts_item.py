from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="GetDeliveryResultAttemptsItem")



@_attrs_define
class GetDeliveryResultAttemptsItem:
    """ 
        Attributes:
            id (str):
            attempt_count (int):
            status (str):
            last_error_code (None | str):
            duration_ms (int | None):
            created_at (str):
     """

    id: str
    attempt_count: int
    status: str
    last_error_code: None | str
    duration_ms: int | None
    created_at: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        attempt_count = self.attempt_count

        status = self.status

        last_error_code: None | str
        last_error_code = self.last_error_code

        duration_ms: int | None
        duration_ms = self.duration_ms

        created_at = self.created_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "attempt_count": attempt_count,
            "status": status,
            "last_error_code": last_error_code,
            "duration_ms": duration_ms,
            "created_at": created_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        attempt_count = d.pop("attempt_count")

        status = d.pop("status")

        def _parse_last_error_code(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        last_error_code = _parse_last_error_code(d.pop("last_error_code"))


        def _parse_duration_ms(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        duration_ms = _parse_duration_ms(d.pop("duration_ms"))


        created_at = d.pop("created_at")

        get_delivery_result_attempts_item = cls(
            id=id,
            attempt_count=attempt_count,
            status=status,
            last_error_code=last_error_code,
            duration_ms=duration_ms,
            created_at=created_at,
        )


        get_delivery_result_attempts_item.additional_properties = d
        return get_delivery_result_attempts_item

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
