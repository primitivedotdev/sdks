from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.function_deploy_status import FunctionDeployStatus
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="FunctionDetail")



@_attrs_define
class FunctionDetail:
    """ Full function record returned by GET / PUT.

        Attributes:
            id (UUID):
            name (str):
            code (str): The bundled handler source. UTF-8 string up to 1 MiB. The
                same value most recently passed as `code` to POST or PUT.
            deploy_status (FunctionDeployStatus): Lifecycle state of the latest deploy attempt:
                  * `pending` - deploy in flight; the runtime has not yet
                    confirmed the new bundle is live.
                  * `deployed` - the running edge handler is the latest code.
                  * `failed` - the most recent deploy attempt failed; the
                    previously-live code (if any) is still running. The
                    `deploy_error` field carries the error message.
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            deploy_error (None | str | Unset): Error message from the most recent failed deploy, or null
                after a successful deploy. Surface this to users to explain
                a `failed` status without polling.
            deployed_at (datetime.datetime | None | Unset):
     """

    id: UUID
    name: str
    code: str
    deploy_status: FunctionDeployStatus
    created_at: datetime.datetime
    updated_at: datetime.datetime
    deploy_error: None | str | Unset = UNSET
    deployed_at: datetime.datetime | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        code = self.code

        deploy_status = self.deploy_status.value

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

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


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "code": code,
            "deploy_status": deploy_status,
            "created_at": created_at,
            "updated_at": updated_at,
        })
        if deploy_error is not UNSET:
            field_dict["deploy_error"] = deploy_error
        if deployed_at is not UNSET:
            field_dict["deployed_at"] = deployed_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        code = d.pop("code")

        deploy_status = FunctionDeployStatus(d.pop("deploy_status"))




        created_at = isoparse(d.pop("created_at"))




        updated_at = isoparse(d.pop("updated_at"))




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
                deployed_at_type_0 = isoparse(data)



                return deployed_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        deployed_at = _parse_deployed_at(d.pop("deployed_at", UNSET))


        function_detail = cls(
            id=id,
            name=name,
            code=code,
            deploy_status=deploy_status,
            created_at=created_at,
            updated_at=updated_at,
            deploy_error=deploy_error,
            deployed_at=deployed_at,
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
