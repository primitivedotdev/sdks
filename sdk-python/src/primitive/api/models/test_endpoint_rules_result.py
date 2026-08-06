from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.test_endpoint_rules_result_evaluated import TestEndpointRulesResultEvaluated





T = TypeVar("T", bound="TestEndpointRulesResult")



@_attrs_define
class TestEndpointRulesResult:
    """ Verdict of a dry-run rule evaluation. Produced by the same
    shared matcher the live delivery paths use.

        Attributes:
            would_deliver (bool): Whether the delivery path would deliver this email to the endpoint.
            rule (None | str): Name of the failing rule when delivery would be
                suppressed; null when the message matches and the
                endpoint is subscribed to the event type.
            reason (None | str): Human-readable explanation of the failing rule; null when the message matches.
            rules_valid (bool): False when the endpoint's stored rules blob failed
                validation. Delivery fails OPEN on an invalid blob
                (delivers as if unfiltered), so false here surfaces a
                misconfiguration that is otherwise silent.
            subscribed_to_event (bool): Whether the endpoint's event-type subscription includes
                this email's event type. A separate gate applied before
                message matching, surfaced independently so an
                unsubscribed endpoint is distinguishable from a rule
                rejection.
            event_type (str): The event type this email would be delivered as.
            evaluated (TestEndpointRulesResultEvaluated): The message metadata the matcher compared, so the caller
                can see WHAT was evaluated (in particular the
                authenticated From identity versus the raw envelope
                sender).
     """

    would_deliver: bool
    rule: None | str
    reason: None | str
    rules_valid: bool
    subscribed_to_event: bool
    event_type: str
    evaluated: TestEndpointRulesResultEvaluated
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.test_endpoint_rules_result_evaluated import TestEndpointRulesResultEvaluated
        would_deliver = self.would_deliver

        rule: None | str
        rule = self.rule

        reason: None | str
        reason = self.reason

        rules_valid = self.rules_valid

        subscribed_to_event = self.subscribed_to_event

        event_type = self.event_type

        evaluated = self.evaluated.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "would_deliver": would_deliver,
            "rule": rule,
            "reason": reason,
            "rules_valid": rules_valid,
            "subscribed_to_event": subscribed_to_event,
            "event_type": event_type,
            "evaluated": evaluated,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.test_endpoint_rules_result_evaluated import TestEndpointRulesResultEvaluated
        d = dict(src_dict)
        would_deliver = d.pop("would_deliver")

        def _parse_rule(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        rule = _parse_rule(d.pop("rule"))


        def _parse_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        reason = _parse_reason(d.pop("reason"))


        rules_valid = d.pop("rules_valid")

        subscribed_to_event = d.pop("subscribed_to_event")

        event_type = d.pop("event_type")

        evaluated = TestEndpointRulesResultEvaluated.from_dict(d.pop("evaluated"))




        test_endpoint_rules_result = cls(
            would_deliver=would_deliver,
            rule=rule,
            reason=reason,
            rules_valid=rules_valid,
            subscribed_to_event=subscribed_to_event,
            event_type=event_type,
            evaluated=evaluated,
        )


        test_endpoint_rules_result.additional_properties = d
        return test_endpoint_rules_result

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
