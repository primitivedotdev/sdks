from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.publish_agent_result_status import PublishAgentResultStatus






T = TypeVar("T", bound="PublishAgentResult")



@_attrs_define
class PublishAgentResult:
    """ 
        Attributes:
            status (PublishAgentResultStatus): approved lists immediately; requested pends owner approval.
            handle (str):
            idempotent_replay (bool): True when the publish matched an existing identical publication.
     """

    status: PublishAgentResultStatus
    handle: str
    idempotent_replay: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        status = self.status.value

        handle = self.handle

        idempotent_replay = self.idempotent_replay


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "status": status,
            "handle": handle,
            "idempotent_replay": idempotent_replay,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        status = PublishAgentResultStatus(d.pop("status"))




        handle = d.pop("handle")

        idempotent_replay = d.pop("idempotent_replay")

        publish_agent_result = cls(
            status=status,
            handle=handle,
            idempotent_replay=idempotent_replay,
        )


        publish_agent_result.additional_properties = d
        return publish_agent_result

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
