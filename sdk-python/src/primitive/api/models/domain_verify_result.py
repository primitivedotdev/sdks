from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.domain_verify_result_dns_health import DomainVerifyResultDnsHealth
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.domain_dns_record import DomainDnsRecord





T = TypeVar("T", bound="DomainVerifyResult")



@_attrs_define
class DomainVerifyResult:
    """ The verified domain. A check that does not pass is a 400 `dns_verification_failed` error instead.

        Attributes:
            verified (bool):
            dns_health (DomainVerifyResultDnsHealth): What the scheduled DNS checker last observed for this domain’s
                ownership and inbound records. Unlike `verified`, which only reports that the domain was verified once, this
                reflects live state: `degraded` means a check failed and is being retried, `suspended` means the records have
                been missing long enough that inbound mail is rejected. Platform-managed zones always report `healthy`.
            id (UUID):
            org_id (UUID):
            domain (str):
            is_active (bool):
            created_at (datetime.datetime):
            dns_records (list[DomainDnsRecord] | Unset): Exact DNS records to publish for a pending domain claim or
                verification attempt.
            sign_in_email_notice (str | Unset): Present on verify and activate responses when people already sign in to
                Primitive with an address on this domain. Informational: they will be asked to switch their sign-in email to an
                address on another domain.
            verification_token (None | str | Unset):
            managed_zone (None | str | Unset): For a platform-managed domain, the zone Primitive operates on your behalf
                (for example `primitive.email`); you publish no DNS records for it. Null for a domain you own.
            spam_threshold (float | None | Unset):
     """

    verified: bool
    dns_health: DomainVerifyResultDnsHealth
    id: UUID
    org_id: UUID
    domain: str
    is_active: bool
    created_at: datetime.datetime
    dns_records: list[DomainDnsRecord] | Unset = UNSET
    sign_in_email_notice: str | Unset = UNSET
    verification_token: None | str | Unset = UNSET
    managed_zone: None | str | Unset = UNSET
    spam_threshold: float | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.domain_dns_record import DomainDnsRecord # noqa: PLC0415
        verified = self.verified

        dns_health = self.dns_health.value

        id = str(self.id)

        org_id = str(self.org_id)

        domain = self.domain

        is_active = self.is_active

        created_at = self.created_at.isoformat()

        dns_records: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.dns_records, Unset):
            dns_records = []
            for dns_records_item_data in self.dns_records:
                dns_records_item = dns_records_item_data.to_dict()
                dns_records.append(dns_records_item)



        sign_in_email_notice = self.sign_in_email_notice

        verification_token: None | str | Unset
        if isinstance(self.verification_token, Unset):
            verification_token = UNSET
        else:
            verification_token = self.verification_token

        managed_zone: None | str | Unset
        if isinstance(self.managed_zone, Unset):
            managed_zone = UNSET
        else:
            managed_zone = self.managed_zone

        spam_threshold: float | None | Unset
        if isinstance(self.spam_threshold, Unset):
            spam_threshold = UNSET
        else:
            spam_threshold = self.spam_threshold


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "verified": verified,
            "dns_health": dns_health,
            "id": id,
            "org_id": org_id,
            "domain": domain,
            "is_active": is_active,
            "created_at": created_at,
        })
        if dns_records is not UNSET:
            field_dict["dns_records"] = dns_records
        if sign_in_email_notice is not UNSET:
            field_dict["sign_in_email_notice"] = sign_in_email_notice
        if verification_token is not UNSET:
            field_dict["verification_token"] = verification_token
        if managed_zone is not UNSET:
            field_dict["managed_zone"] = managed_zone
        if spam_threshold is not UNSET:
            field_dict["spam_threshold"] = spam_threshold

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.domain_dns_record import DomainDnsRecord # noqa: PLC0415
        d = dict(src_dict)
        verified = d.pop("verified")

        dns_health = DomainVerifyResultDnsHealth(d.pop("dns_health"))




        id = UUID(d.pop("id"))




        org_id = UUID(d.pop("org_id"))




        domain = d.pop("domain")

        is_active = d.pop("is_active")

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        _dns_records = d.pop("dns_records", UNSET)
        dns_records: list[DomainDnsRecord] | Unset = UNSET
        if _dns_records is not UNSET:
            dns_records = []
            for dns_records_item_data in _dns_records:
                dns_records_item = DomainDnsRecord.from_dict(dns_records_item_data)



                dns_records.append(dns_records_item)


        sign_in_email_notice = d.pop("sign_in_email_notice", UNSET)

        def _parse_verification_token(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        verification_token = _parse_verification_token(d.pop("verification_token", UNSET))


        def _parse_managed_zone(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        managed_zone = _parse_managed_zone(d.pop("managed_zone", UNSET))


        def _parse_spam_threshold(data: object) -> float | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(float | None | Unset, data)

        spam_threshold = _parse_spam_threshold(d.pop("spam_threshold", UNSET))


        domain_verify_result = cls(
            verified=verified,
            dns_health=dns_health,
            id=id,
            org_id=org_id,
            domain=domain,
            is_active=is_active,
            created_at=created_at,
            dns_records=dns_records,
            sign_in_email_notice=sign_in_email_notice,
            verification_token=verification_token,
            managed_zone=managed_zone,
            spam_threshold=spam_threshold,
        )


        domain_verify_result.additional_properties = d
        return domain_verify_result

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
