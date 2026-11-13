from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ReplyInputUnsubscribe")



@_attrs_define
class ReplyInputUnsubscribe:
    """ One-click unsubscribe for the message. Primitive writes a `List-Unsubscribe` header naming `url` (and `mailto` when
    given) and, unless `one_click` is false, `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058), and DKIM-
    signs both. A receiver that offers one-click unsubscribe sends an HTTPS POST to `url` with the form body `List-
    Unsubscribe=One-Click`; your endpoint records the unsubscribe. Every recipient of the message gets the same `url`,
    so send one message per recipient when the URL identifies who to unsubscribe. The `headers` map refuses both header
    names, so this field is the only way to set them, and the headers it adds count toward the 25 entries `headers` may
    hold. A field whose rendered `List-Unsubscribe` would pass 980 characters is refused. Not accepted on a repeating
    send.

        Attributes:
            url (str): Absolute https URL that unsubscribes the recipient, at most 700 characters of URL characters only:
                printable ASCII with no spaces, double quotes, angle brackets or commas (percent-encode a comma as %2C), `%`
                only as a percent-encoded byte, `[` and `]` only around an IPv6 address host, a port from 1 to 65535, no `=?`
                (which mail readers can decode as an encoded word), and no user name or password. The host must be public: not a
                single-label name, `localhost` or a name under `.localhost`, `.internal`, `.local`, `.home.arpa` or
                `.localdomain`, or a loopback, link-local, private, shared, reserved, multicast or unspecified IP address,
                including an IPv6 address that embeds one. The scheme is written in lower case.
            one_click (bool | Unset): Whether to also write `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, which tells
                the receiver it may unsubscribe with a single POST to `url`. Set false when `url` needs the recipient to open a
                page and confirm. Default: True.
            mailto (str | Unset): An address to also offer as a `mailto:` unsubscribe, written after `url`. The address
                alone, without the `mailto:` prefix: at most 64 letters, digits and `.!$'*+=_~-` before the `@`, and a dotted
                domain after it. An `=` is written as `%3D` in the header.
     """

    url: str
    one_click: bool | Unset = True
    mailto: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        url = self.url

        one_click = self.one_click

        mailto = self.mailto


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "url": url,
        })
        if one_click is not UNSET:
            field_dict["one_click"] = one_click
        if mailto is not UNSET:
            field_dict["mailto"] = mailto

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        url = d.pop("url")

        one_click = d.pop("one_click", UNSET)

        mailto = d.pop("mailto", UNSET)

        reply_input_unsubscribe = cls(
            url=url,
            one_click=one_click,
            mailto=mailto,
        )

        return reply_input_unsubscribe

