from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.credentials_get_key_suggestion_result_areas_item import CredentialsGetKeySuggestionResultAreasItem
  from ..models.credentials_get_key_suggestion_result_mail_scope_type_0 import CredentialsGetKeySuggestionResultMailScopeType0
  from ..models.credentials_get_key_suggestion_result_matrix import CredentialsGetKeySuggestionResultMatrix
  from ..models.credentials_get_key_suggestion_result_narrowing import CredentialsGetKeySuggestionResultNarrowing
  from ..models.credentials_get_key_suggestion_result_usage import CredentialsGetKeySuggestionResultUsage
  from ..models.credentials_get_key_suggestion_result_warnings_item import CredentialsGetKeySuggestionResultWarningsItem





T = TypeVar("T", bound="CredentialsGetKeySuggestionResult")



@_attrs_define
class CredentialsGetKeySuggestionResult:
    """ 
        Attributes:
            key_id (str):
            permissions (list[str]):
            matrix (CredentialsGetKeySuggestionResultMatrix):
            calls (float):
            unmatched (float):
            covers_super_admin (bool):
            unused (bool):
            warnings (list[CredentialsGetKeySuggestionResultWarningsItem]):
            super_admin_only_calls (float | Unset):
            areas (list[CredentialsGetKeySuggestionResultAreasItem] | Unset):
            narrowing (CredentialsGetKeySuggestionResultNarrowing | Unset):
            mail_scope (CredentialsGetKeySuggestionResultMailScopeType0 | None | Unset):
            usage (CredentialsGetKeySuggestionResultUsage | Unset):
     """

    key_id: str
    permissions: list[str]
    matrix: CredentialsGetKeySuggestionResultMatrix
    calls: float
    unmatched: float
    covers_super_admin: bool
    unused: bool
    warnings: list[CredentialsGetKeySuggestionResultWarningsItem]
    super_admin_only_calls: float | Unset = UNSET
    areas: list[CredentialsGetKeySuggestionResultAreasItem] | Unset = UNSET
    narrowing: CredentialsGetKeySuggestionResultNarrowing | Unset = UNSET
    mail_scope: CredentialsGetKeySuggestionResultMailScopeType0 | None | Unset = UNSET
    usage: CredentialsGetKeySuggestionResultUsage | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.credentials_get_key_suggestion_result_areas_item import CredentialsGetKeySuggestionResultAreasItem # noqa: PLC0415
        from ..models.credentials_get_key_suggestion_result_mail_scope_type_0 import CredentialsGetKeySuggestionResultMailScopeType0 # noqa: PLC0415
        from ..models.credentials_get_key_suggestion_result_matrix import CredentialsGetKeySuggestionResultMatrix # noqa: PLC0415
        from ..models.credentials_get_key_suggestion_result_narrowing import CredentialsGetKeySuggestionResultNarrowing # noqa: PLC0415
        from ..models.credentials_get_key_suggestion_result_usage import CredentialsGetKeySuggestionResultUsage # noqa: PLC0415
        from ..models.credentials_get_key_suggestion_result_warnings_item import CredentialsGetKeySuggestionResultWarningsItem # noqa: PLC0415
        key_id = self.key_id

        permissions = self.permissions



        matrix = self.matrix.to_dict()

        calls = self.calls

        unmatched = self.unmatched

        covers_super_admin = self.covers_super_admin

        unused = self.unused

        warnings = []
        for warnings_item_data in self.warnings:
            warnings_item = warnings_item_data.to_dict()
            warnings.append(warnings_item)



        super_admin_only_calls = self.super_admin_only_calls

        areas: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.areas, Unset):
            areas = []
            for areas_item_data in self.areas:
                areas_item = areas_item_data.to_dict()
                areas.append(areas_item)



        narrowing: dict[str, Any] | Unset = UNSET
        if not isinstance(self.narrowing, Unset):
            narrowing = self.narrowing.to_dict()

        mail_scope: dict[str, Any] | None | Unset
        if isinstance(self.mail_scope, Unset):
            mail_scope = UNSET
        elif isinstance(self.mail_scope, CredentialsGetKeySuggestionResultMailScopeType0):
            mail_scope = self.mail_scope.to_dict()
        else:
            mail_scope = self.mail_scope

        usage: dict[str, Any] | Unset = UNSET
        if not isinstance(self.usage, Unset):
            usage = self.usage.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "key_id": key_id,
            "permissions": permissions,
            "matrix": matrix,
            "calls": calls,
            "unmatched": unmatched,
            "covers_super_admin": covers_super_admin,
            "unused": unused,
            "warnings": warnings,
        })
        if super_admin_only_calls is not UNSET:
            field_dict["super_admin_only_calls"] = super_admin_only_calls
        if areas is not UNSET:
            field_dict["areas"] = areas
        if narrowing is not UNSET:
            field_dict["narrowing"] = narrowing
        if mail_scope is not UNSET:
            field_dict["mail_scope"] = mail_scope
        if usage is not UNSET:
            field_dict["usage"] = usage

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credentials_get_key_suggestion_result_areas_item import CredentialsGetKeySuggestionResultAreasItem # noqa: PLC0415
        from ..models.credentials_get_key_suggestion_result_mail_scope_type_0 import CredentialsGetKeySuggestionResultMailScopeType0 # noqa: PLC0415
        from ..models.credentials_get_key_suggestion_result_matrix import CredentialsGetKeySuggestionResultMatrix # noqa: PLC0415
        from ..models.credentials_get_key_suggestion_result_narrowing import CredentialsGetKeySuggestionResultNarrowing # noqa: PLC0415
        from ..models.credentials_get_key_suggestion_result_usage import CredentialsGetKeySuggestionResultUsage # noqa: PLC0415
        from ..models.credentials_get_key_suggestion_result_warnings_item import CredentialsGetKeySuggestionResultWarningsItem # noqa: PLC0415
        d = dict(src_dict)
        key_id = d.pop("key_id")

        permissions = cast(list[str], d.pop("permissions"))


        matrix = CredentialsGetKeySuggestionResultMatrix.from_dict(d.pop("matrix"))




        calls = d.pop("calls")

        unmatched = d.pop("unmatched")

        covers_super_admin = d.pop("covers_super_admin")

        unused = d.pop("unused")

        warnings = []
        _warnings = d.pop("warnings")
        for warnings_item_data in (_warnings):
            warnings_item = CredentialsGetKeySuggestionResultWarningsItem.from_dict(warnings_item_data)



            warnings.append(warnings_item)


        super_admin_only_calls = d.pop("super_admin_only_calls", UNSET)

        _areas = d.pop("areas", UNSET)
        areas: list[CredentialsGetKeySuggestionResultAreasItem] | Unset = UNSET
        if _areas is not UNSET:
            areas = []
            for areas_item_data in _areas:
                areas_item = CredentialsGetKeySuggestionResultAreasItem.from_dict(areas_item_data)



                areas.append(areas_item)


        _narrowing = d.pop("narrowing", UNSET)
        narrowing: CredentialsGetKeySuggestionResultNarrowing | Unset
        if isinstance(_narrowing,  Unset):
            narrowing = UNSET
        else:
            narrowing = CredentialsGetKeySuggestionResultNarrowing.from_dict(_narrowing)




        def _parse_mail_scope(data: object) -> CredentialsGetKeySuggestionResultMailScopeType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                mail_scope_type_0 = CredentialsGetKeySuggestionResultMailScopeType0.from_dict(data)



                return mail_scope_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CredentialsGetKeySuggestionResultMailScopeType0 | None | Unset, data)

        mail_scope = _parse_mail_scope(d.pop("mail_scope", UNSET))


        _usage = d.pop("usage", UNSET)
        usage: CredentialsGetKeySuggestionResultUsage | Unset
        if isinstance(_usage,  Unset):
            usage = UNSET
        else:
            usage = CredentialsGetKeySuggestionResultUsage.from_dict(_usage)




        credentials_get_key_suggestion_result = cls(
            key_id=key_id,
            permissions=permissions,
            matrix=matrix,
            calls=calls,
            unmatched=unmatched,
            covers_super_admin=covers_super_admin,
            unused=unused,
            warnings=warnings,
            super_admin_only_calls=super_admin_only_calls,
            areas=areas,
            narrowing=narrowing,
            mail_scope=mail_scope,
            usage=usage,
        )


        credentials_get_key_suggestion_result.additional_properties = d
        return credentials_get_key_suggestion_result

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
