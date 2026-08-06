from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.domain_dns_health_scope_scope import DomainDnsHealthScopeScope
from ..models.domain_dns_health_status import DomainDnsHealthStatus
from dateutil.parser import isoparse
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.domain_dns_record import DomainDnsRecord





T = TypeVar("T", bound="DomainDnsHealthScope")



@_attrs_define
class DomainDnsHealthScope:
    """ Health of one DNS scope: `ownership` (verification TXT),
    `inbound` (MX), or `outbound` (SPF, DKIM, DMARC, TLS-RPT).

        Attributes:
            scope (DomainDnsHealthScopeScope):
            verified (bool): Whether this scope's required records are currently verified.
            status (DomainDnsHealthStatus): Rollup DNS health state. `pending` means never successfully
                checked, `healthy` means all required records verified,
                `degraded` means a previously-verified record has regressed,
                and `suspended` means the failure persisted long enough that
                the affected capability was disabled.
            checked_at (datetime.datetime): When this scope was last checked.
            next_check_at (datetime.datetime | None): Next scheduled background check, or null when none is planned.
            consecutive_failures (int): Number of consecutive failed checks for this scope.
            records (list[DomainDnsRecord]): The exact records inspected for this scope, each with its own status.
            error (str | Unset): Human-readable failure reason when the scope check errored.
     """

    scope: DomainDnsHealthScopeScope
    verified: bool
    status: DomainDnsHealthStatus
    checked_at: datetime.datetime
    next_check_at: datetime.datetime | None
    consecutive_failures: int
    records: list[DomainDnsRecord]
    error: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.domain_dns_record import DomainDnsRecord
        scope = self.scope.value

        verified = self.verified

        status = self.status.value

        checked_at = self.checked_at.isoformat()

        next_check_at: None | str
        if isinstance(self.next_check_at, datetime.datetime):
            next_check_at = self.next_check_at.isoformat()
        else:
            next_check_at = self.next_check_at

        consecutive_failures = self.consecutive_failures

        records = []
        for records_item_data in self.records:
            records_item = records_item_data.to_dict()
            records.append(records_item)



        error = self.error


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "scope": scope,
            "verified": verified,
            "status": status,
            "checked_at": checked_at,
            "next_check_at": next_check_at,
            "consecutive_failures": consecutive_failures,
            "records": records,
        })
        if error is not UNSET:
            field_dict["error"] = error

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.domain_dns_record import DomainDnsRecord
        d = dict(src_dict)
        scope = DomainDnsHealthScopeScope(d.pop("scope"))




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


        consecutive_failures = d.pop("consecutive_failures")

        records = []
        _records = d.pop("records")
        for records_item_data in (_records):
            records_item = DomainDnsRecord.from_dict(records_item_data)



            records.append(records_item)


        error = d.pop("error", UNSET)

        domain_dns_health_scope = cls(
            scope=scope,
            verified=verified,
            status=status,
            checked_at=checked_at,
            next_check_at=next_check_at,
            consecutive_failures=consecutive_failures,
            records=records,
            error=error,
        )


        domain_dns_health_scope.additional_properties = d
        return domain_dns_health_scope

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
