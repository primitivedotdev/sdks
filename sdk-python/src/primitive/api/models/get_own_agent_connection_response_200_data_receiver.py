from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_own_agent_connection_response_200_data_receiver_state import GetOwnAgentConnectionResponse200DataReceiverState
from typing import cast
import datetime






T = TypeVar("T", bound="GetOwnAgentConnectionResponse200DataReceiver")



@_attrs_define
class GetOwnAgentConnectionResponse200DataReceiver:
    """ Whether this peer is currently reading its mail, from the server's record of its own successful mail reads (GET
    /emails list reads and pull endpoint pulls made with its connection key). live: a read completed within the last 3
    minutes, and since is when the current run of recent reads began. unknown: no recent read; since is when the last
    read aged out, or null when none was recorded. An agent that receives mail another way, or reads only between turns,
    shows unknown rather than down. down is reserved for an explicit report that the receiver stopped.
    last_mail_check_at is recorded at most once a minute, so it can trail the latest read by up to a minute. None of
    this says whether a model has read a particular message.

        Attributes:
            state (GetOwnAgentConnectionResponse200DataReceiverState):
            since (datetime.datetime | None):
            last_mail_check_at (datetime.datetime | None):
     """

    state: GetOwnAgentConnectionResponse200DataReceiverState
    since: datetime.datetime | None
    last_mail_check_at: datetime.datetime | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        state = self.state.value

        since: None | str
        if isinstance(self.since, datetime.datetime):
            since = self.since.isoformat()
        else:
            since = self.since

        last_mail_check_at: None | str
        if isinstance(self.last_mail_check_at, datetime.datetime):
            last_mail_check_at = self.last_mail_check_at.isoformat()
        else:
            last_mail_check_at = self.last_mail_check_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "state": state,
            "since": since,
            "last_mail_check_at": last_mail_check_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        state = GetOwnAgentConnectionResponse200DataReceiverState(d.pop("state"))




        def _parse_since(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                since_type_0 = datetime.datetime.fromisoformat(data)



                return since_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        since = _parse_since(d.pop("since"))


        def _parse_last_mail_check_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_mail_check_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_mail_check_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_mail_check_at = _parse_last_mail_check_at(d.pop("last_mail_check_at"))


        get_own_agent_connection_response_200_data_receiver = cls(
            state=state,
            since=since,
            last_mail_check_at=last_mail_check_at,
        )


        get_own_agent_connection_response_200_data_receiver.additional_properties = d
        return get_own_agent_connection_response_200_data_receiver

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
