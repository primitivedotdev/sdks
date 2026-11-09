from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="StartInteractionRequest")



@_attrs_define
class StartInteractionRequest:
    """ 
        Attributes:
            protocol (str):
            step (str):
            from_ (str):
            to (str):
            protocol_version (int | Unset):  Default: 1.
            payload (Any | Unset): The step's protocol payload, at most 16384 bytes as JSON. Its shape is the protocol's.
            expires_at (datetime.datetime | None | Unset):
            subject (str | Unset):
            body_text (str | Unset):
     """

    protocol: str
    step: str
    from_: str
    to: str
    protocol_version: int | Unset = 1
    payload: Any | Unset = UNSET
    expires_at: datetime.datetime | None | Unset = UNSET
    subject: str | Unset = UNSET
    body_text: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        protocol = self.protocol

        step = self.step

        from_ = self.from_

        to = self.to

        protocol_version = self.protocol_version

        payload = self.payload

        expires_at: None | str | Unset
        if isinstance(self.expires_at, Unset):
            expires_at = UNSET
        elif isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
            expires_at = self.expires_at

        subject = self.subject

        body_text = self.body_text


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "protocol": protocol,
            "step": step,
            "from": from_,
            "to": to,
        })
        if protocol_version is not UNSET:
            field_dict["protocol_version"] = protocol_version
        if payload is not UNSET:
            field_dict["payload"] = payload
        if expires_at is not UNSET:
            field_dict["expires_at"] = expires_at
        if subject is not UNSET:
            field_dict["subject"] = subject
        if body_text is not UNSET:
            field_dict["body_text"] = body_text

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        protocol = d.pop("protocol")

        step = d.pop("step")

        from_ = d.pop("from")

        to = d.pop("to")

        protocol_version = d.pop("protocol_version", UNSET)

        payload = d.pop("payload", UNSET)

        def _parse_expires_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                expires_at_type_0 = datetime.datetime.fromisoformat(data)



                return expires_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        expires_at = _parse_expires_at(d.pop("expires_at", UNSET))


        subject = d.pop("subject", UNSET)

        body_text = d.pop("body_text", UNSET)

        start_interaction_request = cls(
            protocol=protocol,
            step=step,
            from_=from_,
            to=to,
            protocol_version=protocol_version,
            payload=payload,
            expires_at=expires_at,
            subject=subject,
            body_text=body_text,
        )

        return start_interaction_request

