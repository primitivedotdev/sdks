from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.domain_dns_health_status import DomainDnsHealthStatus
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.domain_dns_health_check_scopes import DomainDnsHealthCheckScopes
  from ..models.domain_dns_record import DomainDnsRecord





T = TypeVar("T", bound="DomainDnsHealthCheck")



@_attrs_define
class DomainDnsHealthCheck:
    """ Result of a DNS health check, as returned by
    /domains/{id}/dns/check and recorded as the domain's current
    health state. The top-level fields summarize the domain
    overall; `scopes` breaks the same check down per capability.

        Attributes:
            domain_id (UUID):
            domain (str):
            verified (bool): Whether every required scope is currently verified.
            status (DomainDnsHealthStatus): Rollup DNS health state. `pending` means never successfully
                checked, `healthy` means all required records verified,
                `degraded` means a previously-verified record has regressed,
                and `suspended` means the failure persisted long enough that
                the affected capability was disabled.
            checked_at (datetime.datetime):
            next_check_at (datetime.datetime | None): Next scheduled background check, or null when none is planned.
            outbound_verified_at (datetime.datetime | None): When outbound DNS was first verified, or null if it never has
                been.
            consecutive_failures (int):
            records (list[DomainDnsRecord]): All records inspected across scopes, each with its own status.
            scopes (DomainDnsHealthCheckScopes):
            key_id (UUID | Unset): Active outbound DKIM key the outbound scope was checked against, when one exists.
            error (str | Unset): Human-readable failure reason when the check errored.
     """

    domain_id: UUID
    domain: str
    verified: bool
    status: DomainDnsHealthStatus
    checked_at: datetime.datetime
    next_check_at: datetime.datetime | None
    outbound_verified_at: datetime.datetime | None
    consecutive_failures: int
    records: list[DomainDnsRecord]
    scopes: DomainDnsHealthCheckScopes
    key_id: UUID | Unset = UNSET
    error: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.domain_dns_health_check_scopes import DomainDnsHealthCheckScopes
        from ..models.domain_dns_record import DomainDnsRecord
        domain_id = str(self.domain_id)

        domain = self.domain

        verified = self.verified

        status = self.status.value

        checked_at = self.checked_at.isoformat()

        next_check_at: None | str
        if isinstance(self.next_check_at, datetime.datetime):
            next_check_at = self.next_check_at.isoformat()
        else:
            next_check_at = self.next_check_at

        outbound_verified_at: None | str
        if isinstance(self.outbound_verified_at, datetime.datetime):
            outbound_verified_at = self.outbound_verified_at.isoformat()
        else:
            outbound_verified_at = self.outbound_verified_at

        consecutive_failures = self.consecutive_failures

        records = []
        for records_item_data in self.records:
            records_item = records_item_data.to_dict()
            records.append(records_item)



        scopes = self.scopes.to_dict()

        key_id: str | Unset = UNSET
        if not isinstance(self.key_id, Unset):
            key_id = str(self.key_id)

        error = self.error


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "domain_id": domain_id,
            "domain": domain,
            "verified": verified,
            "status": status,
            "checked_at": checked_at,
            "next_check_at": next_check_at,
            "outbound_verified_at": outbound_verified_at,
            "consecutive_failures": consecutive_failures,
            "records": records,
            "scopes": scopes,
        })
        if key_id is not UNSET:
            field_dict["key_id"] = key_id
        if error is not UNSET:
            field_dict["error"] = error

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.domain_dns_health_check_scopes import DomainDnsHealthCheckScopes
        from ..models.domain_dns_record import DomainDnsRecord
        d = dict(src_dict)
        domain_id = UUID(d.pop("domain_id"))




        domain = d.pop("domain")

        verified = d.pop("verified")

        status = DomainDnsHealthStatus(d.pop("status"))




        checked_at = isoparse(d.pop("checked_at"))




        def _parse_next_check_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                next_check_at_type_0 = isoparse(data)



                return next_check_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        next_check_at = _parse_next_check_at(d.pop("next_check_at"))


        def _parse_outbound_verified_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                outbound_verified_at_type_0 = isoparse(data)



                return outbound_verified_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        outbound_verified_at = _parse_outbound_verified_at(d.pop("outbound_verified_at"))


        consecutive_failures = d.pop("consecutive_failures")

        records = []
        _records = d.pop("records")
        for records_item_data in (_records):
            records_item = DomainDnsRecord.from_dict(records_item_data)



            records.append(records_item)


        scopes = DomainDnsHealthCheckScopes.from_dict(d.pop("scopes"))




        _key_id = d.pop("key_id", UNSET)
        key_id: UUID | Unset
        if isinstance(_key_id,  Unset):
            key_id = UNSET
        else:
            key_id = UUID(_key_id)




        error = d.pop("error", UNSET)

        domain_dns_health_check = cls(
            domain_id=domain_id,
            domain=domain,
            verified=verified,
            status=status,
            checked_at=checked_at,
            next_check_at=next_check_at,
            outbound_verified_at=outbound_verified_at,
            consecutive_failures=consecutive_failures,
            records=records,
            scopes=scopes,
            key_id=key_id,
            error=error,
        )


        domain_dns_health_check.additional_properties = d
        return domain_dns_health_check

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
