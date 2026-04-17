from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.error_response_error_details_mx_conflict import ErrorResponseErrorDetailsMxConflict





T = TypeVar("T", bound="ErrorResponseErrorDetails")



@_attrs_define
class ErrorResponseErrorDetails:
    """ Optional structured data that callers can inspect to recover
    from the error. The fields present depend on `code`. Additional
    keys may be added over time without a major-version bump.

        Attributes:
            mx_conflict (ErrorResponseErrorDetailsMxConflict | Unset): Present when `code == mx_conflict`.
     """

    mx_conflict: ErrorResponseErrorDetailsMxConflict | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.error_response_error_details_mx_conflict import ErrorResponseErrorDetailsMxConflict
        mx_conflict: dict[str, Any] | Unset = UNSET
        if not isinstance(self.mx_conflict, Unset):
            mx_conflict = self.mx_conflict.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if mx_conflict is not UNSET:
            field_dict["mx_conflict"] = mx_conflict

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.error_response_error_details_mx_conflict import ErrorResponseErrorDetailsMxConflict
        d = dict(src_dict)
        _mx_conflict = d.pop("mx_conflict", UNSET)
        mx_conflict: ErrorResponseErrorDetailsMxConflict | Unset
        if isinstance(_mx_conflict,  Unset):
            mx_conflict = UNSET
        else:
            mx_conflict = ErrorResponseErrorDetailsMxConflict.from_dict(_mx_conflict)




        error_response_error_details = cls(
            mx_conflict=mx_conflict,
        )


        error_response_error_details.additional_properties = d
        return error_response_error_details

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
