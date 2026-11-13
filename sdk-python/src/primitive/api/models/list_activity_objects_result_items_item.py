from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_activity_objects_result_items_item_owned_now import ListActivityObjectsResultItemsItemOwnedNow
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.list_activity_objects_result_items_item_created_through import ListActivityObjectsResultItemsItemCreatedThrough
  from ..models.list_activity_objects_result_items_item_receivers_change import ListActivityObjectsResultItemsItemReceiversChange





T = TypeVar("T", bound="ListActivityObjectsResultItemsItem")



@_attrs_define
class ListActivityObjectsResultItemsItem:
    """ 
        Attributes:
            kind (str): One of: function, endpoint, function_trigger, pull_subscription, recipient_route, filter_rule,
                wake_schedule, repeating_send, scheduled_send, api_key, agent_connection, email_rule, email_rule_request,
                email_rule_objection, email_rule_coverage.
            id (str):
            name (None | str): The name the object is known by: an endpoint's display name, a route's or filter's pattern, a
                Function's name, a send's From address, a wake schedule's command and the address it wakes, an API key's name,
                an agent's address, a rule's or rule request's name, and for an objection or a coverage notice the name its rule
                had then. Never a webhook URL and never mail content.
            state (str): Where it stands now: enabled, disabled, deleted or replaced (endpoints and routes), enabled or
                disabled (filters, wake schedules), live, suspended or deleted (Functions), active, paused or ended (repeating
                sends), scheduled (scheduled sends), active, suspended, expired or revoked (API keys), pending, claimed,
                connected or revoked (agents), draft, observe or active (email rules), pending, accepted, declined or withdrawn
                (rule requests and objections), and for a coverage notice what it told: started (a rule was made or turned
                active over your mailboxes, or an active rule came to reach you; once per rule, not per mailbox), new_version,
                receivers_changed (who receives an active rule's matches changed: its keys, webhooks or share), or baseline (it
                already covered you when notices began). pending: a rule started covering your mailbox and the notices have not
                recorded that start yet (a restart within an hour of the last start notice is recorded without a new one); its
                id is then the rule's, and created_at when the rule last changed.
            created_at (datetime.datetime):
            ended_at (datetime.datetime | None): When it was deleted, replaced or revoked, when an API key expired, when a
                repeating send stopped, or when a rule request or objection was decided (accepted, declined or withdrawn); null
                otherwise, as on every coverage notice.
            owned_now (ListActivityObjectsResultItemsItemOwnedNow): you: it is still yours: never transferred, or
                transferred back to you. someone_else: it was transferred and another person holds it now, or, with
                relation=asked or concerning, another member made it.
            created_through (ListActivityObjectsResultItemsItemCreatedThrough):
            rule_id (UUID | Unset): For email_rule_coverage, always: the rule it is about, since names need not be unique
                (for pending, the same as id). GET /v1/email-rules/covering-me/{rule_id} shows the rule while it covers you, or
                as it last decided on your mail; otherwise it answers not_found.
            receivers_change (ListActivityObjectsResultItemsItemReceiversChange | Unset): For a receivers_changed notice:
                who received the rule's matches before and after, in totals. They can be equal when only an owner or a webhook
                site changed; covering-me shows them by owner. A rotated key counts once here while the old one still works;
                covering-me counts both.
     """

    kind: str
    id: str
    name: None | str
    state: str
    created_at: datetime.datetime
    ended_at: datetime.datetime | None
    owned_now: ListActivityObjectsResultItemsItemOwnedNow
    created_through: ListActivityObjectsResultItemsItemCreatedThrough
    rule_id: UUID | Unset = UNSET
    receivers_change: ListActivityObjectsResultItemsItemReceiversChange | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_activity_objects_result_items_item_created_through import ListActivityObjectsResultItemsItemCreatedThrough # noqa: PLC0415
        from ..models.list_activity_objects_result_items_item_receivers_change import ListActivityObjectsResultItemsItemReceiversChange # noqa: PLC0415
        kind = self.kind

        id = self.id

        name: None | str
        name = self.name

        state = self.state

        created_at = self.created_at.isoformat()

        ended_at: None | str
        if isinstance(self.ended_at, datetime.datetime):
            ended_at = self.ended_at.isoformat()
        else:
            ended_at = self.ended_at

        owned_now = self.owned_now.value

        created_through = self.created_through.to_dict()

        rule_id: str | Unset = UNSET
        if not isinstance(self.rule_id, Unset):
            rule_id = str(self.rule_id)

        receivers_change: dict[str, Any] | Unset = UNSET
        if not isinstance(self.receivers_change, Unset):
            receivers_change = self.receivers_change.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "id": id,
            "name": name,
            "state": state,
            "created_at": created_at,
            "ended_at": ended_at,
            "owned_now": owned_now,
            "created_through": created_through,
        })
        if rule_id is not UNSET:
            field_dict["rule_id"] = rule_id
        if receivers_change is not UNSET:
            field_dict["receivers_change"] = receivers_change

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_activity_objects_result_items_item_created_through import ListActivityObjectsResultItemsItemCreatedThrough # noqa: PLC0415
        from ..models.list_activity_objects_result_items_item_receivers_change import ListActivityObjectsResultItemsItemReceiversChange # noqa: PLC0415
        d = dict(src_dict)
        kind = d.pop("kind")

        id = d.pop("id")

        def _parse_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        name = _parse_name(d.pop("name"))


        state = d.pop("state")

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        def _parse_ended_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                ended_at_type_0 = datetime.datetime.fromisoformat(data)



                return ended_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        ended_at = _parse_ended_at(d.pop("ended_at"))


        owned_now = ListActivityObjectsResultItemsItemOwnedNow(d.pop("owned_now"))




        created_through = ListActivityObjectsResultItemsItemCreatedThrough.from_dict(d.pop("created_through"))




        _rule_id = d.pop("rule_id", UNSET)
        rule_id: UUID | Unset
        if isinstance(_rule_id,  Unset):
            rule_id = UNSET
        else:
            rule_id = UUID(_rule_id)




        _receivers_change = d.pop("receivers_change", UNSET)
        receivers_change: ListActivityObjectsResultItemsItemReceiversChange | Unset
        if isinstance(_receivers_change,  Unset):
            receivers_change = UNSET
        else:
            receivers_change = ListActivityObjectsResultItemsItemReceiversChange.from_dict(_receivers_change)




        list_activity_objects_result_items_item = cls(
            kind=kind,
            id=id,
            name=name,
            state=state,
            created_at=created_at,
            ended_at=ended_at,
            owned_now=owned_now,
            created_through=created_through,
            rule_id=rule_id,
            receivers_change=receivers_change,
        )


        list_activity_objects_result_items_item.additional_properties = d
        return list_activity_objects_result_items_item

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
