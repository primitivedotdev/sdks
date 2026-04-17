from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="UpdateAccountInput")



@_attrs_define
class UpdateAccountInput:
    """ 
        Attributes:
            spam_threshold (float | None | Unset): Global spam score threshold (0-15). Emails scoring above this are
                rejected. Set to null to disable.
            discard_content_on_webhook_confirmed (bool | Unset): Whether to discard email content after the webhook endpoint
                confirms receipt.
     """

    spam_threshold: float | None | Unset = UNSET
    discard_content_on_webhook_confirmed: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        spam_threshold: float | None | Unset
        if isinstance(self.spam_threshold, Unset):
            spam_threshold = UNSET
        else:
            spam_threshold = self.spam_threshold

        discard_content_on_webhook_confirmed = self.discard_content_on_webhook_confirmed


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if spam_threshold is not UNSET:
            field_dict["spam_threshold"] = spam_threshold
        if discard_content_on_webhook_confirmed is not UNSET:
            field_dict["discard_content_on_webhook_confirmed"] = discard_content_on_webhook_confirmed

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_spam_threshold(data: object) -> float | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(float | None | Unset, data)

        spam_threshold = _parse_spam_threshold(d.pop("spam_threshold", UNSET))


        discard_content_on_webhook_confirmed = d.pop("discard_content_on_webhook_confirmed", UNSET)

        update_account_input = cls(
            spam_threshold=spam_threshold,
            discard_content_on_webhook_confirmed=discard_content_on_webhook_confirmed,
        )

        return update_account_input

