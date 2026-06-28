from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.wake_schedule_args import WakeScheduleArgs





T = TypeVar("T", bound="WakeSchedule")



@_attrs_define
class WakeSchedule:
    """ A cron schedule that sends a wake.dispatch command to a function.

        Attributes:
            id (UUID):
            target_address (str): The function address the wake is delivered to.
            command (str):
            cron_expr (str): 5-field cron expression.
            timezone (str): IANA timezone the cron is evaluated in.
            next_run_at (datetime.datetime):
            enabled (bool):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            from_address (None | str | Unset): The sending identity the wake is signed as.
            args (WakeScheduleArgs | Unset):
            last_run_at (datetime.datetime | None | Unset):
            note (None | str | Unset):
     """

    id: UUID
    target_address: str
    command: str
    cron_expr: str
    timezone: str
    next_run_at: datetime.datetime
    enabled: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    from_address: None | str | Unset = UNSET
    args: WakeScheduleArgs | Unset = UNSET
    last_run_at: datetime.datetime | None | Unset = UNSET
    note: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.wake_schedule_args import WakeScheduleArgs
        id = str(self.id)

        target_address = self.target_address

        command = self.command

        cron_expr = self.cron_expr

        timezone = self.timezone

        next_run_at = self.next_run_at.isoformat()

        enabled = self.enabled

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        from_address: None | str | Unset
        if isinstance(self.from_address, Unset):
            from_address = UNSET
        else:
            from_address = self.from_address

        args: dict[str, Any] | Unset = UNSET
        if not isinstance(self.args, Unset):
            args = self.args.to_dict()

        last_run_at: None | str | Unset
        if isinstance(self.last_run_at, Unset):
            last_run_at = UNSET
        elif isinstance(self.last_run_at, datetime.datetime):
            last_run_at = self.last_run_at.isoformat()
        else:
            last_run_at = self.last_run_at

        note: None | str | Unset
        if isinstance(self.note, Unset):
            note = UNSET
        else:
            note = self.note


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "target_address": target_address,
            "command": command,
            "cron_expr": cron_expr,
            "timezone": timezone,
            "next_run_at": next_run_at,
            "enabled": enabled,
            "created_at": created_at,
            "updated_at": updated_at,
        })
        if from_address is not UNSET:
            field_dict["from_address"] = from_address
        if args is not UNSET:
            field_dict["args"] = args
        if last_run_at is not UNSET:
            field_dict["last_run_at"] = last_run_at
        if note is not UNSET:
            field_dict["note"] = note

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.wake_schedule_args import WakeScheduleArgs
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        target_address = d.pop("target_address")

        command = d.pop("command")

        cron_expr = d.pop("cron_expr")

        timezone = d.pop("timezone")

        next_run_at = isoparse(d.pop("next_run_at"))




        enabled = d.pop("enabled")

        created_at = isoparse(d.pop("created_at"))




        updated_at = isoparse(d.pop("updated_at"))




        def _parse_from_address(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        from_address = _parse_from_address(d.pop("from_address", UNSET))


        _args = d.pop("args", UNSET)
        args: WakeScheduleArgs | Unset
        if isinstance(_args,  Unset):
            args = UNSET
        else:
            args = WakeScheduleArgs.from_dict(_args)




        def _parse_last_run_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_run_at_type_0 = isoparse(data)



                return last_run_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        last_run_at = _parse_last_run_at(d.pop("last_run_at", UNSET))


        def _parse_note(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        note = _parse_note(d.pop("note", UNSET))


        wake_schedule = cls(
            id=id,
            target_address=target_address,
            command=command,
            cron_expr=cron_expr,
            timezone=timezone,
            next_run_at=next_run_at,
            enabled=enabled,
            created_at=created_at,
            updated_at=updated_at,
            from_address=from_address,
            args=args,
            last_run_at=last_run_at,
            note=note,
        )


        wake_schedule.additional_properties = d
        return wake_schedule

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
