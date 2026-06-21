from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="AgentClaimLinkResult")



@_attrs_define
class AgentClaimLinkResult:
    """ 
        Attributes:
            claim_token (str):
            claim_url (None | str): Browser URL to hand to a human, or null if no web origin is configured.
            expires_in_seconds (int):
     """

    claim_token: str
    claim_url: None | str
    expires_in_seconds: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        claim_token = self.claim_token

        claim_url: None | str
        claim_url = self.claim_url

        expires_in_seconds = self.expires_in_seconds


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "claim_token": claim_token,
            "claim_url": claim_url,
            "expires_in_seconds": expires_in_seconds,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        claim_token = d.pop("claim_token")

        def _parse_claim_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        claim_url = _parse_claim_url(d.pop("claim_url"))


        expires_in_seconds = d.pop("expires_in_seconds")

        agent_claim_link_result = cls(
            claim_token=claim_token,
            claim_url=claim_url,
            expires_in_seconds=expires_in_seconds,
        )


        agent_claim_link_result.additional_properties = d
        return agent_claim_link_result

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
