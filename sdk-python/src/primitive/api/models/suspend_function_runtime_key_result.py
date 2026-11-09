from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.suspend_function_runtime_key_result_function_bound_key_type_1 import SuspendFunctionRuntimeKeyResultFunctionBoundKeyType1
from ..models.suspend_function_runtime_key_result_function_bound_key_type_2_type_1 import SuspendFunctionRuntimeKeyResultFunctionBoundKeyType2Type1
from ..models.suspend_function_runtime_key_result_function_bound_key_type_3_type_1 import SuspendFunctionRuntimeKeyResultFunctionBoundKeyType3Type1
from ..models.suspend_function_runtime_key_result_mode import SuspendFunctionRuntimeKeyResultMode
from ..models.suspend_function_runtime_key_result_stop_rank_type_1 import SuspendFunctionRuntimeKeyResultStopRankType1
from ..models.suspend_function_runtime_key_result_stop_rank_type_2_type_1 import SuspendFunctionRuntimeKeyResultStopRankType2Type1
from ..models.suspend_function_runtime_key_result_stop_rank_type_3_type_1 import SuspendFunctionRuntimeKeyResultStopRankType3Type1
from ..models.suspend_function_runtime_key_result_suspended_by_type_1 import SuspendFunctionRuntimeKeyResultSuspendedByType1
from ..models.suspend_function_runtime_key_result_suspended_by_type_2_type_1 import SuspendFunctionRuntimeKeyResultSuspendedByType2Type1
from ..models.suspend_function_runtime_key_result_suspended_by_type_3_type_1 import SuspendFunctionRuntimeKeyResultSuspendedByType3Type1
from typing import cast






T = TypeVar("T", bound="SuspendFunctionRuntimeKeyResult")



