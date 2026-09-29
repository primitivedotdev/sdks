from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
import datetime






T = TypeVar("T", bound="AgentNetworkContactAdmission")



@_attrs_define
class AgentNetworkContactAdmission:
    """ Recipient-bound admission for authenticated network mail.

        Attributes:
            allowed (bool):
            allowed_since (datetime.datetime | None): Earliest received_at eligible under the current membership and
                connection state.
     """

    allowed: bool
    allowed_since: datetime.datetime | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        allowed = self.allowed

        allowed_since: None | str
        if isinstance(self.allowed_since, datetime.datetime):
            allowed_since = self.allowed_since.isoformat()
        else:
            allowed_since = self.allowed_since


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "allowed": allowed,
            "allowed_since": allowed_since,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        allowed = d.pop("allowed")

        def _parse_allowed_since(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                allowed_since_type_0 = isoparse(data)



                return allowed_since_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        allowed_since = _parse_allowed_since(d.pop("allowed_since"))


        agent_network_contact_admission = cls(
            allowed=allowed,
            allowed_since=allowed_since,
        )


        agent_network_contact_admission.additional_properties = d
        return agent_network_contact_admission

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
