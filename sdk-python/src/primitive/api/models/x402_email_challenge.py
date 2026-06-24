from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.x402_email_challenge_details import X402EmailChallengeDetails





T = TypeVar("T", bound="X402EmailChallenge")



@_attrs_define
class X402EmailChallenge:
    """ The result of issuing an email-native payment challenge. `interaction_id`
    is the real email thread id (`uuid@domain`) the payment is bound to;
    `challenge_id` is the underlying challenge record. Hand the `challenge`
    to the payer, who replies with a signed `payment` interaction step (the
    SDK `payEmailChallenge` helper builds it).

        Attributes:
            interaction_id (str): The email thread id (`uuid@domain`) the payment is bound to.
            challenge_id (UUID): The underlying challenge record id.
            challenge (X402EmailChallengeDetails): The challenge the payer needs to sign and pay, carried inside an
                email-native challenge response.
     """

    interaction_id: str
    challenge_id: UUID
    challenge: X402EmailChallengeDetails
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.x402_email_challenge_details import X402EmailChallengeDetails
        interaction_id = self.interaction_id

        challenge_id = str(self.challenge_id)

        challenge = self.challenge.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "interaction_id": interaction_id,
            "challenge_id": challenge_id,
            "challenge": challenge,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.x402_email_challenge_details import X402EmailChallengeDetails
        d = dict(src_dict)
        interaction_id = d.pop("interaction_id")

        challenge_id = UUID(d.pop("challenge_id"))




        challenge = X402EmailChallengeDetails.from_dict(d.pop("challenge"))




        x402_email_challenge = cls(
            interaction_id=interaction_id,
            challenge_id=challenge_id,
            challenge=challenge,
        )


        x402_email_challenge.additional_properties = d
        return x402_email_challenge

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
