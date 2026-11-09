from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.set_function_runtime_key_request_runtime_grant_type_1 import SetFunctionRuntimeKeyRequestRuntimeGrantType1





T = TypeVar("T", bound="SetFunctionRuntimeKeyRequest")



@_attrs_define
class SetFunctionRuntimeKeyRequest:
    """ 
        Attributes:
            runtime_grant (SetFunctionRuntimeKeyRequestRuntimeGrantType1 | str | Unset):
            attached_secret_keys (list[str] | Unset):
     """

    runtime_grant: SetFunctionRuntimeKeyRequestRuntimeGrantType1 | str | Unset = UNSET
    attached_secret_keys: list[str] | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.set_function_runtime_key_request_runtime_grant_type_1 import SetFunctionRuntimeKeyRequestRuntimeGrantType1 # noqa: PLC0415
        runtime_grant: dict[str, Any] | str | Unset
        if isinstance(self.runtime_grant, Unset):
            runtime_grant = UNSET
        elif isinstance(self.runtime_grant, SetFunctionRuntimeKeyRequestRuntimeGrantType1):
            runtime_grant = self.runtime_grant.to_dict()
        else:
            runtime_grant = self.runtime_grant

        attached_secret_keys: list[str] | Unset = UNSET
        if not isinstance(self.attached_secret_keys, Unset):
            attached_secret_keys = self.attached_secret_keys




        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if runtime_grant is not UNSET:
            field_dict["runtime_grant"] = runtime_grant
        if attached_secret_keys is not UNSET:
            field_dict["attached_secret_keys"] = attached_secret_keys

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.set_function_runtime_key_request_runtime_grant_type_1 import SetFunctionRuntimeKeyRequestRuntimeGrantType1 # noqa: PLC0415
        d = dict(src_dict)
        def _parse_runtime_grant(data: object) -> SetFunctionRuntimeKeyRequestRuntimeGrantType1 | str | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                runtime_grant_type_1 = SetFunctionRuntimeKeyRequestRuntimeGrantType1.from_dict(data)



                return runtime_grant_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(SetFunctionRuntimeKeyRequestRuntimeGrantType1 | str | Unset, data)

        runtime_grant = _parse_runtime_grant(d.pop("runtime_grant", UNSET))


        attached_secret_keys = cast(list[str], d.pop("attached_secret_keys", UNSET))


        set_function_runtime_key_request = cls(
            runtime_grant=runtime_grant,
            attached_secret_keys=attached_secret_keys,
        )

        return set_function_runtime_key_request

