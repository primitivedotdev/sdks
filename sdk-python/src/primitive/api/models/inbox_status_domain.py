from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.inbox_status_domain_status import InboxStatusDomainStatus
from dateutil.parser import isoparse
from typing import cast
import datetime






T = TypeVar("T", bound="InboxStatusDomain")



@_attrs_define
class InboxStatusDomain:
    """ 
        Attributes:
            id (str):
            domain (str):
            verified (bool):
            active (bool):
            managed (bool):
            receiving_ready (bool):
            processing_ready (bool):
            processing_route_count (int):
            endpoint_count (int):
            enabled_endpoint_count (int):
            function_endpoint_count (int):
            email_count (int):
            latest_email_received_at (datetime.datetime | None):
            status (InboxStatusDomainStatus):
     """

    id: str
    domain: str
    verified: bool
    active: bool
    managed: bool
    receiving_ready: bool
    processing_ready: bool
    processing_route_count: int
    endpoint_count: int
    enabled_endpoint_count: int
    function_endpoint_count: int
    email_count: int
    latest_email_received_at: datetime.datetime | None
    status: InboxStatusDomainStatus





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        domain = self.domain

        verified = self.verified

        active = self.active

        managed = self.managed

        receiving_ready = self.receiving_ready

        processing_ready = self.processing_ready

        processing_route_count = self.processing_route_count

        endpoint_count = self.endpoint_count

        enabled_endpoint_count = self.enabled_endpoint_count

        function_endpoint_count = self.function_endpoint_count

        email_count = self.email_count

        latest_email_received_at: None | str
        if isinstance(self.latest_email_received_at, datetime.datetime):
            latest_email_received_at = self.latest_email_received_at.isoformat()
        else:
            latest_email_received_at = self.latest_email_received_at

        status = self.status.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "domain": domain,
            "verified": verified,
            "active": active,
            "managed": managed,
            "receiving_ready": receiving_ready,
            "processing_ready": processing_ready,
            "processing_route_count": processing_route_count,
            "endpoint_count": endpoint_count,
            "enabled_endpoint_count": enabled_endpoint_count,
            "function_endpoint_count": function_endpoint_count,
            "email_count": email_count,
            "latest_email_received_at": latest_email_received_at,
            "status": status,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        domain = d.pop("domain")

        verified = d.pop("verified")

        active = d.pop("active")

        managed = d.pop("managed")

        receiving_ready = d.pop("receiving_ready")

        processing_ready = d.pop("processing_ready")

        processing_route_count = d.pop("processing_route_count")

        endpoint_count = d.pop("endpoint_count")

        enabled_endpoint_count = d.pop("enabled_endpoint_count")

        function_endpoint_count = d.pop("function_endpoint_count")

        email_count = d.pop("email_count")

        def _parse_latest_email_received_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                latest_email_received_at_type_0 = isoparse(data)



                return latest_email_received_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        latest_email_received_at = _parse_latest_email_received_at(d.pop("latest_email_received_at"))


        status = InboxStatusDomainStatus(d.pop("status"))




        inbox_status_domain = cls(
            id=id,
            domain=domain,
            verified=verified,
            active=active,
            managed=managed,
            receiving_ready=receiving_ready,
            processing_ready=processing_ready,
            processing_route_count=processing_route_count,
            endpoint_count=endpoint_count,
            enabled_endpoint_count=enabled_endpoint_count,
            function_endpoint_count=function_endpoint_count,
            email_count=email_count,
            latest_email_received_at=latest_email_received_at,
            status=status,
        )

        return inbox_status_domain

