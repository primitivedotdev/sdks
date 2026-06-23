from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="X402NonceBinding")



@_attrs_define
class X402NonceBinding:
    """ The interaction binding the payer hashes into the EIP-3009 nonce
    (`deriveEip3009Nonce`). Pinning the nonce to this binding is what lets an
    x402 payment ride asynchronous transports safely: a replayed challenge
    can't redirect funds and a signed payment can't settle twice.

        Attributes:
            interaction_id (str): Interaction id, including its `@domain` part.
            challenge_step_id (UUID):
            challenge_nonce (str): 32 random bytes as 64 lowercase hex chars.
     """

    interaction_id: str
    challenge_step_id: UUID
    challenge_nonce: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        interaction_id = self.interaction_id

        challenge_step_id = str(self.challenge_step_id)

        challenge_nonce = self.challenge_nonce


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "interaction_id": interaction_id,
            "challenge_step_id": challenge_step_id,
            "challenge_nonce": challenge_nonce,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        interaction_id = d.pop("interaction_id")

        challenge_step_id = UUID(d.pop("challenge_step_id"))




        challenge_nonce = d.pop("challenge_nonce")

        x402_nonce_binding = cls(
            interaction_id=interaction_id,
            challenge_step_id=challenge_step_id,
            challenge_nonce=challenge_nonce,
        )


        x402_nonce_binding.additional_properties = d
        return x402_nonce_binding

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
