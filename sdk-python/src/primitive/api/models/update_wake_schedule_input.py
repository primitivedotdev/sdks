from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.update_wake_schedule_input_args import UpdateWakeScheduleInputArgs





T = TypeVar("T", bound="UpdateWakeScheduleInput")



@_attrs_define
class UpdateWakeScheduleInput:
    """ 
        Attributes:
            enabled (bool | Unset):
            command (str | Unset):
            args (UpdateWakeScheduleInputArgs | Unset):
            cron_expr (str | Unset):
            timezone (str | Unset):
            from_address (str | Unset):
            target_address (str | Unset):
            note (None | str | Unset):
     """

    enabled: bool | Unset = UNSET
    command: str | Unset = UNSET
    args: UpdateWakeScheduleInputArgs | Unset = UNSET
    cron_expr: str | Unset = UNSET
    timezone: str | Unset = UNSET
    from_address: str | Unset = UNSET
    target_address: str | Unset = UNSET
    note: None | str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_wake_schedule_input_args import UpdateWakeScheduleInputArgs
        enabled = self.enabled

        command = self.command

        args: dict[str, Any] | Unset = UNSET
        if not isinstance(self.args, Unset):
            args = self.args.to_dict()

        cron_expr = self.cron_expr

        timezone = self.timezone

        from_address = self.from_address

        target_address = self.target_address

        note: None | str | Unset
        if isinstance(self.note, Unset):
            note = UNSET
        else:
            note = self.note


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if enabled is not UNSET:
            field_dict["enabled"] = enabled
        if command is not UNSET:
            field_dict["command"] = command
        if args is not UNSET:
            field_dict["args"] = args
        if cron_expr is not UNSET:
            field_dict["cron_expr"] = cron_expr
        if timezone is not UNSET:
            field_dict["timezone"] = timezone
        if from_address is not UNSET:
            field_dict["from_address"] = from_address
        if target_address is not UNSET:
            field_dict["target_address"] = target_address
        if note is not UNSET:
            field_dict["note"] = note

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_wake_schedule_input_args import UpdateWakeScheduleInputArgs
        d = dict(src_dict)
        enabled = d.pop("enabled", UNSET)

        command = d.pop("command", UNSET)

        _args = d.pop("args", UNSET)
        args: UpdateWakeScheduleInputArgs | Unset
        if isinstance(_args,  Unset):
            args = UNSET
        else:
            args = UpdateWakeScheduleInputArgs.from_dict(_args)




        cron_expr = d.pop("cron_expr", UNSET)

        timezone = d.pop("timezone", UNSET)

        from_address = d.pop("from_address", UNSET)

        target_address = d.pop("target_address", UNSET)

        def _parse_note(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        note = _parse_note(d.pop("note", UNSET))


        update_wake_schedule_input = cls(
            enabled=enabled,
            command=command,
            args=args,
            cron_expr=cron_expr,
            timezone=timezone,
            from_address=from_address,
            target_address=target_address,
            note=note,
        )

        return update_wake_schedule_input

