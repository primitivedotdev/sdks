from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="TestEndpointRulesResultEvaluated")



@_attrs_define
class TestEndpointRulesResultEvaluated:
    """ The message metadata the matcher compared, so the caller
    can see WHAT was evaluated (in particular the
    authenticated From identity versus the raw envelope
    sender).

        Attributes:
            size_bytes (int):
            has_attachments (bool):
            attachment_size_bytes (int):
            sender (str): Raw envelope sender the blacklist matches against.
            from_address (None | str): Bare From-header address, when one was present.
            sender_authenticated (bool): Whether the sender identity passed authentication (the whitelist matches only
                authenticated identities).
            sender_trust_basis (str): Which signal established (or failed to establish) the sender identity.
     """

    size_bytes: int
    has_attachments: bool
    attachment_size_bytes: int
    sender: str
    from_address: None | str
    sender_authenticated: bool
    sender_trust_basis: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        size_bytes = self.size_bytes

        has_attachments = self.has_attachments

        attachment_size_bytes = self.attachment_size_bytes

        sender = self.sender

        from_address: None | str
        from_address = self.from_address

        sender_authenticated = self.sender_authenticated

        sender_trust_basis = self.sender_trust_basis


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "size_bytes": size_bytes,
            "has_attachments": has_attachments,
            "attachment_size_bytes": attachment_size_bytes,
            "sender": sender,
            "from_address": from_address,
            "sender_authenticated": sender_authenticated,
            "sender_trust_basis": sender_trust_basis,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        size_bytes = d.pop("size_bytes")

        has_attachments = d.pop("has_attachments")

        attachment_size_bytes = d.pop("attachment_size_bytes")

        sender = d.pop("sender")

        def _parse_from_address(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        from_address = _parse_from_address(d.pop("from_address"))


        sender_authenticated = d.pop("sender_authenticated")

        sender_trust_basis = d.pop("sender_trust_basis")

        test_endpoint_rules_result_evaluated = cls(
            size_bytes=size_bytes,
            has_attachments=has_attachments,
            attachment_size_bytes=attachment_size_bytes,
            sender=sender,
            from_address=from_address,
            sender_authenticated=sender_authenticated,
            sender_trust_basis=sender_trust_basis,
        )


        test_endpoint_rules_result_evaluated.additional_properties = d
        return test_endpoint_rules_result_evaluated

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
