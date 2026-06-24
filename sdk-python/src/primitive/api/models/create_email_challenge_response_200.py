from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.x402_email_challenge import X402EmailChallenge





T = TypeVar("T", bound="CreateEmailChallengeResponse200")



@_attrs_define
class CreateEmailChallengeResponse200:
    """ 
        Attributes:
            success (bool):
            data (X402EmailChallenge | Unset): The result of issuing an email-native payment challenge. `interaction_id`
                is the real email thread id (`uuid@domain`) the payment is bound to;
                `challenge_id` is the underlying challenge record. Hand the `challenge`
                to the payer, who replies with a signed `payment` interaction step (the
                SDK `payEmailChallenge` helper builds it).
     """

    success: bool
    data: X402EmailChallenge | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.x402_email_challenge import X402EmailChallenge
        success = self.success

        data: dict[str, Any] | Unset = UNSET
        if not isinstance(self.data, Unset):
            data = self.data.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "success": success,
        })
        if data is not UNSET:
            field_dict["data"] = data

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.x402_email_challenge import X402EmailChallenge
        d = dict(src_dict)
        success = d.pop("success")

        _data = d.pop("data", UNSET)
        data: X402EmailChallenge | Unset
        if isinstance(_data,  Unset):
            data = UNSET
        else:
            data = X402EmailChallenge.from_dict(_data)




        create_email_challenge_response_200 = cls(
            success=success,
            data=data,
        )


        create_email_challenge_response_200.additional_properties = d
        return create_email_challenge_response_200

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
