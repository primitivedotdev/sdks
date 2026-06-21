from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="AgentClaimStartResult")



@_attrs_define
class AgentClaimStartResult:
    """ 
        Attributes:
            claim_session_id (str):
            resend_after_seconds (int):
            expires_in_seconds (int):
     """

    claim_session_id: str
    resend_after_seconds: int
    expires_in_seconds: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        claim_session_id = self.claim_session_id

        resend_after_seconds = self.resend_after_seconds

        expires_in_seconds = self.expires_in_seconds


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "claim_session_id": claim_session_id,
            "resend_after_seconds": resend_after_seconds,
            "expires_in_seconds": expires_in_seconds,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        claim_session_id = d.pop("claim_session_id")

        resend_after_seconds = d.pop("resend_after_seconds")

        expires_in_seconds = d.pop("expires_in_seconds")

        agent_claim_start_result = cls(
            claim_session_id=claim_session_id,
            resend_after_seconds=resend_after_seconds,
            expires_in_seconds=expires_in_seconds,
        )


        agent_claim_start_result.additional_properties = d
        return agent_claim_start_result

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
