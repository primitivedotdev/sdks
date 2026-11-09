from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.function_deploy_status import FunctionDeployStatus
from ..models.function_detail_source_kind import FunctionDetailSourceKind
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.function_detail_test_readiness import FunctionDetailTestReadiness





T = TypeVar("T", bound="FunctionDetail")



@_attrs_define
class FunctionDetail:
    """ Full function record returned by getFunction.

        Attributes:
            id (UUID):
            name (str):
            code (None | str): The stored handler source, the same value as code_source. Null when the function has no
                stored code, or when the caller may not read its source.
            deploy_status (FunctionDeployStatus): Lifecycle state of the latest deploy attempt:
                  * `pending` - deploy in flight; the runtime has not yet
                    confirmed the new bundle is live.
                  * `deployed` - the running edge handler is the latest code.
                  * `failed` - the most recent deploy attempt failed; the
                    previously-live code (if any) is still running. The
                    `deploy_error` field carries the error message.
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            last_invoked_at (datetime.datetime | None): When the function last received a delivery, or null if it never has.
            invocations_24h (int): Deliveries to the function in the last 24 hours.
            invocations_total (int): Deliveries to the function over its lifetime.
            tags (list[str]): The function's tags.
            has_code (bool): Whether the function has stored source code.
            code_source (None | str): The stored handler source. Null when the function has no stored code, or when the
                caller may not read its source.
            current_deployment_id (None | UUID): The deployment serving traffic, or null before the first deploy.
            test_readiness (FunctionDetailTestReadiness): Whether a test run (testFunction) can be sent now. When ready is
                false, reason says why: no_endpoint (the function is not routed), no_inbound_domain (no domain can receive the
                test) or not_permitted (the caller may not run it). When ready is true, endpoint and domain name where the test
                lands, unless that domain is outside the caller's scope.
            deploy_error (None | str | Unset): Error message from the most recent failed deploy, or null
                after a successful deploy. Surface this to users to explain
                a `failed` status without polling.
            deployed_at (datetime.datetime | None | Unset):
            source_kind (FunctionDetailSourceKind | Unset): inline: the code is deployed through this API. github: the
                function is bound to a GitHub repository, and its code changes arrive from there.
     """

    id: UUID
    name: str
    code: None | str
    deploy_status: FunctionDeployStatus
    created_at: datetime.datetime
    updated_at: datetime.datetime
    last_invoked_at: datetime.datetime | None
    invocations_24h: int
    invocations_total: int
    tags: list[str]
    has_code: bool
    code_source: None | str
    current_deployment_id: None | UUID
    test_readiness: FunctionDetailTestReadiness
    deploy_error: None | str | Unset = UNSET
    deployed_at: datetime.datetime | None | Unset = UNSET
    source_kind: FunctionDetailSourceKind | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.function_detail_test_readiness import FunctionDetailTestReadiness # noqa: PLC0415
        id = str(self.id)

        name = self.name

        code: None | str
        code = self.code

        deploy_status = self.deploy_status.value

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        last_invoked_at: None | str
        if isinstance(self.last_invoked_at, datetime.datetime):
            last_invoked_at = self.last_invoked_at.isoformat()
        else:
            last_invoked_at = self.last_invoked_at

        invocations_24h = self.invocations_24h

        invocations_total = self.invocations_total

        tags = self.tags



        has_code = self.has_code

        code_source: None | str
        code_source = self.code_source

        current_deployment_id: None | str
        if isinstance(self.current_deployment_id, UUID):
            current_deployment_id = str(self.current_deployment_id)
        else:
            current_deployment_id = self.current_deployment_id

        test_readiness = self.test_readiness.to_dict()

        deploy_error: None | str | Unset
        if isinstance(self.deploy_error, Unset):
            deploy_error = UNSET
        else:
            deploy_error = self.deploy_error

        deployed_at: None | str | Unset
        if isinstance(self.deployed_at, Unset):
            deployed_at = UNSET
        elif isinstance(self.deployed_at, datetime.datetime):
            deployed_at = self.deployed_at.isoformat()
        else:
            deployed_at = self.deployed_at

        source_kind: str | Unset = UNSET
        if not isinstance(self.source_kind, Unset):
            source_kind = self.source_kind.value



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "code": code,
            "deploy_status": deploy_status,
            "created_at": created_at,
            "updated_at": updated_at,
            "last_invoked_at": last_invoked_at,
            "invocations_24h": invocations_24h,
            "invocations_total": invocations_total,
            "tags": tags,
            "has_code": has_code,
            "code_source": code_source,
            "current_deployment_id": current_deployment_id,
            "test_readiness": test_readiness,
        })
        if deploy_error is not UNSET:
            field_dict["deploy_error"] = deploy_error
        if deployed_at is not UNSET:
            field_dict["deployed_at"] = deployed_at
        if source_kind is not UNSET:
            field_dict["source_kind"] = source_kind

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.function_detail_test_readiness import FunctionDetailTestReadiness # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        def _parse_code(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        code = _parse_code(d.pop("code"))


        deploy_status = FunctionDeployStatus(d.pop("deploy_status"))




        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))




        def _parse_last_invoked_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_invoked_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_invoked_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_invoked_at = _parse_last_invoked_at(d.pop("last_invoked_at"))


        invocations_24h = d.pop("invocations_24h")

        invocations_total = d.pop("invocations_total")

        tags = cast(list[str], d.pop("tags"))


        has_code = d.pop("has_code")

        def _parse_code_source(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        code_source = _parse_code_source(d.pop("code_source"))


        def _parse_current_deployment_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                current_deployment_id_type_0 = UUID(data)



                return current_deployment_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        current_deployment_id = _parse_current_deployment_id(d.pop("current_deployment_id"))


        test_readiness = FunctionDetailTestReadiness.from_dict(d.pop("test_readiness"))




        def _parse_deploy_error(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        deploy_error = _parse_deploy_error(d.pop("deploy_error", UNSET))


        def _parse_deployed_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                deployed_at_type_0 = datetime.datetime.fromisoformat(data)



                return deployed_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        deployed_at = _parse_deployed_at(d.pop("deployed_at", UNSET))


        _source_kind = d.pop("source_kind", UNSET)
        source_kind: FunctionDetailSourceKind | Unset
        if isinstance(_source_kind,  Unset):
            source_kind = UNSET
        else:
            source_kind = FunctionDetailSourceKind(_source_kind)




        function_detail = cls(
            id=id,
            name=name,
            code=code,
            deploy_status=deploy_status,
            created_at=created_at,
            updated_at=updated_at,
            last_invoked_at=last_invoked_at,
            invocations_24h=invocations_24h,
            invocations_total=invocations_total,
            tags=tags,
            has_code=has_code,
            code_source=code_source,
            current_deployment_id=current_deployment_id,
            test_readiness=test_readiness,
            deploy_error=deploy_error,
            deployed_at=deployed_at,
            source_kind=source_kind,
        )


        function_detail.additional_properties = d
        return function_detail

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
