from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.outbound_status_domain import OutboundStatusDomain
  from ..models.outbound_status_next_actions_item import OutboundStatusNextActionsItem





T = TypeVar("T", bound="OutboundStatus")



@_attrs_define
class OutboundStatus:
    """ Outbound sending readiness for the caller's org, the outbound
    mirror of InboxStatus.

        Attributes:
            ready (bool): True when at least one domain is sendable right now.
            summary (str): Short human-readable status summary.
            sendable_domains (list[str]): Flat, sorted list of From-domains the org may send from
                right now. The same set echoed in a
                `cannot_send_from_domain` error's `details.valid_senders`,
                so recovery from that error and orientation here agree.
            domains (list[OutboundStatusDomain]):
            next_actions (list[OutboundStatusNextActionsItem]): Concrete remediation steps for domains that are not yet
                sendable. The server contract leaves entries open-ended;
                in practice each carries a `kind`, a human-readable
                `message`, and, when there is an obvious next step, a
                suggested CLI `command`.
     """

    ready: bool
    summary: str
    sendable_domains: list[str]
    domains: list[OutboundStatusDomain]
    next_actions: list[OutboundStatusNextActionsItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.outbound_status_domain import OutboundStatusDomain
        from ..models.outbound_status_next_actions_item import OutboundStatusNextActionsItem
        ready = self.ready

        summary = self.summary

        sendable_domains = self.sendable_domains



        domains = []
        for domains_item_data in self.domains:
            domains_item = domains_item_data.to_dict()
            domains.append(domains_item)



        next_actions = []
        for next_actions_item_data in self.next_actions:
            next_actions_item = next_actions_item_data.to_dict()
            next_actions.append(next_actions_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "ready": ready,
            "summary": summary,
            "sendable_domains": sendable_domains,
            "domains": domains,
            "next_actions": next_actions,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.outbound_status_domain import OutboundStatusDomain
        from ..models.outbound_status_next_actions_item import OutboundStatusNextActionsItem
        d = dict(src_dict)
        ready = d.pop("ready")

        summary = d.pop("summary")

        sendable_domains = cast(list[str], d.pop("sendable_domains"))


        domains = []
        _domains = d.pop("domains")
        for domains_item_data in (_domains):
            domains_item = OutboundStatusDomain.from_dict(domains_item_data)



            domains.append(domains_item)


        next_actions = []
        _next_actions = d.pop("next_actions")
        for next_actions_item_data in (_next_actions):
            next_actions_item = OutboundStatusNextActionsItem.from_dict(next_actions_item_data)



            next_actions.append(next_actions_item)


        outbound_status = cls(
            ready=ready,
            summary=summary,
            sendable_domains=sendable_domains,
            domains=domains,
            next_actions=next_actions,
        )

        return outbound_status

