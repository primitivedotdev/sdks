from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.complete_webhook_response_data import CompleteWebhookResponseData
  from ..models.complete_webhook_response_meta import CompleteWebhookResponseMeta





T = TypeVar("T", bound="CompleteWebhookResponse")



@_attrs_define
class CompleteWebhookResponse:
    """ 
        Attributes:
            success (bool):
            data (CompleteWebhookResponseData):
            meta (CompleteWebhookResponseMeta | Unset):
     """

    success: bool
    data: CompleteWebhookResponseData
    meta: CompleteWebhookResponseMeta | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.complete_webhook_response_data import CompleteWebhookResponseData
        from ..models.complete_webhook_response_meta import CompleteWebhookResponseMeta
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
        from ..models.complete_webhook_response_data import CompleteWebhookResponseData
        from ..models.complete_webhook_response_meta import CompleteWebhookResponseMeta
        d = dict(src_dict)
        success = d.pop("success")

        data = CompleteWebhookResponseData.from_dict(d.pop("data"))




        _meta = d.pop("meta", UNSET)
        meta: CompleteWebhookResponseMeta | Unset
        if isinstance(_meta,  Unset):
            meta = UNSET
        else:
            meta = CompleteWebhookResponseMeta.from_dict(_meta)




        complete_webhook_response = cls(
            success=success,
            data=data,
            meta=meta,
        )


        complete_webhook_response.additional_properties = d
        return complete_webhook_response

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
