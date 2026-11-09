from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.send_mail_batch_response_200_data_results_item import SendMailBatchResponse200DataResultsItem





T = TypeVar("T", bound="SendMailBatchResponse200Data")



@_attrs_define
class SendMailBatchResponse200Data:
    """ 
        Attributes:
            count (int): Number of messages in the batch.
            results (list[SendMailBatchResponse200DataResultsItem]):
            replayed_count (int | Unset): Number of messages answered with an existing send instead of being sent. Such an
                entry in `results` carries `idempotent_replay: true`, `deduplicated: true`, `original_sent_email_id` and an
                `idempotency` object: under `data` when the earlier send succeeded, and under `error.details` when it had failed
                and its stored error is replayed.
     """

    count: int
    results: list[SendMailBatchResponse200DataResultsItem]
    replayed_count: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.send_mail_batch_response_200_data_results_item import SendMailBatchResponse200DataResultsItem # noqa: PLC0415
        count = self.count

        results = []
        for results_item_data in self.results:
            results_item = results_item_data.to_dict()
            results.append(results_item)



        replayed_count = self.replayed_count


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "count": count,
            "results": results,
        })
        if replayed_count is not UNSET:
            field_dict["replayed_count"] = replayed_count

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.send_mail_batch_response_200_data_results_item import SendMailBatchResponse200DataResultsItem # noqa: PLC0415
        d = dict(src_dict)
        count = d.pop("count")

        results = []
        _results = d.pop("results")
        for results_item_data in (_results):
            results_item = SendMailBatchResponse200DataResultsItem.from_dict(results_item_data)



            results.append(results_item)


        replayed_count = d.pop("replayed_count", UNSET)

        send_mail_batch_response_200_data = cls(
            count=count,
            results=results,
            replayed_count=replayed_count,
        )


        send_mail_batch_response_200_data.additional_properties = d
        return send_mail_batch_response_200_data

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
