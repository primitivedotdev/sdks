from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.inbox_status_domain import InboxStatusDomain
  from ..models.inbox_status_endpoints import InboxStatusEndpoints
  from ..models.inbox_status_functions import InboxStatusFunctions
  from ..models.inbox_status_next_action import InboxStatusNextAction
  from ..models.inbox_status_recent_emails import InboxStatusRecentEmails





T = TypeVar("T", bound="InboxStatus")



@_attrs_define
class InboxStatus:
    """ 
        Attributes:
            ready (bool): True when an active inbound domain and at least one processing route are both ready.
            receiving_ready (bool): True when at least one active verified or managed domain can receive mail.
            processing_ready (bool): True when at least one receiving-ready domain has an enabled webhook or function route.
            summary (str):
            next_actions (list[InboxStatusNextAction]):
            domains (list[InboxStatusDomain]):
            endpoints (InboxStatusEndpoints):
            functions (InboxStatusFunctions):
            recent_emails (InboxStatusRecentEmails): Inbound email activity from the last 30 days.
     """

    ready: bool
    receiving_ready: bool
    processing_ready: bool
    summary: str
    next_actions: list[InboxStatusNextAction]
    domains: list[InboxStatusDomain]
    endpoints: InboxStatusEndpoints
    functions: InboxStatusFunctions
    recent_emails: InboxStatusRecentEmails
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.inbox_status_domain import InboxStatusDomain # noqa: PLC0415
        from ..models.inbox_status_endpoints import InboxStatusEndpoints # noqa: PLC0415
        from ..models.inbox_status_functions import InboxStatusFunctions # noqa: PLC0415
        from ..models.inbox_status_next_action import InboxStatusNextAction # noqa: PLC0415
        from ..models.inbox_status_recent_emails import InboxStatusRecentEmails # noqa: PLC0415
        ready = self.ready

        receiving_ready = self.receiving_ready

        processing_ready = self.processing_ready

        summary = self.summary

        next_actions = []
        for next_actions_item_data in self.next_actions:
            next_actions_item = next_actions_item_data.to_dict()
            next_actions.append(next_actions_item)



        domains = []
        for domains_item_data in self.domains:
            domains_item = domains_item_data.to_dict()
            domains.append(domains_item)



        endpoints = self.endpoints.to_dict()

        functions = self.functions.to_dict()

        recent_emails = self.recent_emails.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "ready": ready,
            "receiving_ready": receiving_ready,
            "processing_ready": processing_ready,
            "summary": summary,
            "next_actions": next_actions,
            "domains": domains,
            "endpoints": endpoints,
            "functions": functions,
            "recent_emails": recent_emails,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.inbox_status_domain import InboxStatusDomain # noqa: PLC0415
        from ..models.inbox_status_endpoints import InboxStatusEndpoints # noqa: PLC0415
        from ..models.inbox_status_functions import InboxStatusFunctions # noqa: PLC0415
        from ..models.inbox_status_next_action import InboxStatusNextAction # noqa: PLC0415
        from ..models.inbox_status_recent_emails import InboxStatusRecentEmails # noqa: PLC0415
        d = dict(src_dict)
        ready = d.pop("ready")

        receiving_ready = d.pop("receiving_ready")

        processing_ready = d.pop("processing_ready")

        summary = d.pop("summary")

        next_actions = []
        _next_actions = d.pop("next_actions")
        for next_actions_item_data in (_next_actions):
            next_actions_item = InboxStatusNextAction.from_dict(next_actions_item_data)



            next_actions.append(next_actions_item)


        domains = []
        _domains = d.pop("domains")
        for domains_item_data in (_domains):
            domains_item = InboxStatusDomain.from_dict(domains_item_data)



            domains.append(domains_item)


        endpoints = InboxStatusEndpoints.from_dict(d.pop("endpoints"))




        functions = InboxStatusFunctions.from_dict(d.pop("functions"))




        recent_emails = InboxStatusRecentEmails.from_dict(d.pop("recent_emails"))




        inbox_status = cls(
            ready=ready,
            receiving_ready=receiving_ready,
            processing_ready=processing_ready,
            summary=summary,
            next_actions=next_actions,
            domains=domains,
            endpoints=endpoints,
            functions=functions,
            recent_emails=recent_emails,
        )


        inbox_status.additional_properties = d
        return inbox_status

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
