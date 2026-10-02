from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
import datetime






T = TypeVar("T", bound="RepeatInput")



@_attrs_define
class RepeatInput:
    """ Repeat this send every `every_minutes` in the same thread. The first
    message goes out like any send; each later one is a scheduled send
    that replies to the previous one, so quotas, gates and cancellation
    apply as usual. Requires exactly one `to` recipient and no cc, bcc,
    attachments or `fyi` (422 `repeat_unsupported`). The recipient must
    be an address of your own organization unless the organization is
    entitled to repeat to external recipients (403
    `repeat_recipient_external`). `only_if_recipient_idle_minutes` needs
    a recipient in your organization (422
    `repeat_idle_requires_internal_recipient`).

        Attributes:
            every_minutes (int):
            only_if_recipient_idle_minutes (int | Unset): Skip a repeat while the recipient has sent mail within this many
                minutes.
            stoppable_by_recipient (bool | Unset): Let the recipient stop the repeat. Default: True.
            max_sends (int | Unset): Total messages, including the first.
            until (datetime.datetime | Unset): No repeat is sent after this time. Must be in the future.
     """

    every_minutes: int
    only_if_recipient_idle_minutes: int | Unset = UNSET
    stoppable_by_recipient: bool | Unset = True
    max_sends: int | Unset = UNSET
    until: datetime.datetime | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        every_minutes = self.every_minutes

        only_if_recipient_idle_minutes = self.only_if_recipient_idle_minutes

        stoppable_by_recipient = self.stoppable_by_recipient

        max_sends = self.max_sends

        until: str | Unset = UNSET
        if not isinstance(self.until, Unset):
            until = self.until.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "every_minutes": every_minutes,
        })
        if only_if_recipient_idle_minutes is not UNSET:
            field_dict["only_if_recipient_idle_minutes"] = only_if_recipient_idle_minutes
        if stoppable_by_recipient is not UNSET:
            field_dict["stoppable_by_recipient"] = stoppable_by_recipient
        if max_sends is not UNSET:
            field_dict["max_sends"] = max_sends
        if until is not UNSET:
            field_dict["until"] = until

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        every_minutes = d.pop("every_minutes")

        only_if_recipient_idle_minutes = d.pop("only_if_recipient_idle_minutes", UNSET)

        stoppable_by_recipient = d.pop("stoppable_by_recipient", UNSET)

        max_sends = d.pop("max_sends", UNSET)

        _until = d.pop("until", UNSET)
        until: datetime.datetime | Unset
        if isinstance(_until,  Unset):
            until = UNSET
        else:
            until = isoparse(_until)




        repeat_input = cls(
            every_minutes=every_minutes,
            only_if_recipient_idle_minutes=only_if_recipient_idle_minutes,
            stoppable_by_recipient=stoppable_by_recipient,
            max_sends=max_sends,
            until=until,
        )

        return repeat_input

