from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.agent_contact_policy_override import AgentContactPolicyOverride
  from ..models.contact_policy import ContactPolicy





T = TypeVar("T", bound="AgentContactPolicy")



@_attrs_define
class AgentContactPolicy:
    """ 
        Attributes:
            agent_address (str):
            org_policy (ContactPolicy):
            agent_policy (AgentContactPolicyOverride):
            effective_version (str):
            effective_since (datetime.datetime):
            allow_contact_requests (bool):
            contact_request_since (datetime.datetime | None):
            contact_request_generation (None | str):
     """

    agent_address: str
    org_policy: ContactPolicy
    agent_policy: AgentContactPolicyOverride
    effective_version: str
    effective_since: datetime.datetime
    allow_contact_requests: bool
    contact_request_since: datetime.datetime | None
    contact_request_generation: None | str





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_contact_policy_override import AgentContactPolicyOverride
        from ..models.contact_policy import ContactPolicy
        agent_address = self.agent_address

        org_policy = self.org_policy.to_dict()

        agent_policy = self.agent_policy.to_dict()

        effective_version = self.effective_version

        effective_since = self.effective_since.isoformat()

        allow_contact_requests = self.allow_contact_requests

        contact_request_since: None | str
        if isinstance(self.contact_request_since, datetime.datetime):
            contact_request_since = self.contact_request_since.isoformat()
        else:
            contact_request_since = self.contact_request_since

        contact_request_generation: None | str
        contact_request_generation = self.contact_request_generation


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "agent_address": agent_address,
            "org_policy": org_policy,
            "agent_policy": agent_policy,
            "effective_version": effective_version,
            "effective_since": effective_since,
            "allow_contact_requests": allow_contact_requests,
            "contact_request_since": contact_request_since,
            "contact_request_generation": contact_request_generation,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_contact_policy_override import AgentContactPolicyOverride
        from ..models.contact_policy import ContactPolicy
        d = dict(src_dict)
        agent_address = d.pop("agent_address")

        org_policy = ContactPolicy.from_dict(d.pop("org_policy"))




        agent_policy = AgentContactPolicyOverride.from_dict(d.pop("agent_policy"))




        effective_version = d.pop("effective_version")

        effective_since = isoparse(d.pop("effective_since"))




        allow_contact_requests = d.pop("allow_contact_requests")

        def _parse_contact_request_since(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                contact_request_since_type_0 = isoparse(data)



                return contact_request_since_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        contact_request_since = _parse_contact_request_since(d.pop("contact_request_since"))


        def _parse_contact_request_generation(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        contact_request_generation = _parse_contact_request_generation(d.pop("contact_request_generation"))


        agent_contact_policy = cls(
            agent_address=agent_address,
            org_policy=org_policy,
            agent_policy=agent_policy,
            effective_version=effective_version,
            effective_since=effective_since,
            allow_contact_requests=allow_contact_requests,
            contact_request_since=contact_request_since,
            contact_request_generation=contact_request_generation,
        )

        return agent_contact_policy

