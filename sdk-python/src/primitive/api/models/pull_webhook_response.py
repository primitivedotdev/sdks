from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.pull_webhook_response_data import PullWebhookResponseData
  from ..models.pull_webhook_response_meta import PullWebhookResponseMeta





T = TypeVar("T", bound="PullWebhookResponse")



@_attrs_define
class PullWebhookResponse:
    """ 
        Attributes:
            success (bool):
            data (PullWebhookResponseData):
            meta (PullWebhookResponseMeta | Unset):
     """

    success: bool
    data: PullWebhookResponseData
    meta: PullWebhookResponseMeta | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.pull_webhook_response_data import PullWebhookResponseData
        from ..models.pull_webhook_response_meta import PullWebhookResponseMeta
        success = self.success

        data = self.data.to_dict()

        meta: dict[str, Any] | Unset = UNSET
        if not isinstance(self.meta, Unset):
            meta = self.meta.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "success": success,
            "data": data,
        })
        if meta is not UNSET:
            field_dict["meta"] = meta

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.pull_webhook_response_data import PullWebhookResponseData
        from ..models.pull_webhook_response_meta import PullWebhookResponseMeta
        d = dict(src_dict)
        success = d.pop("success")

        data = PullWebhookResponseData.from_dict(d.pop("data"))




        _meta = d.pop("meta", UNSET)
        meta: PullWebhookResponseMeta | Unset
        if isinstance(_meta,  Unset):
            meta = UNSET
        else:
            meta = PullWebhookResponseMeta.from_dict(_meta)




        pull_webhook_response = cls(
            success=success,
            data=data,
            meta=meta,
        )


        pull_webhook_response.additional_properties = d
        return pull_webhook_response

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
