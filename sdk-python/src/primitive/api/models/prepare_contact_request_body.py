from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="PrepareContactRequestBody")



@_attrs_define
class PrepareContactRequestBody:
    """ 
        Attributes:
            to (str): The address to contact.
            reason (str): Why you want to correspond, in one or two sentences.
            expires_in_seconds (int | Unset):  Default: 86400.
            from_ (str | Unset): Required unless the credential is a connected agent.
     """

    to: str
    reason: str
    expires_in_seconds: int | Unset = 86400
    from_: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        to = self.to

        reason = self.reason

        expires_in_seconds = self.expires_in_seconds

        from_ = self.from_


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "to": to,
            "reason": reason,
        })
        if expires_in_seconds is not UNSET:
            field_dict["expires_in_seconds"] = expires_in_seconds
        if from_ is not UNSET:
            field_dict["from"] = from_

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        to = d.pop("to")

        reason = d.pop("reason")

        expires_in_seconds = d.pop("expires_in_seconds", UNSET)

        from_ = d.pop("from", UNSET)

        prepare_contact_request_body = cls(
            to=to,
            reason=reason,
            expires_in_seconds=expires_in_seconds,
            from_=from_,
        )

        return prepare_contact_request_body

