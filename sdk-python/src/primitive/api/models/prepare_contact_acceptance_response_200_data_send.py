from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.prepare_contact_acceptance_response_200_data_send_method import PrepareContactAcceptanceResponse200DataSendMethod
from typing import cast

if TYPE_CHECKING:
  from ..models.prepare_contact_acceptance_response_200_data_send_body import PrepareContactAcceptanceResponse200DataSendBody
  from ..models.prepare_contact_acceptance_response_200_data_send_headers import PrepareContactAcceptanceResponse200DataSendHeaders





T = TypeVar("T", bound="PrepareContactAcceptanceResponse200DataSend")



@_attrs_define
class PrepareContactAcceptanceResponse200DataSend:
    """ The exact request to make next, unchanged: method, path, headers (including Idempotency-Key) and JSON body.

        Attributes:
            method (PrepareContactAcceptanceResponse200DataSendMethod | Unset):
            path (str | Unset):
            headers (PrepareContactAcceptanceResponse200DataSendHeaders | Unset):
            body (PrepareContactAcceptanceResponse200DataSendBody | Unset):
     """

    method: PrepareContactAcceptanceResponse200DataSendMethod | Unset = UNSET
    path: str | Unset = UNSET
    headers: PrepareContactAcceptanceResponse200DataSendHeaders | Unset = UNSET
    body: PrepareContactAcceptanceResponse200DataSendBody | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.prepare_contact_acceptance_response_200_data_send_body import PrepareContactAcceptanceResponse200DataSendBody # noqa: PLC0415
        from ..models.prepare_contact_acceptance_response_200_data_send_headers import PrepareContactAcceptanceResponse200DataSendHeaders # noqa: PLC0415
        method: str | Unset = UNSET
        if not isinstance(self.method, Unset):
            method = self.method.value


        path = self.path

        headers: dict[str, Any] | Unset = UNSET
        if not isinstance(self.headers, Unset):
            headers = self.headers.to_dict()

        body: dict[str, Any] | Unset = UNSET
        if not isinstance(self.body, Unset):
            body = self.body.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if method is not UNSET:
            field_dict["method"] = method
        if path is not UNSET:
            field_dict["path"] = path
        if headers is not UNSET:
            field_dict["headers"] = headers
        if body is not UNSET:
            field_dict["body"] = body

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.prepare_contact_acceptance_response_200_data_send_body import PrepareContactAcceptanceResponse200DataSendBody # noqa: PLC0415
        from ..models.prepare_contact_acceptance_response_200_data_send_headers import PrepareContactAcceptanceResponse200DataSendHeaders # noqa: PLC0415
        d = dict(src_dict)
        _method = d.pop("method", UNSET)
        method: PrepareContactAcceptanceResponse200DataSendMethod | Unset
        if isinstance(_method,  Unset):
            method = UNSET
        else:
            method = PrepareContactAcceptanceResponse200DataSendMethod(_method)




        path = d.pop("path", UNSET)

        _headers = d.pop("headers", UNSET)
        headers: PrepareContactAcceptanceResponse200DataSendHeaders | Unset
        if isinstance(_headers,  Unset):
            headers = UNSET
        else:
            headers = PrepareContactAcceptanceResponse200DataSendHeaders.from_dict(_headers)




        _body = d.pop("body", UNSET)
        body: PrepareContactAcceptanceResponse200DataSendBody | Unset
        if isinstance(_body,  Unset):
            body = UNSET
        else:
            body = PrepareContactAcceptanceResponse200DataSendBody.from_dict(_body)




        prepare_contact_acceptance_response_200_data_send = cls(
            method=method,
            path=path,
            headers=headers,
            body=body,
        )


        prepare_contact_acceptance_response_200_data_send.additional_properties = d
        return prepare_contact_acceptance_response_200_data_send

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
