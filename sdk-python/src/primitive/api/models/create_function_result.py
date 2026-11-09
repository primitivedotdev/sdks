from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.function_deploy_status import FunctionDeployStatus
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.function_build_summary import FunctionBuildSummary





T = TypeVar("T", bound="CreateFunctionResult")



@_attrs_define
class CreateFunctionResult:
    """ Returned by POST /functions. deploy_status is pending when the request carried no code.

        Attributes:
            id (UUID):
            name (str):
            deploy_status (FunctionDeployStatus): Lifecycle state of the latest deploy attempt:
                  * `pending` - deploy in flight; the runtime has not yet
                    confirmed the new bundle is live.
                  * `deployed` - the running edge handler is the latest code.
                  * `failed` - the most recent deploy attempt failed; the
                    previously-live code (if any) is still running. The
                    `deploy_error` field carries the error message.
            deployment_id (UUID | Unset): The deployment this request created, when it sent files for a managed build.
            build (FunctionBuildSummary | Unset): The managed build that produced the deployment, when the request sent
                files. The response also repeats each field in camelCase; read the snake_case names.
     """

    id: UUID
    name: str
    deploy_status: FunctionDeployStatus
    deployment_id: UUID | Unset = UNSET
    build: FunctionBuildSummary | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.function_build_summary import FunctionBuildSummary # noqa: PLC0415
        id = str(self.id)

        name = self.name

        deploy_status = self.deploy_status.value

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
            "name": name,
            "deploy_status": deploy_status,
        })
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




        name = d.pop("name")

        deploy_status = FunctionDeployStatus(d.pop("deploy_status"))




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




        create_function_result = cls(
            id=id,
            name=name,
            deploy_status=deploy_status,
            deployment_id=deployment_id,
            build=build,
        )


        create_function_result.additional_properties = d
        return create_function_result

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
