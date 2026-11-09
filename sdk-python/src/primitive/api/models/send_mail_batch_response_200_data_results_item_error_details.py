from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.send_mail_batch_response_200_data_results_item_error_details_dedup_reason_type_1 import SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType1
from ..models.send_mail_batch_response_200_data_results_item_error_details_dedup_reason_type_2_type_1 import SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType2Type1
from ..models.send_mail_batch_response_200_data_results_item_error_details_dedup_reason_type_3_type_1 import SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType3Type1
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.send_mail_idempotency_replay import SendMailIdempotencyReplay





T = TypeVar("T", bound="SendMailBatchResponse200DataResultsItemErrorDetails")



@_attrs_define
class SendMailBatchResponse200DataResultsItemErrorDetails:
    """ Structured detail for the error, when there is any. On the replay of a stored failure it carries the replay signal.

        Attributes:
            idempotent_replay (bool | Unset): True when this error is the stored outcome of an earlier send and nothing was
                sent for this message.
            idempotency (SendMailIdempotencyReplay | Unset): Present only when the request was answered with an existing
                send instead of making a new one (`idempotent_replay: true`). Nothing was sent for this request. Says how the
                idempotency key was derived and which send the request collapsed onto.
            dedup_reason (None | SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType1 |
                SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType2Type1 |
                SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType3Type1 | Unset): Why the request was answered
                with an existing send. Set on every replay (`idempotent_replay: true`), whether it answers with `200` or with
                the stored error of an earlier send that failed. `content_hash_match`: the request's idempotency key matched an
                earlier send. That key is the `Idempotency-Key` header when one was sent, otherwise the key derived from the
                request content (see `idempotency.key_source`). `parent_already_replied`: a send with no `Idempotency-Key`
                collapsed onto an earlier reply to the same inbound email made in the last 5 minutes (at any time for a retry
                from the same Function answering the same inbound email) with the same credential, the same `from`, the same set
                of recipients (`to`, `cc`, `bcc`) and the same `in_reply_to`, even though its body differs. Any other difference
                is sent. Pass an `Idempotency-Key` to send a second reply. Absent or null on a request that made a send of its
                own.
            deduplicated (bool | Unset): Present and `true` when nothing was sent for this request because it collapsed onto
                an earlier send (`original_sent_email_id`). Absent on a request that made a send of its own.
            original_sent_email_id (UUID | Unset): With `deduplicated: true`: the earlier send this request collapsed onto.
                Same value as `id`.
     """

    idempotent_replay: bool | Unset = UNSET
    idempotency: SendMailIdempotencyReplay | Unset = UNSET
    dedup_reason: None | SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType1 | SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType2Type1 | SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType3Type1 | Unset = UNSET
    deduplicated: bool | Unset = UNSET
    original_sent_email_id: UUID | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.send_mail_idempotency_replay import SendMailIdempotencyReplay # noqa: PLC0415
        idempotent_replay = self.idempotent_replay

        idempotency: dict[str, Any] | Unset = UNSET
        if not isinstance(self.idempotency, Unset):
            idempotency = self.idempotency.to_dict()

        dedup_reason: None | str | Unset
        if isinstance(self.dedup_reason, Unset):
            dedup_reason = UNSET
        elif isinstance(self.dedup_reason, SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType1):
            dedup_reason = self.dedup_reason.value
        elif isinstance(self.dedup_reason, SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType2Type1):
            dedup_reason = self.dedup_reason.value
        elif isinstance(self.dedup_reason, SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType3Type1):
            dedup_reason = self.dedup_reason.value
        else:
            dedup_reason = self.dedup_reason

        deduplicated = self.deduplicated

        original_sent_email_id: str | Unset = UNSET
        if not isinstance(self.original_sent_email_id, Unset):
            original_sent_email_id = str(self.original_sent_email_id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if idempotent_replay is not UNSET:
            field_dict["idempotent_replay"] = idempotent_replay
        if idempotency is not UNSET:
            field_dict["idempotency"] = idempotency
        if dedup_reason is not UNSET:
            field_dict["dedup_reason"] = dedup_reason
        if deduplicated is not UNSET:
            field_dict["deduplicated"] = deduplicated
        if original_sent_email_id is not UNSET:
            field_dict["original_sent_email_id"] = original_sent_email_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.send_mail_idempotency_replay import SendMailIdempotencyReplay # noqa: PLC0415
        d = dict(src_dict)
        idempotent_replay = d.pop("idempotent_replay", UNSET)

        _idempotency = d.pop("idempotency", UNSET)
        idempotency: SendMailIdempotencyReplay | Unset
        if isinstance(_idempotency,  Unset):
            idempotency = UNSET
        else:
            idempotency = SendMailIdempotencyReplay.from_dict(_idempotency)




        def _parse_dedup_reason(data: object) -> None | SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType1 | SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType2Type1 | SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType3Type1 | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                dedup_reason_type_1 = SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType1(data)



                return dedup_reason_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                dedup_reason_type_2_type_1 = SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType2Type1(data)



                return dedup_reason_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                dedup_reason_type_3_type_1 = SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType3Type1(data)



                return dedup_reason_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType1 | SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType2Type1 | SendMailBatchResponse200DataResultsItemErrorDetailsDedupReasonType3Type1 | Unset, data)

        dedup_reason = _parse_dedup_reason(d.pop("dedup_reason", UNSET))


        deduplicated = d.pop("deduplicated", UNSET)

        _original_sent_email_id = d.pop("original_sent_email_id", UNSET)
        original_sent_email_id: UUID | Unset
        if isinstance(_original_sent_email_id,  Unset):
            original_sent_email_id = UNSET
        else:
            original_sent_email_id = UUID(_original_sent_email_id)




        send_mail_batch_response_200_data_results_item_error_details = cls(
            idempotent_replay=idempotent_replay,
            idempotency=idempotency,
            dedup_reason=dedup_reason,
            deduplicated=deduplicated,
            original_sent_email_id=original_sent_email_id,
        )


        send_mail_batch_response_200_data_results_item_error_details.additional_properties = d
        return send_mail_batch_response_200_data_results_item_error_details

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
