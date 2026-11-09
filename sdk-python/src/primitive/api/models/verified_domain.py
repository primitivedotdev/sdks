from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.verified_domain_dns_health import VerifiedDomainDnsHealth
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.domain_dns_record import DomainDnsRecord





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
            dns_health (VerifiedDomainDnsHealth): What the scheduled DNS checker last observed for this domain’s ownership
                and inbound records. Unlike `verified`, which only reports that the domain was verified once, this reflects live
                state: `degraded` means a check failed and is being retried, `suspended` means the records have been missing
                long enough that inbound mail is rejected. Platform-managed zones always report `healthy`.
            spam_threshold (float | None | Unset):
            verification_token (None | str | Unset):
            sign_in_email_notice (str | Unset): Present on verify and activate responses when people already sign in to
                Primitive with an address on this domain. Informational: they will be asked to switch their sign-in email to an
                address on another domain.
            legacy_inbound_mx (DomainDnsRecord | None | Unset): Set when the last DNS check found this domain’s MX on a
                legacy Primitive host. Mail is still delivered and `dns_health` is unaffected; publish this record (status
                `legacy`) in place of the legacy MX. Null otherwise.
            managed_zone (None | str | Unset): For a platform-managed domain, the zone Primitive operates on your behalf
                (for example `primitive.email`); you publish no DNS records for it. Null for a domain you own.
     """

    id: UUID
    org_id: UUID
    domain: str
    verified: bool
    is_active: bool
    created_at: datetime.datetime
    dns_health: VerifiedDomainDnsHealth
    spam_threshold: float | None | Unset = UNSET
    verification_token: None | str | Unset = UNSET
    sign_in_email_notice: str | Unset = UNSET
    legacy_inbound_mx: DomainDnsRecord | None | Unset = UNSET
    managed_zone: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.domain_dns_record import DomainDnsRecord # noqa: PLC0415
        id = str(self.id)

        org_id = str(self.org_id)

        domain = self.domain

        verified = self.verified

        is_active = self.is_active

        created_at = self.created_at.isoformat()

        dns_health = self.dns_health.value

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

        sign_in_email_notice = self.sign_in_email_notice

        legacy_inbound_mx: dict[str, Any] | None | Unset
        if isinstance(self.legacy_inbound_mx, Unset):
            legacy_inbound_mx = UNSET
        elif isinstance(self.legacy_inbound_mx, DomainDnsRecord):
            legacy_inbound_mx = self.legacy_inbound_mx.to_dict()
        else:
            legacy_inbound_mx = self.legacy_inbound_mx

        managed_zone: None | str | Unset
        if isinstance(self.managed_zone, Unset):
            managed_zone = UNSET
        else:
            managed_zone = self.managed_zone


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "org_id": org_id,
            "domain": domain,
            "verified": verified,
            "is_active": is_active,
            "created_at": created_at,
            "dns_health": dns_health,
        })
        if spam_threshold is not UNSET:
            field_dict["spam_threshold"] = spam_threshold
        if verification_token is not UNSET:
            field_dict["verification_token"] = verification_token
        if sign_in_email_notice is not UNSET:
            field_dict["sign_in_email_notice"] = sign_in_email_notice
        if legacy_inbound_mx is not UNSET:
            field_dict["legacy_inbound_mx"] = legacy_inbound_mx
        if managed_zone is not UNSET:
            field_dict["managed_zone"] = managed_zone

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.domain_dns_record import DomainDnsRecord # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        org_id = UUID(d.pop("org_id"))




        domain = d.pop("domain")

        verified = d.pop("verified")

        is_active = d.pop("is_active")

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        dns_health = VerifiedDomainDnsHealth(d.pop("dns_health"))




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


        sign_in_email_notice = d.pop("sign_in_email_notice", UNSET)

        def _parse_legacy_inbound_mx(data: object) -> DomainDnsRecord | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                legacy_inbound_mx_type_1 = DomainDnsRecord.from_dict(data)



                return legacy_inbound_mx_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(DomainDnsRecord | None | Unset, data)

        legacy_inbound_mx = _parse_legacy_inbound_mx(d.pop("legacy_inbound_mx", UNSET))


        def _parse_managed_zone(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        managed_zone = _parse_managed_zone(d.pop("managed_zone", UNSET))


        verified_domain = cls(
            id=id,
            org_id=org_id,
            domain=domain,
            verified=verified,
            is_active=is_active,
            created_at=created_at,
            dns_health=dns_health,
            spam_threshold=spam_threshold,
            verification_token=verification_token,
            sign_in_email_notice=sign_in_email_notice,
            legacy_inbound_mx=legacy_inbound_mx,
            managed_zone=managed_zone,
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
