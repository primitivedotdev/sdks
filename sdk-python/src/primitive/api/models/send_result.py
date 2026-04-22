from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.send_result_status import SendResultStatus
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="SendResult")



@_attrs_define
class SendResult:
    """ 
        Attributes:
            id (UUID):
            status (SendResultStatus):
            smtp_code (int | None): Final SMTP status code reported by the downstream SMTP transaction
            smtp_message (None | str): Final SMTP status message, if available
            remote_host (None | str): Recipient MX host contacted for the SMTP transaction
            service_message_id (None | str): Message identifier assigned by Primitive's outbound SMTP service
     """

    id: UUID
    status: SendResultStatus
    smtp_code: int | None
    smtp_message: None | str
    remote_host: None | str
    service_message_id: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        status = self.status.value

        smtp_code: int | None
        smtp_code = self.smtp_code

        smtp_message: None | str
        smtp_message = self.smtp_message

        remote_host: None | str
        remote_host = self.remote_host

        service_message_id: None | str
        service_message_id = self.service_message_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "status": status,
            "smtp_code": smtp_code,
            "smtp_message": smtp_message,
            "remote_host": remote_host,
            "service_message_id": service_message_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        status = SendResultStatus(d.pop("status"))




        def _parse_smtp_code(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        smtp_code = _parse_smtp_code(d.pop("smtp_code"))


        def _parse_smtp_message(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        smtp_message = _parse_smtp_message(d.pop("smtp_message"))


        def _parse_remote_host(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        remote_host = _parse_remote_host(d.pop("remote_host"))


        def _parse_service_message_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        service_message_id = _parse_service_message_id(d.pop("service_message_id"))


        send_result = cls(
            id=id,
            status=status,
            smtp_code=smtp_code,
            smtp_message=smtp_message,
            remote_host=remote_host,
            service_message_id=service_message_id,
        )


        send_result.additional_properties = d
        return send_result

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
