from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.delivery_status import DeliveryStatus
from ..models.sent_email_status import SentEmailStatus
from typing import cast






T = TypeVar("T", bound="SendMailResult")



@_attrs_define
class SendMailResult:
    """ 
        Attributes:
            id (str): Persisted sent-email attempt ID.
            status (SentEmailStatus):
            queue_id (None | str): Message identifier assigned by Primitive's outbound relay, when available.
            accepted (list[str]): Recipient addresses accepted by the relay.
            rejected (list[str]): Recipient addresses rejected by the relay.
            client_idempotency_key (str): Effective idempotency key used for this send.
            request_id (str): Server-issued request identifier for support and tracing.
            content_hash (str): Stable hash of the canonical send payload.
            delivery_status (DeliveryStatus | Unset):
            smtp_response_code (int | None | Unset): SMTP response code from the first downstream delivery outcome when wait
                is true.
            smtp_response_text (str | Unset): SMTP response text from the first downstream delivery outcome when wait is
                true.
     """

    id: str
    status: SentEmailStatus
    queue_id: None | str
    accepted: list[str]
    rejected: list[str]
    client_idempotency_key: str
    request_id: str
    content_hash: str
    delivery_status: DeliveryStatus | Unset = UNSET
    smtp_response_code: int | None | Unset = UNSET
    smtp_response_text: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        status = self.status.value

        queue_id: None | str
        queue_id = self.queue_id

        accepted = self.accepted



        rejected = self.rejected



        client_idempotency_key = self.client_idempotency_key

        request_id = self.request_id

        content_hash = self.content_hash

        delivery_status: str | Unset = UNSET
        if not isinstance(self.delivery_status, Unset):
            delivery_status = self.delivery_status.value


        smtp_response_code: int | None | Unset
        if isinstance(self.smtp_response_code, Unset):
            smtp_response_code = UNSET
        else:
            smtp_response_code = self.smtp_response_code

        smtp_response_text = self.smtp_response_text


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "status": status,
            "queue_id": queue_id,
            "accepted": accepted,
            "rejected": rejected,
            "client_idempotency_key": client_idempotency_key,
            "request_id": request_id,
            "content_hash": content_hash,
        })
        if delivery_status is not UNSET:
            field_dict["delivery_status"] = delivery_status
        if smtp_response_code is not UNSET:
            field_dict["smtp_response_code"] = smtp_response_code
        if smtp_response_text is not UNSET:
            field_dict["smtp_response_text"] = smtp_response_text

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        status = SentEmailStatus(d.pop("status"))




        def _parse_queue_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        queue_id = _parse_queue_id(d.pop("queue_id"))


        accepted = cast(list[str], d.pop("accepted"))


        rejected = cast(list[str], d.pop("rejected"))


        client_idempotency_key = d.pop("client_idempotency_key")

        request_id = d.pop("request_id")

        content_hash = d.pop("content_hash")

        _delivery_status = d.pop("delivery_status", UNSET)
        delivery_status: DeliveryStatus | Unset
        if isinstance(_delivery_status,  Unset):
            delivery_status = UNSET
        else:
            delivery_status = DeliveryStatus(_delivery_status)




        def _parse_smtp_response_code(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        smtp_response_code = _parse_smtp_response_code(d.pop("smtp_response_code", UNSET))


        smtp_response_text = d.pop("smtp_response_text", UNSET)

        send_mail_result = cls(
            id=id,
            status=status,
            queue_id=queue_id,
            accepted=accepted,
            rejected=rejected,
            client_idempotency_key=client_idempotency_key,
            request_id=request_id,
            content_hash=content_hash,
            delivery_status=delivery_status,
            smtp_response_code=smtp_response_code,
            smtp_response_text=smtp_response_text,
        )


        send_mail_result.additional_properties = d
        return send_mail_result

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
