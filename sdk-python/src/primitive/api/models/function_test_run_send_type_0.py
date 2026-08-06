from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.sent_email_status import SentEmailStatus
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="FunctionTestRunSendType0")



@_attrs_define
class FunctionTestRunSendType0:
    """ 
        Attributes:
            id (UUID):
            status (SentEmailStatus): Lifecycle status of a sent_emails row. Possible values:

                  - `queued`: pre-call INSERT; the outbound agent has not
                    yet replied.
                  - `submitted_to_agent`: agent accepted; `queue_id` is set.
                  - `agent_failed`: agent rejected; `error_code` and
                    `error_message` carry the reason.
                  - `gate_denied`: a recipient-scope gate denied the send;
                    the agent was never called. The `gates` array carries
                    the denial detail. /send-mail returns 403 in this case
                    so callers see the denial synchronously; /sent-emails
                    additionally records the row for historical lookup,
                    which is when this status appears in a listing.
                  - `unknown`: terminal indeterminate; the on-box log
                    poller couldn't classify the receiver's response.
                  - `delivered` / `bounced` / `deferred` / `wait_timeout`:
                    terminal delivery outcomes (see DeliveryStatus).
                  - `scheduled`: created with a future `scheduled_at` and
                    not yet executed; `scheduled_at` carries the pending
                    execution time. Reschedulable via PATCH
                    /sent-emails/{id} and cancelable via
                    /sent-emails/{id}/cancel while in this status.
                  - `canceled`: terminal; a scheduled send canceled before
                    execution. `canceled_at` carries the cancellation time
                    and nothing was dispatched.
            queue_id (None | str):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
     """

    id: UUID
    status: SentEmailStatus
    queue_id: None | str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        status = self.status.value

        queue_id: None | str
        queue_id = self.queue_id

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "status": status,
            "queue_id": queue_id,
            "created_at": created_at,
            "updated_at": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        status = SentEmailStatus(d.pop("status"))




        def _parse_queue_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        queue_id = _parse_queue_id(d.pop("queue_id"))


        created_at = isoparse(d.pop("created_at"))




        updated_at = isoparse(d.pop("updated_at"))




        function_test_run_send_type_0 = cls(
            id=id,
            status=status,
            queue_id=queue_id,
            created_at=created_at,
            updated_at=updated_at,
        )


        function_test_run_send_type_0.additional_properties = d
        return function_test_run_send_type_0

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
