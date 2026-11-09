from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.prepare_contact_acceptance_response_200_data_request import PrepareContactAcceptanceResponse200DataRequest
  from ..models.prepare_contact_acceptance_response_200_data_send import PrepareContactAcceptanceResponse200DataSend





T = TypeVar("T", bound="PrepareContactAcceptanceResponse200Data")



@_attrs_define
class PrepareContactAcceptanceResponse200Data:
    """ 
        Attributes:
            request (PrepareContactAcceptanceResponse200DataRequest): Identity of the prepared step. Keep interaction_id,
                step_id and expires_at to match a later acceptance.
            send (PrepareContactAcceptanceResponse200DataSend): The exact request to make next, unchanged: method, path,
                headers (including Idempotency-Key) and JSON body.
     """

    request: PrepareContactAcceptanceResponse200DataRequest
    send: PrepareContactAcceptanceResponse200DataSend
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.prepare_contact_acceptance_response_200_data_request import PrepareContactAcceptanceResponse200DataRequest # noqa: PLC0415
        from ..models.prepare_contact_acceptance_response_200_data_send import PrepareContactAcceptanceResponse200DataSend # noqa: PLC0415
        request = self.request.to_dict()

        send = self.send.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "request": request,
            "send": send,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.prepare_contact_acceptance_response_200_data_request import PrepareContactAcceptanceResponse200DataRequest # noqa: PLC0415
        from ..models.prepare_contact_acceptance_response_200_data_send import PrepareContactAcceptanceResponse200DataSend # noqa: PLC0415
        d = dict(src_dict)
        request = PrepareContactAcceptanceResponse200DataRequest.from_dict(d.pop("request"))




        send = PrepareContactAcceptanceResponse200DataSend.from_dict(d.pop("send"))




        prepare_contact_acceptance_response_200_data = cls(
            request=request,
            send=send,
        )


        prepare_contact_acceptance_response_200_data.additional_properties = d
        return prepare_contact_acceptance_response_200_data

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
