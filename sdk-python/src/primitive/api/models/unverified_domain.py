from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="UnverifiedDomain")



@_attrs_define
class UnverifiedDomain:
    """ 
        Attributes:
            id (UUID):
            org_id (UUID):
            domain (str):
            verified (bool):
            verification_token (str): Add this value as a TXT record to verify ownership
            created_at (datetime.datetime):
     """

    id: UUID
    org_id: UUID
    domain: str
    verified: bool
    verification_token: str
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        org_id = str(self.org_id)

        domain = self.domain

        verified = self.verified

        verification_token = self.verification_token

        created_at = self.created_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "org_id": org_id,
            "domain": domain,
            "verified": verified,
            "verification_token": verification_token,
            "created_at": created_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        org_id = UUID(d.pop("org_id"))




        domain = d.pop("domain")

        verified = d.pop("verified")

        verification_token = d.pop("verification_token")

        created_at = isoparse(d.pop("created_at"))




        unverified_domain = cls(
            id=id,
            org_id=org_id,
            domain=domain,
            verified=verified,
            verification_token=verification_token,
            created_at=created_at,
        )


        unverified_domain.additional_properties = d
        return unverified_domain

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
