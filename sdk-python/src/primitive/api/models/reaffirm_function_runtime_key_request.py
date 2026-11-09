from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.reaffirm_function_runtime_key_request_suspended_by_type_1 import ReaffirmFunctionRuntimeKeyRequestSuspendedByType1
from ..models.reaffirm_function_runtime_key_request_suspended_by_type_2_type_1 import ReaffirmFunctionRuntimeKeyRequestSuspendedByType2Type1
from ..models.reaffirm_function_runtime_key_request_suspended_by_type_3_type_1 import ReaffirmFunctionRuntimeKeyRequestSuspendedByType3Type1
from typing import cast
import datetime






T = TypeVar("T", bound="ReaffirmFunctionRuntimeKeyRequest")



@_attrs_define
class ReaffirmFunctionRuntimeKeyRequest:
    """ 
        Attributes:
            suspended_at (datetime.datetime | Unset):
            suspended_reason (None | str | Unset):
            suspended_by (None | ReaffirmFunctionRuntimeKeyRequestSuspendedByType1 |
                ReaffirmFunctionRuntimeKeyRequestSuspendedByType2Type1 | ReaffirmFunctionRuntimeKeyRequestSuspendedByType3Type1
                | Unset):
     """

    suspended_at: datetime.datetime | Unset = UNSET
    suspended_reason: None | str | Unset = UNSET
    suspended_by: None | ReaffirmFunctionRuntimeKeyRequestSuspendedByType1 | ReaffirmFunctionRuntimeKeyRequestSuspendedByType2Type1 | ReaffirmFunctionRuntimeKeyRequestSuspendedByType3Type1 | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        suspended_at: str | Unset = UNSET
        if not isinstance(self.suspended_at, Unset):
            suspended_at = self.suspended_at.isoformat()

        suspended_reason: None | str | Unset
        if isinstance(self.suspended_reason, Unset):
            suspended_reason = UNSET
        else:
            suspended_reason = self.suspended_reason

        suspended_by: None | str | Unset
        if isinstance(self.suspended_by, Unset):
            suspended_by = UNSET
        elif isinstance(self.suspended_by, ReaffirmFunctionRuntimeKeyRequestSuspendedByType1):
            suspended_by = self.suspended_by.value
        elif isinstance(self.suspended_by, ReaffirmFunctionRuntimeKeyRequestSuspendedByType2Type1):
            suspended_by = self.suspended_by.value
        elif isinstance(self.suspended_by, ReaffirmFunctionRuntimeKeyRequestSuspendedByType3Type1):
            suspended_by = self.suspended_by.value
        else:
            suspended_by = self.suspended_by


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if suspended_at is not UNSET:
            field_dict["suspended_at"] = suspended_at
        if suspended_reason is not UNSET:
            field_dict["suspended_reason"] = suspended_reason
        if suspended_by is not UNSET:
            field_dict["suspended_by"] = suspended_by

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        _suspended_at = d.pop("suspended_at", UNSET)
        suspended_at: datetime.datetime | Unset
        if isinstance(_suspended_at,  Unset):
            suspended_at = UNSET
        else:
            suspended_at = datetime.datetime.fromisoformat(_suspended_at)




        def _parse_suspended_reason(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        suspended_reason = _parse_suspended_reason(d.pop("suspended_reason", UNSET))


        def _parse_suspended_by(data: object) -> None | ReaffirmFunctionRuntimeKeyRequestSuspendedByType1 | ReaffirmFunctionRuntimeKeyRequestSuspendedByType2Type1 | ReaffirmFunctionRuntimeKeyRequestSuspendedByType3Type1 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                suspended_by_type_1 = ReaffirmFunctionRuntimeKeyRequestSuspendedByType1(data)



                return suspended_by_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                suspended_by_type_2_type_1 = ReaffirmFunctionRuntimeKeyRequestSuspendedByType2Type1(data)



                return suspended_by_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                suspended_by_type_3_type_1 = ReaffirmFunctionRuntimeKeyRequestSuspendedByType3Type1(data)



                return suspended_by_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ReaffirmFunctionRuntimeKeyRequestSuspendedByType1 | ReaffirmFunctionRuntimeKeyRequestSuspendedByType2Type1 | ReaffirmFunctionRuntimeKeyRequestSuspendedByType3Type1 | Unset, data)

        suspended_by = _parse_suspended_by(d.pop("suspended_by", UNSET))


        reaffirm_function_runtime_key_request = cls(
            suspended_at=suspended_at,
            suspended_reason=suspended_reason,
            suspended_by=suspended_by,
        )

        return reaffirm_function_runtime_key_request

