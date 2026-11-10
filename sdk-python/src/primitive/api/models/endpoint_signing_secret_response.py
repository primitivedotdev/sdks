from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.endpoint_signing_secret_response_data import EndpointSigningSecretResponseData
  from ..models.endpoint_signing_secret_response_meta import EndpointSigningSecretResponseMeta





T = TypeVar("T", bound="EndpointSigningSecretResponse")



@_attrs_define
class EndpointSigningSecretResponse:
    """ 
        Attributes:
            success (bool):
            data (EndpointSigningSecretResponseData):
            meta (EndpointSigningSecretResponseMeta | Unset):
     """

    success: bool
    data: EndpointSigningSecretResponseData
    meta: EndpointSigningSecretResponseMeta | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.endpoint_signing_secret_response_data import EndpointSigningSecretResponseData # noqa: PLC0415
        from ..models.endpoint_signing_secret_response_meta import EndpointSigningSecretResponseMeta # noqa: PLC0415
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
        from ..models.endpoint_signing_secret_response_data import EndpointSigningSecretResponseData # noqa: PLC0415
        from ..models.endpoint_signing_secret_response_meta import EndpointSigningSecretResponseMeta # noqa: PLC0415
        d = dict(src_dict)
        success = d.pop("success")

        data = EndpointSigningSecretResponseData.from_dict(d.pop("data"))




        _meta = d.pop("meta", UNSET)
        meta: EndpointSigningSecretResponseMeta | Unset
        if isinstance(_meta,  Unset):
            meta = UNSET
        else:
            meta = EndpointSigningSecretResponseMeta.from_dict(_meta)




        endpoint_signing_secret_response = cls(
            success=success,
            data=data,
            meta=meta,
        )


        endpoint_signing_secret_response.additional_properties = d
        return endpoint_signing_secret_response

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
