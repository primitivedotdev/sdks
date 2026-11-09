from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.function_deploy_status import FunctionDeployStatus
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.function_build_summary import FunctionBuildSummary





T = TypeVar("T", bound="UpdateFunctionResult")



@_attrs_define
class UpdateFunctionResult:
    """ Returned by PUT /functions/{id}. A code upload answers with the function's name, timestamps and deploy result; a
    managed build (files) answers with deployment_id and build instead.

        Attributes:
            id (UUID):
            deploy_status (FunctionDeployStatus): Lifecycle state of the latest deploy attempt:
                  * `pending` - deploy in flight; the runtime has not yet
                    confirmed the new bundle is live.
                  * `deployed` - the running edge handler is the latest code.
                  * `failed` - the most recent deploy attempt failed; the
                    previously-live code (if any) is still running. The
                    `deploy_error` field carries the error message.
            name (str | Unset):
            deploy_error (None | str | Unset): Error message from the most recent failed deploy, or null.
            deployed_at (datetime.datetime | None | Unset):
            created_at (datetime.datetime | Unset):
            updated_at (datetime.datetime | Unset):
            deployment_id (UUID | Unset): The deployment this request created, when it sent files for a managed build.
            build (FunctionBuildSummary | Unset): The managed build that produced the deployment, when the request sent
                files. The response also repeats each field in camelCase; read the snake_case names.
     """

    id: UUID
    deploy_status: FunctionDeployStatus
    name: str | Unset = UNSET
    deploy_error: None | str | Unset = UNSET
    deployed_at: datetime.datetime | None | Unset = UNSET
    created_at: datetime.datetime | Unset = UNSET
    updated_at: datetime.datetime | Unset = UNSET
    deployment_id: UUID | Unset = UNSET
    build: FunctionBuildSummary | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.function_build_summary import FunctionBuildSummary # noqa: PLC0415
        id = str(self.id)

        deploy_status = self.deploy_status.value

        name = self.name

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

        created_at: str | Unset = UNSET
        if not isinstance(self.created_at, Unset):
            created_at = self.created_at.isoformat()

        updated_at: str | Unset = UNSET
        if not isinstance(self.updated_at, Unset):
            updated_at = self.updated_at.isoformat()

        deployment_id: str | Unset = UNSET
        if not isinstance(self.deployment_id, Unset):
            deployment_id = str(self.deployment_id)

        build: dict[str, Any] | Unset = UNSET
        if not isinstance(self.build, Unset):
            build = self.build.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "deploy_status": deploy_status,
        })
        if name is not UNSET:
            field_dict["name"] = name
        if deploy_error is not UNSET:
            field_dict["deploy_error"] = deploy_error
        if deployed_at is not UNSET:
            field_dict["deployed_at"] = deployed_at
        if created_at is not UNSET:
            field_dict["created_at"] = created_at
        if updated_at is not UNSET:
            field_dict["updated_at"] = updated_at
        if deployment_id is not UNSET:
            field_dict["deployment_id"] = deployment_id
        if build is not UNSET:
            field_dict["build"] = build

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.function_build_summary import FunctionBuildSummary # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        deploy_status = FunctionDeployStatus(d.pop("deploy_status"))




        name = d.pop("name", UNSET)

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


        _created_at = d.pop("created_at", UNSET)
        created_at: datetime.datetime | Unset
        if isinstance(_created_at,  Unset):
            created_at = UNSET
        else:
            created_at = datetime.datetime.fromisoformat(_created_at)




        _updated_at = d.pop("updated_at", UNSET)
        updated_at: datetime.datetime | Unset
        if isinstance(_updated_at,  Unset):
            updated_at = UNSET
        else:
            updated_at = datetime.datetime.fromisoformat(_updated_at)




        _deployment_id = d.pop("deployment_id", UNSET)
        deployment_id: UUID | Unset
        if isinstance(_deployment_id,  Unset):
            deployment_id = UNSET
        else:
            deployment_id = UUID(_deployment_id)




        _build = d.pop("build", UNSET)
        build: FunctionBuildSummary | Unset
        if isinstance(_build,  Unset):
            build = UNSET
        else:
            build = FunctionBuildSummary.from_dict(_build)




        update_function_result = cls(
            id=id,
            deploy_status=deploy_status,
            name=name,
            deploy_error=deploy_error,
            deployed_at=deployed_at,
            created_at=created_at,
            updated_at=updated_at,
            deployment_id=deployment_id,
            build=build,
        )


        update_function_result.additional_properties = d
        return update_function_result

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
