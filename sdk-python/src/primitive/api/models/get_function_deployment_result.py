from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_function_deployment_result_source_kind import GetFunctionDeploymentResultSourceKind
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="GetFunctionDeploymentResult")



@_attrs_define
class GetFunctionDeploymentResult:
    """ 
        Attributes:
            id (UUID):
            status (str):
            deploy_error (None | str):
            started_at (datetime.datetime):
            finished_at (datetime.datetime | None):
            duration_ms (float | None):
            is_current (bool):
            source_kind (GetFunctionDeploymentResultSourceKind):
            entry_point (None | str):
            bundle_bytes (float | None):
            bundle_gzip_bytes (float | None):
            build_ms (float | None):
            bundle_sha256 (None | str):
            source_sha256 (None | str):
            builder_version (None | str):
     """

    id: UUID
    status: str
    deploy_error: None | str
    started_at: datetime.datetime
    finished_at: datetime.datetime | None
    duration_ms: float | None
    is_current: bool
    source_kind: GetFunctionDeploymentResultSourceKind
    entry_point: None | str
    bundle_bytes: float | None
    bundle_gzip_bytes: float | None
    build_ms: float | None
    bundle_sha256: None | str
    source_sha256: None | str
    builder_version: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        status = self.status

        deploy_error: None | str
        deploy_error = self.deploy_error

        started_at = self.started_at.isoformat()

        finished_at: None | str
        if isinstance(self.finished_at, datetime.datetime):
            finished_at = self.finished_at.isoformat()
        else:
            finished_at = self.finished_at

        duration_ms: float | None
        duration_ms = self.duration_ms

        is_current = self.is_current

        source_kind = self.source_kind.value

        entry_point: None | str
        entry_point = self.entry_point

        bundle_bytes: float | None
        bundle_bytes = self.bundle_bytes

        bundle_gzip_bytes: float | None
        bundle_gzip_bytes = self.bundle_gzip_bytes

        build_ms: float | None
        build_ms = self.build_ms

        bundle_sha256: None | str
        bundle_sha256 = self.bundle_sha256

        source_sha256: None | str
        source_sha256 = self.source_sha256

        builder_version: None | str
        builder_version = self.builder_version


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "status": status,
            "deploy_error": deploy_error,
            "started_at": started_at,
            "finished_at": finished_at,
            "duration_ms": duration_ms,
            "is_current": is_current,
            "source_kind": source_kind,
            "entry_point": entry_point,
            "bundle_bytes": bundle_bytes,
            "bundle_gzip_bytes": bundle_gzip_bytes,
            "build_ms": build_ms,
            "bundle_sha256": bundle_sha256,
            "source_sha256": source_sha256,
            "builder_version": builder_version,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        status = d.pop("status")

        def _parse_deploy_error(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        deploy_error = _parse_deploy_error(d.pop("deploy_error"))


        started_at = datetime.datetime.fromisoformat(d.pop("started_at"))




        def _parse_finished_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                finished_at_type_0 = datetime.datetime.fromisoformat(data)



                return finished_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        finished_at = _parse_finished_at(d.pop("finished_at"))


        def _parse_duration_ms(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        duration_ms = _parse_duration_ms(d.pop("duration_ms"))


        is_current = d.pop("is_current")

        source_kind = GetFunctionDeploymentResultSourceKind(d.pop("source_kind"))




        def _parse_entry_point(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        entry_point = _parse_entry_point(d.pop("entry_point"))


        def _parse_bundle_bytes(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        bundle_bytes = _parse_bundle_bytes(d.pop("bundle_bytes"))


        def _parse_bundle_gzip_bytes(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        bundle_gzip_bytes = _parse_bundle_gzip_bytes(d.pop("bundle_gzip_bytes"))


        def _parse_build_ms(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        build_ms = _parse_build_ms(d.pop("build_ms"))


        def _parse_bundle_sha256(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        bundle_sha256 = _parse_bundle_sha256(d.pop("bundle_sha256"))


        def _parse_source_sha256(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        source_sha256 = _parse_source_sha256(d.pop("source_sha256"))


        def _parse_builder_version(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        builder_version = _parse_builder_version(d.pop("builder_version"))


        get_function_deployment_result = cls(
            id=id,
            status=status,
            deploy_error=deploy_error,
            started_at=started_at,
            finished_at=finished_at,
            duration_ms=duration_ms,
            is_current=is_current,
            source_kind=source_kind,
            entry_point=entry_point,
            bundle_bytes=bundle_bytes,
            bundle_gzip_bytes=bundle_gzip_bytes,
            build_ms=build_ms,
            bundle_sha256=bundle_sha256,
            source_sha256=source_sha256,
            builder_version=builder_version,
        )


        get_function_deployment_result.additional_properties = d
        return get_function_deployment_result

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
