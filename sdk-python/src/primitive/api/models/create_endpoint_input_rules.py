from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="CreateEndpointInputRules")



@_attrs_define
class CreateEndpointInputRules:
    """ Endpoint-specific filtering rules

        Attributes:
            event_types (list[str] | Unset): Event types this endpoint receives. Omitted: every event type except the opt-in
                sent_email.* events, which an endpoint receives only when it lists them.
            max_size_bytes (int | Unset): Skip messages larger than this many bytes.
            exclude_attachments (bool | Unset): When true, skip messages that have attachments.
            attachment_limit_mb (float | Unset): Skip messages whose attachments total more than this many megabytes.
            sender_whitelist (list[str] | Unset): Deliver only messages whose authenticated From identity matches an entry:
                an exact address, or @domain, which also matches its subdomains.
            sender_blacklist (list[str] | Unset): Skip messages whose envelope sender or From address matches an entry: an
                exact address, or @domain, which also matches its subdomains.
     """

    event_types: list[str] | Unset = UNSET
    max_size_bytes: int | Unset = UNSET
    exclude_attachments: bool | Unset = UNSET
    attachment_limit_mb: float | Unset = UNSET
    sender_whitelist: list[str] | Unset = UNSET
    sender_blacklist: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        event_types: list[str] | Unset = UNSET
        if not isinstance(self.event_types, Unset):
            event_types = self.event_types



        max_size_bytes = self.max_size_bytes

        exclude_attachments = self.exclude_attachments

        attachment_limit_mb = self.attachment_limit_mb

        sender_whitelist: list[str] | Unset = UNSET
        if not isinstance(self.sender_whitelist, Unset):
            sender_whitelist = self.sender_whitelist



        sender_blacklist: list[str] | Unset = UNSET
        if not isinstance(self.sender_blacklist, Unset):
            sender_blacklist = self.sender_blacklist




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if event_types is not UNSET:
            field_dict["event_types"] = event_types
        if max_size_bytes is not UNSET:
            field_dict["max_size_bytes"] = max_size_bytes
        if exclude_attachments is not UNSET:
            field_dict["exclude_attachments"] = exclude_attachments
        if attachment_limit_mb is not UNSET:
            field_dict["attachment_limit_mb"] = attachment_limit_mb
        if sender_whitelist is not UNSET:
            field_dict["sender_whitelist"] = sender_whitelist
        if sender_blacklist is not UNSET:
            field_dict["sender_blacklist"] = sender_blacklist

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        event_types = cast(list[str], d.pop("event_types", UNSET))


        max_size_bytes = d.pop("max_size_bytes", UNSET)

        exclude_attachments = d.pop("exclude_attachments", UNSET)

        attachment_limit_mb = d.pop("attachment_limit_mb", UNSET)

        sender_whitelist = cast(list[str], d.pop("sender_whitelist", UNSET))


        sender_blacklist = cast(list[str], d.pop("sender_blacklist", UNSET))


        create_endpoint_input_rules = cls(
            event_types=event_types,
            max_size_bytes=max_size_bytes,
            exclude_attachments=exclude_attachments,
            attachment_limit_mb=attachment_limit_mb,
            sender_whitelist=sender_whitelist,
            sender_blacklist=sender_blacklist,
        )


        create_endpoint_input_rules.additional_properties = d
        return create_endpoint_input_rules

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
