from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="VerifiedDomain")



@_attrs_define
class VerifiedDomain:
    """ 
        Attributes:
            id (UUID):
            org_id (UUID):
            domain (str):
            verified (bool):
            is_active (bool):
            created_at (datetime.datetime):
            spam_threshold (float | None | Unset):
            verification_token (None | str | Unset):
     """

    id: UUID
    org_id: UUID
    domain: str
    verified: bool
    is_active: bool
    created_at: datetime.datetime
    spam_threshold: float | None | Unset = UNSET
    verification_token: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        org_id = str(self.org_id)

        domain = self.domain

        verified = self.verified

        is_active = self.is_active

        created_at = self.created_at.isoformat()

        spam_threshold: float | None | Unset
        if isinstance(self.spam_threshold, Unset):
            spam_threshold = UNSET
        else:
            spam_threshold = self.spam_threshold

        verification_token: None | str | Unset
        if isinstance(self.verification_token, Unset):
            verification_token = UNSET
        else:
            verification_token = self.verification_token


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "org_id": org_id,
            "domain": domain,
            "verified": verified,
            "is_active": is_active,
            "created_at": created_at,
        })
        if spam_threshold is not UNSET:
            field_dict["spam_threshold"] = spam_threshold
        if verification_token is not UNSET:
            field_dict["verification_token"] = verification_token

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        org_id = UUID(d.pop("org_id"))




        domain = d.pop("domain")

        verified = d.pop("verified")

        is_active = d.pop("is_active")

        created_at = isoparse(d.pop("created_at"))




        def _parse_spam_threshold(data: object) -> float | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(float | None | Unset, data)

        spam_threshold = _parse_spam_threshold(d.pop("spam_threshold", UNSET))


        def _parse_verification_token(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        verification_token = _parse_verification_token(d.pop("verification_token", UNSET))


        verified_domain = cls(
            id=id,
            org_id=org_id,
            domain=domain,
            verified=verified,
            is_active=is_active,
            created_at=created_at,
            spam_threshold=spam_threshold,
            verification_token=verification_token,
        )


        verified_domain.additional_properties = d
        return verified_domain

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
