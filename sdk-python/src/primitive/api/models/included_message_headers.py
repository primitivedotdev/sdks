from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.included_message_headers_automation_type_0 import IncludedMessageHeadersAutomationType0





T = TypeVar("T", bound="IncludedMessageHeaders")



@_attrs_define
class IncludedMessageHeaders:
    """ Stored addressing and threading headers. A member is null when absent or withheld.

        Attributes:
            from_ (None | str):
            to (list[str] | None):
            cc (list[str] | None):
            bcc (list[str] | None):
            reply_to (list[str] | None):
            in_reply_to (list[str] | None):
            references (list[str] | None):
            automation (IncludedMessageHeadersAutomationType0 | None): Received mail only.
     """

    from_: None | str
    to: list[str] | None
    cc: list[str] | None
    bcc: list[str] | None
    reply_to: list[str] | None
    in_reply_to: list[str] | None
    references: list[str] | None
    automation: IncludedMessageHeadersAutomationType0 | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.included_message_headers_automation_type_0 import IncludedMessageHeadersAutomationType0 # noqa: PLC0415
        from_: None | str
        from_ = self.from_

        to: list[str] | None
        if isinstance(self.to, list):
            to = self.to


        else:
            to = self.to

        cc: list[str] | None
        if isinstance(self.cc, list):
            cc = self.cc


        else:
            cc = self.cc

        bcc: list[str] | None
        if isinstance(self.bcc, list):
            bcc = self.bcc


        else:
            bcc = self.bcc

        reply_to: list[str] | None
        if isinstance(self.reply_to, list):
            reply_to = self.reply_to


        else:
            reply_to = self.reply_to

        in_reply_to: list[str] | None
        if isinstance(self.in_reply_to, list):
            in_reply_to = self.in_reply_to


        else:
            in_reply_to = self.in_reply_to

        references: list[str] | None
        if isinstance(self.references, list):
            references = self.references


        else:
            references = self.references

        automation: dict[str, Any] | None
        if isinstance(self.automation, IncludedMessageHeadersAutomationType0):
            automation = self.automation.to_dict()
        else:
            automation = self.automation


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "from": from_,
            "to": to,
            "cc": cc,
            "bcc": bcc,
            "reply_to": reply_to,
            "in_reply_to": in_reply_to,
            "references": references,
            "automation": automation,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.included_message_headers_automation_type_0 import IncludedMessageHeadersAutomationType0 # noqa: PLC0415
        d = dict(src_dict)
        def _parse_from_(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        from_ = _parse_from_(d.pop("from"))


        def _parse_to(data: object) -> list[str] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                to_type_0 = cast(list[str], data)

                return to_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None, data)

        to = _parse_to(d.pop("to"))


        def _parse_cc(data: object) -> list[str] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                cc_type_0 = cast(list[str], data)

                return cc_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None, data)

        cc = _parse_cc(d.pop("cc"))


        def _parse_bcc(data: object) -> list[str] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                bcc_type_0 = cast(list[str], data)

                return bcc_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None, data)

        bcc = _parse_bcc(d.pop("bcc"))


        def _parse_reply_to(data: object) -> list[str] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                reply_to_type_0 = cast(list[str], data)

                return reply_to_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None, data)

        reply_to = _parse_reply_to(d.pop("reply_to"))


        def _parse_in_reply_to(data: object) -> list[str] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                in_reply_to_type_0 = cast(list[str], data)

                return in_reply_to_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None, data)

        in_reply_to = _parse_in_reply_to(d.pop("in_reply_to"))


        def _parse_references(data: object) -> list[str] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                references_type_0 = cast(list[str], data)

                return references_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None, data)

        references = _parse_references(d.pop("references"))


        def _parse_automation(data: object) -> IncludedMessageHeadersAutomationType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                automation_type_0 = IncludedMessageHeadersAutomationType0.from_dict(data)



                return automation_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(IncludedMessageHeadersAutomationType0 | None, data)

        automation = _parse_automation(d.pop("automation"))


        included_message_headers = cls(
            from_=from_,
            to=to,
            cc=cc,
            bcc=bcc,
            reply_to=reply_to,
            in_reply_to=in_reply_to,
            references=references,
            automation=automation,
        )


        included_message_headers.additional_properties = d
        return included_message_headers

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
