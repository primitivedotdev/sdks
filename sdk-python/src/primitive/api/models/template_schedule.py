from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.template_schedule_args import TemplateScheduleArgs





T = TypeVar("T", bound="TemplateSchedule")



@_attrs_define
class TemplateSchedule:
    """ A default wake schedule the install creates for the function: the command it sends, a 5-field cron expression and
    timezone, and the scheduler sender localpart on the installed address's domain. The owner can change or delete it
    after install.

        Attributes:
            command (str):
            cron (str):
            timezone (str):  Default: 'UTC'.
            args (TemplateScheduleArgs):
            sender_localpart (str):  Default: 'scheduler'.
            allowlist_secret (str | Unset):
            recipients_secret (str | Unset):
     """

    command: str
    cron: str
    args: TemplateScheduleArgs
    timezone: str = 'UTC'
    sender_localpart: str = 'scheduler'
    allowlist_secret: str | Unset = UNSET
    recipients_secret: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.template_schedule_args import TemplateScheduleArgs # noqa: PLC0415
        command = self.command

        cron = self.cron

        timezone = self.timezone

        args = self.args.to_dict()

        sender_localpart = self.sender_localpart

        allowlist_secret = self.allowlist_secret

        recipients_secret = self.recipients_secret


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "command": command,
            "cron": cron,
            "timezone": timezone,
            "args": args,
            "senderLocalpart": sender_localpart,
        })
        if allowlist_secret is not UNSET:
            field_dict["allowlistSecret"] = allowlist_secret
        if recipients_secret is not UNSET:
            field_dict["recipientsSecret"] = recipients_secret

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.template_schedule_args import TemplateScheduleArgs # noqa: PLC0415
        d = dict(src_dict)
        command = d.pop("command")

        cron = d.pop("cron")

        timezone = d.pop("timezone")

        args = TemplateScheduleArgs.from_dict(d.pop("args"))




        sender_localpart = d.pop("senderLocalpart")

        allowlist_secret = d.pop("allowlistSecret", UNSET)

        recipients_secret = d.pop("recipientsSecret", UNSET)

        template_schedule = cls(
            command=command,
            cron=cron,
            timezone=timezone,
            args=args,
            sender_localpart=sender_localpart,
            allowlist_secret=allowlist_secret,
            recipients_secret=recipients_secret,
        )


        template_schedule.additional_properties = d
        return template_schedule

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
