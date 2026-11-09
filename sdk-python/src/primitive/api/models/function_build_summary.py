from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.function_build_summary_resolved_dependencies_item import FunctionBuildSummaryResolvedDependenciesItem





T = TypeVar("T", bound="FunctionBuildSummary")



@_attrs_define
class FunctionBuildSummary:
    """ The managed build that produced the deployment, when the request sent files. The response also repeats each field in
    camelCase; read the snake_case names.

        Attributes:
            entry_point (None | str | Unset):
            bundle_bytes (int | None | Unset):
            bundle_gzip_bytes (int | None | Unset):
            bundle_sha256 (None | str | Unset):
            bundle_sha_256 (None | str | Unset):
            source_sha256 (None | str | Unset):
            source_sha_256 (None | str | Unset):
            resolved_dependencies (list[FunctionBuildSummaryResolvedDependenciesItem] | Unset):
            warnings (list[str] | Unset):
            build_ms (float | None | Unset):
     """

    entry_point: None | str | Unset = UNSET
    bundle_bytes: int | None | Unset = UNSET
    bundle_gzip_bytes: int | None | Unset = UNSET
    bundle_sha256: None | str | Unset = UNSET
    bundle_sha_256: None | str | Unset = UNSET
    source_sha256: None | str | Unset = UNSET
    source_sha_256: None | str | Unset = UNSET
    resolved_dependencies: list[FunctionBuildSummaryResolvedDependenciesItem] | Unset = UNSET
    warnings: list[str] | Unset = UNSET
    build_ms: float | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.function_build_summary_resolved_dependencies_item import FunctionBuildSummaryResolvedDependenciesItem # noqa: PLC0415
        entry_point: None | str | Unset
        if isinstance(self.entry_point, Unset):
            entry_point = UNSET
        else:
            entry_point = self.entry_point

        bundle_bytes: int | None | Unset
        if isinstance(self.bundle_bytes, Unset):
            bundle_bytes = UNSET
        else:
            bundle_bytes = self.bundle_bytes

        bundle_gzip_bytes: int | None | Unset
        if isinstance(self.bundle_gzip_bytes, Unset):
            bundle_gzip_bytes = UNSET
        else:
            bundle_gzip_bytes = self.bundle_gzip_bytes

        bundle_sha256: None | str | Unset
        if isinstance(self.bundle_sha256, Unset):
            bundle_sha256 = UNSET
        else:
            bundle_sha256 = self.bundle_sha256

        bundle_sha_256: None | str | Unset
        if isinstance(self.bundle_sha_256, Unset):
            bundle_sha_256 = UNSET
        else:
            bundle_sha_256 = self.bundle_sha_256

        source_sha256: None | str | Unset
        if isinstance(self.source_sha256, Unset):
            source_sha256 = UNSET
        else:
            source_sha256 = self.source_sha256

        source_sha_256: None | str | Unset
        if isinstance(self.source_sha_256, Unset):
            source_sha_256 = UNSET
        else:
            source_sha_256 = self.source_sha_256

        resolved_dependencies: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.resolved_dependencies, Unset):
            resolved_dependencies = []
            for resolved_dependencies_item_data in self.resolved_dependencies:
                resolved_dependencies_item = resolved_dependencies_item_data.to_dict()
                resolved_dependencies.append(resolved_dependencies_item)



        warnings: list[str] | Unset = UNSET
        if not isinstance(self.warnings, Unset):
            warnings = self.warnings



        build_ms: float | None | Unset
        if isinstance(self.build_ms, Unset):
            build_ms = UNSET
        else:
            build_ms = self.build_ms


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if entry_point is not UNSET:
            field_dict["entry_point"] = entry_point
        if bundle_bytes is not UNSET:
            field_dict["bundle_bytes"] = bundle_bytes
        if bundle_gzip_bytes is not UNSET:
            field_dict["bundle_gzip_bytes"] = bundle_gzip_bytes
        if bundle_sha256 is not UNSET:
            field_dict["bundle_sha256"] = bundle_sha256
        if bundle_sha_256 is not UNSET:
            field_dict["bundleSha256"] = bundle_sha_256
        if source_sha256 is not UNSET:
            field_dict["source_sha256"] = source_sha256
        if source_sha_256 is not UNSET:
            field_dict["sourceSha256"] = source_sha_256
        if resolved_dependencies is not UNSET:
            field_dict["resolved_dependencies"] = resolved_dependencies
        if warnings is not UNSET:
            field_dict["warnings"] = warnings
        if build_ms is not UNSET:
            field_dict["build_ms"] = build_ms

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.function_build_summary_resolved_dependencies_item import FunctionBuildSummaryResolvedDependenciesItem # noqa: PLC0415
        d = dict(src_dict)
        def _parse_entry_point(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        entry_point = _parse_entry_point(d.pop("entry_point", UNSET))


        def _parse_bundle_bytes(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        bundle_bytes = _parse_bundle_bytes(d.pop("bundle_bytes", UNSET))


        def _parse_bundle_gzip_bytes(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        bundle_gzip_bytes = _parse_bundle_gzip_bytes(d.pop("bundle_gzip_bytes", UNSET))


        def _parse_bundle_sha256(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        bundle_sha256 = _parse_bundle_sha256(d.pop("bundle_sha256", UNSET))


        def _parse_bundle_sha_256(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        bundle_sha_256 = _parse_bundle_sha_256(d.pop("bundleSha256", UNSET))


        def _parse_source_sha256(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        source_sha256 = _parse_source_sha256(d.pop("source_sha256", UNSET))


        def _parse_source_sha_256(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        source_sha_256 = _parse_source_sha_256(d.pop("sourceSha256", UNSET))


        _resolved_dependencies = d.pop("resolved_dependencies", UNSET)
        resolved_dependencies: list[FunctionBuildSummaryResolvedDependenciesItem] | Unset = UNSET
        if _resolved_dependencies is not UNSET:
            resolved_dependencies = []
            for resolved_dependencies_item_data in _resolved_dependencies:
                resolved_dependencies_item = FunctionBuildSummaryResolvedDependenciesItem.from_dict(resolved_dependencies_item_data)



                resolved_dependencies.append(resolved_dependencies_item)


        warnings = cast(list[str], d.pop("warnings", UNSET))


        def _parse_build_ms(data: object) -> float | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(float | None | Unset, data)

        build_ms = _parse_build_ms(d.pop("build_ms", UNSET))


        function_build_summary = cls(
            entry_point=entry_point,
            bundle_bytes=bundle_bytes,
            bundle_gzip_bytes=bundle_gzip_bytes,
            bundle_sha256=bundle_sha256,
            bundle_sha_256=bundle_sha_256,
            source_sha256=source_sha256,
            source_sha_256=source_sha_256,
            resolved_dependencies=resolved_dependencies,
            warnings=warnings,
            build_ms=build_ms,
        )


        function_build_summary.additional_properties = d
        return function_build_summary

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
