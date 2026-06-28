from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.create_wake_schedule_input_args import CreateWakeScheduleInputArgs





T = TypeVar("T", bound="CreateWakeScheduleInput")



@_attrs_define
class CreateWakeScheduleInput:
    """ 
        Attributes:
            from_address (str): Sending identity (must be a domain the org can sign).
            target_address (str): Your function address (must differ from from_address).
            command (str):
            cron_expr (str):
            args (CreateWakeScheduleInputArgs | Unset): Optional JSON object passed through to the woken function.
            timezone (str | Unset):  Default: 'UTC'.
            note (str | Unset):
     """

    from_address: str
    target_address: str
    command: str
    cron_expr: str
    args: CreateWakeScheduleInputArgs | Unset = UNSET
    timezone: str | Unset = 'UTC'
    note: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_wake_schedule_input_args import CreateWakeScheduleInputArgs
        from_address = self.from_address

        target_address = self.target_address

        command = self.command

        cron_expr = self.cron_expr

        args: dict[str, Any] | Unset = UNSET
        if not isinstance(self.args, Unset):
            args = self.args.to_dict()

        timezone = self.timezone

        note = self.note


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "from_address": from_address,
            "target_address": target_address,
            "command": command,
            "cron_expr": cron_expr,
        })
        if args is not UNSET:
            field_dict["args"] = args
        if timezone is not UNSET:
            field_dict["timezone"] = timezone
        if note is not UNSET:
            field_dict["note"] = note

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_wake_schedule_input_args import CreateWakeScheduleInputArgs
        d = dict(src_dict)
        from_address = d.pop("from_address")

        target_address = d.pop("target_address")

        command = d.pop("command")

        cron_expr = d.pop("cron_expr")

        _args = d.pop("args", UNSET)
        args: CreateWakeScheduleInputArgs | Unset
        if isinstance(_args,  Unset):
            args = UNSET
        else:
            args = CreateWakeScheduleInputArgs.from_dict(_args)




        timezone = d.pop("timezone", UNSET)

        note = d.pop("note", UNSET)

        create_wake_schedule_input = cls(
            from_address=from_address,
            target_address=target_address,
            command=command,
            cron_expr=cron_expr,
            args=args,
            timezone=timezone,
            note=note,
        )

        return create_wake_schedule_input

