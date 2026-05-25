from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.inbox_status_domain import InboxStatusDomain
  from ..models.inbox_status_endpoint_summary import InboxStatusEndpointSummary
  from ..models.inbox_status_function_summary import InboxStatusFunctionSummary
  from ..models.inbox_status_next_action import InboxStatusNextAction
  from ..models.inbox_status_recent_email_summary import InboxStatusRecentEmailSummary





T = TypeVar("T", bound="InboxStatus")



@_attrs_define
class InboxStatus:
    """ 
        Attributes:
            ready (bool): True when at least one active inbound domain has an enabled processing route.
            receiving_ready (bool): True when at least one active verified or managed domain can receive mail.
            processing_ready (bool): True when at least one receiving-ready domain has an enabled webhook or function route.
            summary (str): Short human-readable status summary.
            next_actions (list[InboxStatusNextAction]):
            domains (list[InboxStatusDomain]):
            endpoints (InboxStatusEndpointSummary):
            functions (InboxStatusFunctionSummary):
            recent_emails (InboxStatusRecentEmailSummary):
     """

    ready: bool
    receiving_ready: bool
    processing_ready: bool
    summary: str
    next_actions: list[InboxStatusNextAction]
    domains: list[InboxStatusDomain]
    endpoints: InboxStatusEndpointSummary
    functions: InboxStatusFunctionSummary
    recent_emails: InboxStatusRecentEmailSummary





    def to_dict(self) -> dict[str, Any]:
        from ..models.inbox_status_domain import InboxStatusDomain
        from ..models.inbox_status_endpoint_summary import InboxStatusEndpointSummary
        from ..models.inbox_status_function_summary import InboxStatusFunctionSummary
        from ..models.inbox_status_next_action import InboxStatusNextAction
        from ..models.inbox_status_recent_email_summary import InboxStatusRecentEmailSummary
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
        from ..models.inbox_status_domain import InboxStatusDomain
        from ..models.inbox_status_endpoint_summary import InboxStatusEndpointSummary
        from ..models.inbox_status_function_summary import InboxStatusFunctionSummary
        from ..models.inbox_status_next_action import InboxStatusNextAction
        from ..models.inbox_status_recent_email_summary import InboxStatusRecentEmailSummary
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


        endpoints = InboxStatusEndpointSummary.from_dict(d.pop("endpoints"))




        functions = InboxStatusFunctionSummary.from_dict(d.pop("functions"))




        recent_emails = InboxStatusRecentEmailSummary.from_dict(d.pop("recent_emails"))




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

        return inbox_status

