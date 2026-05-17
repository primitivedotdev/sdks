from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.function_test_run_state import FunctionTestRunState
from typing import cast

if TYPE_CHECKING:
  from ..models.function_log_row import FunctionLogRow
  from ..models.function_test_run import FunctionTestRun
  from ..models.function_test_run_delivery import FunctionTestRunDelivery
  from ..models.function_test_run_inbound_email_type_0 import FunctionTestRunInboundEmailType0
  from ..models.function_test_run_outbound_request import FunctionTestRunOutboundRequest
  from ..models.function_test_run_reply import FunctionTestRunReply
  from ..models.function_test_run_send_type_0 import FunctionTestRunSendType0





T = TypeVar("T", bound="FunctionTestRunTrace")



@_attrs_define
class FunctionTestRunTrace:
    """ End-to-end trace for a `POST /functions/{id}/test` run. The
    shape is stable, but many nested sections are null or empty
    until the corresponding phase has happened.

        Attributes:
            state (FunctionTestRunState): High-level state for a function test run trace:
                  - `send_failed`: the initial test email send failed.
                  - `waiting_for_send`: the test run was created but no send result has been recorded yet.
                  - `waiting_for_inbound`: the test send was queued and the matching inbound email has not arrived yet.
                  - `waiting_for_function`: the inbound email arrived and webhook/function processing is still in flight.
                  - `completed`: the function webhook completed successfully.
                  - `failed`: webhook delivery exhausted retries.
            test_run (FunctionTestRun):
            test_send (FunctionTestRunSendType0 | None):
            inbound_email (FunctionTestRunInboundEmailType0 | None):
            deliveries (list[FunctionTestRunDelivery]):
            outbound_requests (list[FunctionTestRunOutboundRequest]):
            logs (list[FunctionLogRow]):
            replies (list[FunctionTestRunReply]):
     """

    state: FunctionTestRunState
    test_run: FunctionTestRun
    test_send: FunctionTestRunSendType0 | None
    inbound_email: FunctionTestRunInboundEmailType0 | None
    deliveries: list[FunctionTestRunDelivery]
    outbound_requests: list[FunctionTestRunOutboundRequest]
    logs: list[FunctionLogRow]
    replies: list[FunctionTestRunReply]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.function_log_row import FunctionLogRow
        from ..models.function_test_run import FunctionTestRun
        from ..models.function_test_run_delivery import FunctionTestRunDelivery
        from ..models.function_test_run_inbound_email_type_0 import FunctionTestRunInboundEmailType0
        from ..models.function_test_run_outbound_request import FunctionTestRunOutboundRequest
        from ..models.function_test_run_reply import FunctionTestRunReply
        from ..models.function_test_run_send_type_0 import FunctionTestRunSendType0
        state = self.state.value

        test_run = self.test_run.to_dict()

        test_send: dict[str, Any] | None
        if isinstance(self.test_send, FunctionTestRunSendType0):
            test_send = self.test_send.to_dict()
        else:
            test_send = self.test_send

        inbound_email: dict[str, Any] | None
        if isinstance(self.inbound_email, FunctionTestRunInboundEmailType0):
            inbound_email = self.inbound_email.to_dict()
        else:
            inbound_email = self.inbound_email

        deliveries = []
        for deliveries_item_data in self.deliveries:
            deliveries_item = deliveries_item_data.to_dict()
            deliveries.append(deliveries_item)



        outbound_requests = []
        for outbound_requests_item_data in self.outbound_requests:
            outbound_requests_item = outbound_requests_item_data.to_dict()
            outbound_requests.append(outbound_requests_item)



        logs = []
        for logs_item_data in self.logs:
            logs_item = logs_item_data.to_dict()
            logs.append(logs_item)



        replies = []
        for replies_item_data in self.replies:
            replies_item = replies_item_data.to_dict()
            replies.append(replies_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "state": state,
            "test_run": test_run,
            "test_send": test_send,
            "inbound_email": inbound_email,
            "deliveries": deliveries,
            "outbound_requests": outbound_requests,
            "logs": logs,
            "replies": replies,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.function_log_row import FunctionLogRow
        from ..models.function_test_run import FunctionTestRun
        from ..models.function_test_run_delivery import FunctionTestRunDelivery
        from ..models.function_test_run_inbound_email_type_0 import FunctionTestRunInboundEmailType0
        from ..models.function_test_run_outbound_request import FunctionTestRunOutboundRequest
        from ..models.function_test_run_reply import FunctionTestRunReply
        from ..models.function_test_run_send_type_0 import FunctionTestRunSendType0
        d = dict(src_dict)
        state = FunctionTestRunState(d.pop("state"))




        test_run = FunctionTestRun.from_dict(d.pop("test_run"))




        def _parse_test_send(data: object) -> FunctionTestRunSendType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_function_test_run_send_type_0 = FunctionTestRunSendType0.from_dict(data)



                return componentsschemas_function_test_run_send_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(FunctionTestRunSendType0 | None, data)

        test_send = _parse_test_send(d.pop("test_send"))


        def _parse_inbound_email(data: object) -> FunctionTestRunInboundEmailType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_function_test_run_inbound_email_type_0 = FunctionTestRunInboundEmailType0.from_dict(data)



                return componentsschemas_function_test_run_inbound_email_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(FunctionTestRunInboundEmailType0 | None, data)

        inbound_email = _parse_inbound_email(d.pop("inbound_email"))


        deliveries = []
        _deliveries = d.pop("deliveries")
        for deliveries_item_data in (_deliveries):
            deliveries_item = FunctionTestRunDelivery.from_dict(deliveries_item_data)



            deliveries.append(deliveries_item)


        outbound_requests = []
        _outbound_requests = d.pop("outbound_requests")
        for outbound_requests_item_data in (_outbound_requests):
            outbound_requests_item = FunctionTestRunOutboundRequest.from_dict(outbound_requests_item_data)



            outbound_requests.append(outbound_requests_item)


        logs = []
        _logs = d.pop("logs")
        for logs_item_data in (_logs):
            logs_item = FunctionLogRow.from_dict(logs_item_data)



            logs.append(logs_item)


        replies = []
        _replies = d.pop("replies")
        for replies_item_data in (_replies):
            replies_item = FunctionTestRunReply.from_dict(replies_item_data)



            replies.append(replies_item)


        function_test_run_trace = cls(
            state=state,
            test_run=test_run,
            test_send=test_send,
            inbound_email=inbound_email,
            deliveries=deliveries,
            outbound_requests=outbound_requests,
            logs=logs,
            replies=replies,
        )


        function_test_run_trace.additional_properties = d
        return function_test_run_trace

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
