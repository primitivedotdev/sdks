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






T = TypeVar("T", bound="TestInvocationResult")



@_attrs_define
class TestInvocationResult:
    """ Metadata returned by POST /functions/{id}/test. The send is
    queued; poll `trace_url` to watch the run progress through
    send -> inbound -> webhook deliveries -> outbound requests,
    logs, and replies.

        Attributes:
            test_run_id (UUID): Durable test run id used to fetch the run trace.
            inbound_domain (str): Verified inbound domain the test email was sent to.
            to (str): Synthetic local-part plus inbound_domain. Visible in the org's inbox.
            from_ (str): Primitive-controlled outbound sender used for the test.
            send_id (str): Outbound message id from the underlying send. NOT the
                inbound email's id; the inbound id is created when the
                email arrives via MX and lands on the function's
                invocations list.
            subject (str): Subject placed on the test email so it can be located in the inbox.
            poll_since (datetime.datetime): ISO timestamp suitable as a `since` lower bound when
                polling /emails for the inbound's arrival. Captured
                slightly before the send to absorb light clock skew.
            watch_url (str): Function detail page where invocations show up live.
            trace_url (str): Relative API URL for GET /functions/{id}/test-runs/{test_run_id}/trace.
     """

    test_run_id: UUID
    inbound_domain: str
    to: str
    from_: str
    send_id: str
    subject: str
    poll_since: datetime.datetime
    watch_url: str
    trace_url: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        test_run_id = str(self.test_run_id)

        inbound_domain = self.inbound_domain

        to = self.to

        from_ = self.from_

        send_id = self.send_id

        subject = self.subject

        poll_since = self.poll_since.isoformat()

        watch_url = self.watch_url

        trace_url = self.trace_url


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "test_run_id": test_run_id,
            "inbound_domain": inbound_domain,
            "to": to,
            "from": from_,
            "send_id": send_id,
            "subject": subject,
            "poll_since": poll_since,
            "watch_url": watch_url,
            "trace_url": trace_url,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        test_run_id = UUID(d.pop("test_run_id"))




        inbound_domain = d.pop("inbound_domain")

        to = d.pop("to")

        from_ = d.pop("from")

        send_id = d.pop("send_id")

        subject = d.pop("subject")

        poll_since = isoparse(d.pop("poll_since"))




        watch_url = d.pop("watch_url")

        trace_url = d.pop("trace_url")

        test_invocation_result = cls(
            test_run_id=test_run_id,
            inbound_domain=inbound_domain,
            to=to,
            from_=from_,
            send_id=send_id,
            subject=subject,
            poll_since=poll_since,
            watch_url=watch_url,
            trace_url=trace_url,
        )


        test_invocation_result.additional_properties = d
        return test_invocation_result

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
