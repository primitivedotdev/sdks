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






T = TypeVar("T", bound="FunctionListItem")



@_attrs_define
class FunctionListItem:
    """ One row from the function listing.

        Attributes:
            id (UUID): Function id, also the script name in the edge runtime.
            name (str): Slug-style name set on creation. Stable; cannot be changed.
            deploy_status (FunctionDeployStatus): Lifecycle state of the latest deploy attempt:
                  * `pending` - deploy in flight; the runtime has not yet
                    confirmed the new bundle is live.
                  * `deployed` - the running edge handler is the latest code.
                  * `failed` - the most recent deploy attempt failed; the
                    previously-live code (if any) is still running. The
                    `deploy_error` field carries the error message.
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            deployed_at (datetime.datetime | None | Unset): Timestamp of the most recent successful deploy. Null until the
                first deploy succeeds.
     """

    id: UUID
    name: str
    deploy_status: FunctionDeployStatus
    created_at: datetime.datetime
    updated_at: datetime.datetime
    deployed_at: datetime.datetime | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        deploy_status = self.deploy_status.value

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

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
            "deploy_status": deploy_status,
            "created_at": created_at,
            "updated_at": updated_at,
        })
        if deployed_at is not UNSET:
            field_dict["deployed_at"] = deployed_at

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        deploy_status = FunctionDeployStatus(d.pop("deploy_status"))




        created_at = isoparse(d.pop("created_at"))




        updated_at = isoparse(d.pop("updated_at"))




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


        function_list_item = cls(
            id=id,
            name=name,
            deploy_status=deploy_status,
            created_at=created_at,
            updated_at=updated_at,
            deployed_at=deployed_at,
        )


        function_list_item.additional_properties = d
        return function_list_item

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
