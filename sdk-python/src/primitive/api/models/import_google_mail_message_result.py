from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.import_google_mail_message_result_reason import ImportGoogleMailMessageResultReason
from ..models.import_google_mail_message_result_status import ImportGoogleMailMessageResultStatus
from uuid import UUID






T = TypeVar("T", bound="ImportGoogleMailMessageResult")



@_attrs_define
class ImportGoogleMailMessageResult:
    """ 
        Attributes:
            status (ImportGoogleMailMessageResultStatus):
            email_id (UUID | Unset):
            reason (ImportGoogleMailMessageResultReason | Unset):
     """

    status: ImportGoogleMailMessageResultStatus
    email_id: UUID | Unset = UNSET
    reason: ImportGoogleMailMessageResultReason | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        status = self.status.value

        email_id: str | Unset = UNSET
        if not isinstance(self.email_id, Unset):
            email_id = str(self.email_id)

        reason: str | Unset = UNSET
        if not isinstance(self.reason, Unset):
            reason = self.reason.value



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "status": status,
        })
        if email_id is not UNSET:
            field_dict["email_id"] = email_id
        if reason is not UNSET:
            field_dict["reason"] = reason

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        status = ImportGoogleMailMessageResultStatus(d.pop("status"))




        _email_id = d.pop("email_id", UNSET)
        email_id: UUID | Unset
        if isinstance(_email_id,  Unset):
            email_id = UNSET
        else:
            email_id = UUID(_email_id)




        _reason = d.pop("reason", UNSET)
        reason: ImportGoogleMailMessageResultReason | Unset
        if isinstance(_reason,  Unset):
            reason = UNSET
        else:
            reason = ImportGoogleMailMessageResultReason(_reason)




        import_google_mail_message_result = cls(
            status=status,
            email_id=email_id,
            reason=reason,
        )


        import_google_mail_message_result.additional_properties = d
        return import_google_mail_message_result

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