@_attrs_define
class SuspendFunctionRuntimeKeyResult:
    """ 
        Attributes:
            mode (SuspendFunctionRuntimeKeyResultMode):
            preset (None | str):
            permissions (list[str] | None):
            mail_scope (Any):
            attached_secret_keys (list[str] | None):
            key_prefix (None | str):
            expires_at (None | str):
            suspended_at (None | str):
            suspended_reason (None | str):
            function_bound_key (None | SuspendFunctionRuntimeKeyResultFunctionBoundKeyType1 |
                SuspendFunctionRuntimeKeyResultFunctionBoundKeyType2Type1 |
                SuspendFunctionRuntimeKeyResultFunctionBoundKeyType3Type1 | Unset):
            suspended_by (None | SuspendFunctionRuntimeKeyResultSuspendedByType1 |
                SuspendFunctionRuntimeKeyResultSuspendedByType2Type1 | SuspendFunctionRuntimeKeyResultSuspendedByType3Type1 |
                Unset):
            stop_rank (None | SuspendFunctionRuntimeKeyResultStopRankType1 |
                SuspendFunctionRuntimeKeyResultStopRankType2Type1 | SuspendFunctionRuntimeKeyResultStopRankType3Type1 | Unset):
            key_suspension_reasons (list[str] | Unset):
            transfer_stop_placed (bool | Unset):
     """

    mode: SuspendFunctionRuntimeKeyResultMode
    preset: None | str
    permissions: list[str] | None
    mail_scope: Any
    attached_secret_keys: list[str] | None
    key_prefix: None | str
    expires_at: None | str
    suspended_at: None | str
    suspended_reason: None | str
    function_bound_key: None | SuspendFunctionRuntimeKeyResultFunctionBoundKeyType1 | SuspendFunctionRuntimeKeyResultFunctionBoundKeyType2Type1 | SuspendFunctionRuntimeKeyResultFunctionBoundKeyType3Type1 | Unset = UNSET
    suspended_by: None | SuspendFunctionRuntimeKeyResultSuspendedByType1 | SuspendFunctionRuntimeKeyResultSuspendedByType2Type1 | SuspendFunctionRuntimeKeyResultSuspendedByType3Type1 | Unset = UNSET
    stop_rank: None | SuspendFunctionRuntimeKeyResultStopRankType1 | SuspendFunctionRuntimeKeyResultStopRankType2Type1 | SuspendFunctionRuntimeKeyResultStopRankType3Type1 | Unset = UNSET
    key_suspension_reasons: list[str] | Unset = UNSET
    transfer_stop_placed: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        mode = self.mode.value

        preset: None | str
        preset = self.preset

        permissions: list[str] | None
        if isinstance(self.permissions, list):
            permissions = self.permissions


        else:
            permissions = self.permissions

        mail_scope = self.mail_scope

        attached_secret_keys: list[str] | None
        if isinstance(self.attached_secret_keys, list):
            attached_secret_keys = self.attached_secret_keys


        else:
            attached_secret_keys = self.attached_secret_keys

        key_prefix: None | str
        key_prefix = self.key_prefix

        expires_at: None | str
        expires_at = self.expires_at

        suspended_at: None | str
        suspended_at = self.suspended_at

        suspended_reason: None | str
        suspended_reason = self.suspended_reason

        function_bound_key: None | str | Unset
        if isinstance(self.function_bound_key, Unset):
            function_bound_key = UNSET
        elif isinstance(self.function_bound_key, SuspendFunctionRuntimeKeyResultFunctionBoundKeyType1):
            function_bound_key = self.function_bound_key.value
        elif isinstance(self.function_bound_key, SuspendFunctionRuntimeKeyResultFunctionBoundKeyType2Type1):
            function_bound_key = self.function_bound_key.value
        elif isinstance(self.function_bound_key, SuspendFunctionRuntimeKeyResultFunctionBoundKeyType3Type1):
            function_bound_key = self.function_bound_key.value
        else:
            function_bound_key = self.function_bound_key

        suspended_by: None | str | Unset
        if isinstance(self.suspended_by, Unset):
            suspended_by = UNSET
        elif isinstance(self.suspended_by, SuspendFunctionRuntimeKeyResultSuspendedByType1):
            suspended_by = self.suspended_by.value
        elif isinstance(self.suspended_by, SuspendFunctionRuntimeKeyResultSuspendedByType2Type1):
            suspended_by = self.suspended_by.value
        elif isinstance(self.suspended_by, SuspendFunctionRuntimeKeyResultSuspendedByType3Type1):
            suspended_by = self.suspended_by.value
        else:
            suspended_by = self.suspended_by

        stop_rank: None | str | Unset
        if isinstance(self.stop_rank, Unset):
            stop_rank = UNSET
        elif isinstance(self.stop_rank, SuspendFunctionRuntimeKeyResultStopRankType1):
            stop_rank = self.stop_rank.value
        elif isinstance(self.stop_rank, SuspendFunctionRuntimeKeyResultStopRankType2Type1):
            stop_rank = self.stop_rank.value
        elif isinstance(self.stop_rank, SuspendFunctionRuntimeKeyResultStopRankType3Type1):
            stop_rank = self.stop_rank.value
        else:
            stop_rank = self.stop_rank

        key_suspension_reasons: list[str] | Unset = UNSET
        if not isinstance(self.key_suspension_reasons, Unset):
            key_suspension_reasons = self.key_suspension_reasons



        transfer_stop_placed = self.transfer_stop_placed


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "mode": mode,
            "preset": preset,
            "permissions": permissions,
            "mail_scope": mail_scope,
            "attached_secret_keys": attached_secret_keys,
            "key_prefix": key_prefix,
            "expires_at": expires_at,
            "suspended_at": suspended_at,
            "suspended_reason": suspended_reason,
        })
        if function_bound_key is not UNSET:
            field_dict["function_bound_key"] = function_bound_key
        if suspended_by is not UNSET:
            field_dict["suspended_by"] = suspended_by
        if stop_rank is not UNSET:
            field_dict["stop_rank"] = stop_rank
        if key_suspension_reasons is not UNSET:
            field_dict["key_suspension_reasons"] = key_suspension_reasons
        if transfer_stop_placed is not UNSET:
            field_dict["transfer_stop_placed"] = transfer_stop_placed

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        mode = SuspendFunctionRuntimeKeyResultMode(d.pop("mode"))




        def _parse_preset(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        preset = _parse_preset(d.pop("preset"))


        def _parse_permissions(data: object) -> list[str] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                permissions_type_0 = cast(list[str], data)

                return permissions_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None, data)

        permissions = _parse_permissions(d.pop("permissions"))


        mail_scope = d.pop("mail_scope")

        def _parse_attached_secret_keys(data: object) -> list[str] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                attached_secret_keys_type_0 = cast(list[str], data)

                return attached_secret_keys_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None, data)

        attached_secret_keys = _parse_attached_secret_keys(d.pop("attached_secret_keys"))


        def _parse_key_prefix(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        key_prefix = _parse_key_prefix(d.pop("key_prefix"))


        def _parse_expires_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        expires_at = _parse_expires_at(d.pop("expires_at"))


        def _parse_suspended_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        suspended_at = _parse_suspended_at(d.pop("suspended_at"))


        def _parse_suspended_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        suspended_reason = _parse_suspended_reason(d.pop("suspended_reason"))


        def _parse_function_bound_key(data: object) -> None | SuspendFunctionRuntimeKeyResultFunctionBoundKeyType1 | SuspendFunctionRuntimeKeyResultFunctionBoundKeyType2Type1 | SuspendFunctionRuntimeKeyResultFunctionBoundKeyType3Type1 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                function_bound_key_type_1 = SuspendFunctionRuntimeKeyResultFunctionBoundKeyType1(data)



                return function_bound_key_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                function_bound_key_type_2_type_1 = SuspendFunctionRuntimeKeyResultFunctionBoundKeyType2Type1(data)



                return function_bound_key_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                function_bound_key_type_3_type_1 = SuspendFunctionRuntimeKeyResultFunctionBoundKeyType3Type1(data)



                return function_bound_key_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | SuspendFunctionRuntimeKeyResultFunctionBoundKeyType1 | SuspendFunctionRuntimeKeyResultFunctionBoundKeyType2Type1 | SuspendFunctionRuntimeKeyResultFunctionBoundKeyType3Type1 | Unset, data)

        function_bound_key = _parse_function_bound_key(d.pop("function_bound_key", UNSET))


        def _parse_suspended_by(data: object) -> None | SuspendFunctionRuntimeKeyResultSuspendedByType1 | SuspendFunctionRuntimeKeyResultSuspendedByType2Type1 | SuspendFunctionRuntimeKeyResultSuspendedByType3Type1 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                suspended_by_type_1 = SuspendFunctionRuntimeKeyResultSuspendedByType1(data)



                return suspended_by_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                suspended_by_type_2_type_1 = SuspendFunctionRuntimeKeyResultSuspendedByType2Type1(data)



                return suspended_by_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                suspended_by_type_3_type_1 = SuspendFunctionRuntimeKeyResultSuspendedByType3Type1(data)



                return suspended_by_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | SuspendFunctionRuntimeKeyResultSuspendedByType1 | SuspendFunctionRuntimeKeyResultSuspendedByType2Type1 | SuspendFunctionRuntimeKeyResultSuspendedByType3Type1 | Unset, data)

        suspended_by = _parse_suspended_by(d.pop("suspended_by", UNSET))


        def _parse_stop_rank(data: object) -> None | SuspendFunctionRuntimeKeyResultStopRankType1 | SuspendFunctionRuntimeKeyResultStopRankType2Type1 | SuspendFunctionRuntimeKeyResultStopRankType3Type1 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                stop_rank_type_1 = SuspendFunctionRuntimeKeyResultStopRankType1(data)



                return stop_rank_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                stop_rank_type_2_type_1 = SuspendFunctionRuntimeKeyResultStopRankType2Type1(data)



                return stop_rank_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                stop_rank_type_3_type_1 = SuspendFunctionRuntimeKeyResultStopRankType3Type1(data)



                return stop_rank_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | SuspendFunctionRuntimeKeyResultStopRankType1 | SuspendFunctionRuntimeKeyResultStopRankType2Type1 | SuspendFunctionRuntimeKeyResultStopRankType3Type1 | Unset, data)

        stop_rank = _parse_stop_rank(d.pop("stop_rank", UNSET))


        key_suspension_reasons = cast(list[str], d.pop("key_suspension_reasons", UNSET))


        transfer_stop_placed = d.pop("transfer_stop_placed", UNSET)

        suspend_function_runtime_key_result = cls(
            mode=mode,
            preset=preset,
            permissions=permissions,
            mail_scope=mail_scope,
            attached_secret_keys=attached_secret_keys,
            key_prefix=key_prefix,
            expires_at=expires_at,
            suspended_at=suspended_at,
            suspended_reason=suspended_reason,
            function_bound_key=function_bound_key,
            suspended_by=suspended_by,
            stop_rank=stop_rank,
            key_suspension_reasons=key_suspension_reasons,
            transfer_stop_placed=transfer_stop_placed,
        )


        suspend_function_runtime_key_result.additional_properties = d
        return suspend_function_runtime_key_result

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
