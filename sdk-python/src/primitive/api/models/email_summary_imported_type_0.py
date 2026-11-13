from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_summary_imported_type_0_from import EmailSummaryImportedType0From
from ..models.email_summary_imported_type_0_method import EmailSummaryImportedType0Method
from ..models.email_summary_imported_type_0_verification import EmailSummaryImportedType0Verification
from typing import cast
import datetime






T = TypeVar("T", bound="EmailSummaryImportedType0")



@_attrs_define
class EmailSummaryImportedType0:
    """ Historical acquisition; never sender or SMTP delivery proof. Null for live mail. Excluded from live tails and
    deltas.

        Attributes:
            from_ (EmailSummaryImportedType0From):
            method (EmailSummaryImportedType0Method):
            verification (EmailSummaryImportedType0Verification):
            at (datetime.datetime): When Primitive acquired this historical message.
     """

    from_: EmailSummaryImportedType0From
    method: EmailSummaryImportedType0Method
    verification: EmailSummaryImportedType0Verification
    at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from_ = self.from_.value

        method = self.method.value

        verification = self.verification.value

        at = self.at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "from": from_,
            "method": method,
            "verification": verification,
            "at": at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        from_ = EmailSummaryImportedType0From(d.pop("from"))




        method = EmailSummaryImportedType0Method(d.pop("method"))




        verification = EmailSummaryImportedType0Verification(d.pop("verification"))




        at = datetime.datetime.fromisoformat(d.pop("at"))




        email_summary_imported_type_0 = cls(
            from_=from_,
            method=method,
            verification=verification,
            at=at,
        )


        email_summary_imported_type_0.additional_properties = d
        return email_summary_imported_type_0

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
