from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.endpoint_kind import EndpointKind
from ..models.endpoint_owner_key_status_type_1 import EndpointOwnerKeyStatusType1
from ..models.endpoint_owner_key_status_type_2_type_1 import EndpointOwnerKeyStatusType2Type1
from ..models.endpoint_owner_key_status_type_3_type_1 import EndpointOwnerKeyStatusType3Type1
from ..models.endpoint_signed_with import EndpointSignedWith
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.endpoint_create_warning import EndpointCreateWarning
  from ..models.endpoint_delivery_type_0 import EndpointDeliveryType0
  from ..models.endpoint_receiver_capabilities import EndpointReceiverCapabilities
  from ..models.endpoint_rules import EndpointRules





T = TypeVar("T", bound="CreatedEndpoint")



@_attrs_define
class CreatedEndpoint:
    """ 
        Attributes:
            id (UUID):
            org_id (UUID):
            enabled (bool):
            rules (EndpointRules): Endpoint-specific filtering rules
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            delivery_count (int): Total webhook deliveries attempted
            success_count (int): Successful deliveries
            failure_count (int): Failed deliveries
            consecutive_fails (int): Current streak of consecutive failures
            recipient (None | str | Unset): Server-enforced recipient for an address-scoped pull subscription; null for an
                account-wide destination created before pull creation required a connected-agent credential.
            receiver_capabilities (EndpointReceiverCapabilities | Unset):
            url (None | str | Unset):
            domain_id (None | Unset | UUID): Restrict this endpoint to emails from a specific domain
            last_delivery_at (datetime.datetime | None | Unset):
            last_success_at (datetime.datetime | None | Unset):
            last_failure_at (datetime.datetime | None | Unset):
            deactivated_at (datetime.datetime | None | Unset):
            kind (EndpointKind | Unset): http: deliver to the webhook URL. function: invoke a Primitive Function.
            function_id (None | Unset | UUID): The Function this endpoint invokes, when kind is function.
            is_route_target (bool | Unset): When true, this endpoint is reachable only via an explicit recipient
                route, never as a domain's default destination, and is exempt from
                the one-endpoint-per-domain rule (so many can share a domain).
            name (None | str | Unset): A pull destination's stable name, or an http webhook's label (null when it has none).
            owned_by_key (bool | Unset): Whether an API key owns this webhook instead of the organization.
            owner_key_id (None | Unset | UUID): The API key that owns this webhook. In endpoint responses it is set only for
                a caller who may read API key metadata, and is null otherwise and when the organization owns the webhook. After
                a rotation, the key that carries on for the key first named while it can act. When none can, the key delivery
                stops on: the key first named while it is suspended and not expired, otherwise the newest key of its rotation
                that is not revoked, otherwise the newest one (only the key first named when nothing may carry on for it).
            owner_key_status (EndpointOwnerKeyStatusType1 | EndpointOwnerKeyStatusType2Type1 |
                EndpointOwnerKeyStatusType3Type1 | None | Unset): Whether the owning key can act now. In endpoint responses it
                is set only for a caller who may read API key metadata. It is the state delivery acts on. Suspended also covers
                an expired key. A suspended or revoked owner is sent nothing. Anyone who may read the endpoint learns that from
                delivery.reasons, which never names the key.
            disabled_reason (None | str | Unset): Why the platform turned this endpoint off, when it names a reason.
                owner_changed: it was given to a new owner while its URL stayed, and the URL was chosen under the previous
                owner; turning it on or giving it a new URL starts it again. owner_credential_revoked: the third-party app or
                agent delegate grant that owned it was revoked; an owner or admin who turns it back on takes it over. Null while
                it is on and when it was turned off by hand. An access suspension does not set it (a suspension is decided
                through its own record). Other values may be added.
            delivery (EndpointDeliveryType0 | None | Unset): For a webhook (kind http) in GET /endpoints and GET
                /endpoints/{id}: whether it is being sent received mail, and why not. Shown to anyone who may read the endpoint;
                it names a state, never a key. Null when it could not be checked just now. Absent from other kinds of endpoint
                and from create and update answers.
            signed_with (EndpointSignedWith | Unset): Which secret signs deliveries to this webhook: its own (read it from
                GET /endpoints/{id}/signing-secret), or the organization's webhook secret. Absent for an endpoint that is not a
                webhook.
            signing_secret (str | Unset): Only in the response that creates a webhook made with a signing secret of its own
                (one made as a person's own, or by an API key limited to some mailboxes, a third-party app or an agent delegate
                for itself): that secret, shown this once. Read it again from GET /endpoints/{id}/signing-secret.
            warnings (list[EndpointCreateWarning] | Unset): For a webhook (kind http). same_path_as_another_endpoint:
                another webhook you can see, on and not deleted, sends to the same scheme, host and path with any query string,
                so each email both receive is delivered twice; endpoint_id names it (at most 5, newest first). The URL is never
                echoed. Empty when none; absent when it could not be checked (a caller who may not read endpoints, or a failed
                read). Other codes may be added.
     """

    id: UUID
    org_id: UUID
    enabled: bool
    rules: EndpointRules
    created_at: datetime.datetime
    updated_at: datetime.datetime
    delivery_count: int
    success_count: int
    failure_count: int
    consecutive_fails: int
    recipient: None | str | Unset = UNSET
    receiver_capabilities: EndpointReceiverCapabilities | Unset = UNSET
    url: None | str | Unset = UNSET
    domain_id: None | Unset | UUID = UNSET
    last_delivery_at: datetime.datetime | None | Unset = UNSET
    last_success_at: datetime.datetime | None | Unset = UNSET
    last_failure_at: datetime.datetime | None | Unset = UNSET
    deactivated_at: datetime.datetime | None | Unset = UNSET
    kind: EndpointKind | Unset = UNSET
    function_id: None | Unset | UUID = UNSET
    is_route_target: bool | Unset = UNSET
    name: None | str | Unset = UNSET
    owned_by_key: bool | Unset = UNSET
    owner_key_id: None | Unset | UUID = UNSET
    owner_key_status: EndpointOwnerKeyStatusType1 | EndpointOwnerKeyStatusType2Type1 | EndpointOwnerKeyStatusType3Type1 | None | Unset = UNSET
    disabled_reason: None | str | Unset = UNSET
    delivery: EndpointDeliveryType0 | None | Unset = UNSET
    signed_with: EndpointSignedWith | Unset = UNSET
    signing_secret: str | Unset = UNSET
    warnings: list[EndpointCreateWarning] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.endpoint_create_warning import EndpointCreateWarning # noqa: PLC0415
        from ..models.endpoint_delivery_type_0 import EndpointDeliveryType0 # noqa: PLC0415
        from ..models.endpoint_receiver_capabilities import EndpointReceiverCapabilities # noqa: PLC0415
        from ..models.endpoint_rules import EndpointRules # noqa: PLC0415
        id = str(self.id)

        org_id = str(self.org_id)

        enabled = self.enabled

        rules = self.rules.to_dict()

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        delivery_count = self.delivery_count

        success_count = self.success_count

        failure_count = self.failure_count

        consecutive_fails = self.consecutive_fails

        recipient: None | str | Unset
        if isinstance(self.recipient, Unset):
            recipient = UNSET
        else:
            recipient = self.recipient

        receiver_capabilities: dict[str, Any] | Unset = UNSET
        if not isinstance(self.receiver_capabilities, Unset):
            receiver_capabilities = self.receiver_capabilities.to_dict()

        url: None | str | Unset
        if isinstance(self.url, Unset):
            url = UNSET
        else:
            url = self.url

        domain_id: None | str | Unset
        if isinstance(self.domain_id, Unset):
            domain_id = UNSET
        elif isinstance(self.domain_id, UUID):
            domain_id = str(self.domain_id)
        else:
            domain_id = self.domain_id

        last_delivery_at: None | str | Unset
        if isinstance(self.last_delivery_at, Unset):
            last_delivery_at = UNSET
        elif isinstance(self.last_delivery_at, datetime.datetime):
            last_delivery_at = self.last_delivery_at.isoformat()
        else:
            last_delivery_at = self.last_delivery_at

        last_success_at: None | str | Unset
        if isinstance(self.last_success_at, Unset):
            last_success_at = UNSET
        elif isinstance(self.last_success_at, datetime.datetime):
            last_success_at = self.last_success_at.isoformat()
        else:
            last_success_at = self.last_success_at

        last_failure_at: None | str | Unset
        if isinstance(self.last_failure_at, Unset):
            last_failure_at = UNSET
        elif isinstance(self.last_failure_at, datetime.datetime):
            last_failure_at = self.last_failure_at.isoformat()
        else:
            last_failure_at = self.last_failure_at

        deactivated_at: None | str | Unset
        if isinstance(self.deactivated_at, Unset):
            deactivated_at = UNSET
        elif isinstance(self.deactivated_at, datetime.datetime):
            deactivated_at = self.deactivated_at.isoformat()
        else:
            deactivated_at = self.deactivated_at

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value


        function_id: None | str | Unset
        if isinstance(self.function_id, Unset):
            function_id = UNSET
        elif isinstance(self.function_id, UUID):
            function_id = str(self.function_id)
        else:
            function_id = self.function_id

        is_route_target = self.is_route_target

        name: None | str | Unset
        if isinstance(self.name, Unset):
            name = UNSET
        else:
            name = self.name

        owned_by_key = self.owned_by_key

        owner_key_id: None | str | Unset
        if isinstance(self.owner_key_id, Unset):
            owner_key_id = UNSET
        elif isinstance(self.owner_key_id, UUID):
            owner_key_id = str(self.owner_key_id)
        else:
            owner_key_id = self.owner_key_id

        owner_key_status: None | str | Unset
        if isinstance(self.owner_key_status, Unset):
            owner_key_status = UNSET
        elif isinstance(self.owner_key_status, EndpointOwnerKeyStatusType1):
            owner_key_status = self.owner_key_status.value
        elif isinstance(self.owner_key_status, EndpointOwnerKeyStatusType2Type1):
            owner_key_status = self.owner_key_status.value
        elif isinstance(self.owner_key_status, EndpointOwnerKeyStatusType3Type1):
            owner_key_status = self.owner_key_status.value
        else:
            owner_key_status = self.owner_key_status

        disabled_reason: None | str | Unset
        if isinstance(self.disabled_reason, Unset):
            disabled_reason = UNSET
        else:
            disabled_reason = self.disabled_reason

        delivery: dict[str, Any] | None | Unset
        if isinstance(self.delivery, Unset):
            delivery = UNSET
        elif isinstance(self.delivery, EndpointDeliveryType0):
            delivery = self.delivery.to_dict()
        else:
            delivery = self.delivery

        signed_with: str | Unset = UNSET
        if not isinstance(self.signed_with, Unset):
            signed_with = self.signed_with.value


        signing_secret = self.signing_secret

        warnings: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.warnings, Unset):
            warnings = []
            for warnings_item_data in self.warnings:
                warnings_item = warnings_item_data.to_dict()
                warnings.append(warnings_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "org_id": org_id,
            "enabled": enabled,
            "rules": rules,
            "created_at": created_at,
            "updated_at": updated_at,
            "delivery_count": delivery_count,
            "success_count": success_count,
            "failure_count": failure_count,
            "consecutive_fails": consecutive_fails,
        })
        if recipient is not UNSET:
            field_dict["recipient"] = recipient
        if receiver_capabilities is not UNSET:
            field_dict["receiver_capabilities"] = receiver_capabilities
        if url is not UNSET:
            field_dict["url"] = url
        if domain_id is not UNSET:
            field_dict["domain_id"] = domain_id
        if last_delivery_at is not UNSET:
            field_dict["last_delivery_at"] = last_delivery_at
        if last_success_at is not UNSET:
            field_dict["last_success_at"] = last_success_at
        if last_failure_at is not UNSET:
            field_dict["last_failure_at"] = last_failure_at
        if deactivated_at is not UNSET:
            field_dict["deactivated_at"] = deactivated_at
        if kind is not UNSET:
            field_dict["kind"] = kind
        if function_id is not UNSET:
            field_dict["function_id"] = function_id
        if is_route_target is not UNSET:
            field_dict["is_route_target"] = is_route_target
        if name is not UNSET:
            field_dict["name"] = name
        if owned_by_key is not UNSET:
            field_dict["owned_by_key"] = owned_by_key
        if owner_key_id is not UNSET:
            field_dict["owner_key_id"] = owner_key_id
        if owner_key_status is not UNSET:
            field_dict["owner_key_status"] = owner_key_status
        if disabled_reason is not UNSET:
            field_dict["disabled_reason"] = disabled_reason
        if delivery is not UNSET:
            field_dict["delivery"] = delivery
        if signed_with is not UNSET:
            field_dict["signed_with"] = signed_with
        if signing_secret is not UNSET:
            field_dict["signing_secret"] = signing_secret
        if warnings is not UNSET:
            field_dict["warnings"] = warnings

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.endpoint_create_warning import EndpointCreateWarning # noqa: PLC0415
        from ..models.endpoint_delivery_type_0 import EndpointDeliveryType0 # noqa: PLC0415
        from ..models.endpoint_receiver_capabilities import EndpointReceiverCapabilities # noqa: PLC0415
        from ..models.endpoint_rules import EndpointRules # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        org_id = UUID(d.pop("org_id"))




        enabled = d.pop("enabled")

        rules = EndpointRules.from_dict(d.pop("rules"))




        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))




        delivery_count = d.pop("delivery_count")

        success_count = d.pop("success_count")

        failure_count = d.pop("failure_count")

        consecutive_fails = d.pop("consecutive_fails")

        def _parse_recipient(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        recipient = _parse_recipient(d.pop("recipient", UNSET))


        _receiver_capabilities = d.pop("receiver_capabilities", UNSET)
        receiver_capabilities: EndpointReceiverCapabilities | Unset
        if isinstance(_receiver_capabilities,  Unset):
            receiver_capabilities = UNSET
        else:
            receiver_capabilities = EndpointReceiverCapabilities.from_dict(_receiver_capabilities)




        def _parse_url(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        url = _parse_url(d.pop("url", UNSET))


        def _parse_domain_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                domain_id_type_0 = UUID(data)



                return domain_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        domain_id = _parse_domain_id(d.pop("domain_id", UNSET))


        def _parse_last_delivery_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_delivery_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_delivery_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        last_delivery_at = _parse_last_delivery_at(d.pop("last_delivery_at", UNSET))


        def _parse_last_success_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_success_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_success_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        last_success_at = _parse_last_success_at(d.pop("last_success_at", UNSET))


        def _parse_last_failure_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_failure_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_failure_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        last_failure_at = _parse_last_failure_at(d.pop("last_failure_at", UNSET))


        def _parse_deactivated_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                deactivated_at_type_0 = datetime.datetime.fromisoformat(data)



                return deactivated_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        deactivated_at = _parse_deactivated_at(d.pop("deactivated_at", UNSET))


        _kind = d.pop("kind", UNSET)
        kind: EndpointKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = EndpointKind(_kind)




        def _parse_function_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                function_id_type_0 = UUID(data)



                return function_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        function_id = _parse_function_id(d.pop("function_id", UNSET))


        is_route_target = d.pop("is_route_target", UNSET)

        def _parse_name(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        name = _parse_name(d.pop("name", UNSET))


        owned_by_key = d.pop("owned_by_key", UNSET)

        def _parse_owner_key_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                owner_key_id_type_0 = UUID(data)



                return owner_key_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        owner_key_id = _parse_owner_key_id(d.pop("owner_key_id", UNSET))


        def _parse_owner_key_status(data: object) -> EndpointOwnerKeyStatusType1 | EndpointOwnerKeyStatusType2Type1 | EndpointOwnerKeyStatusType3Type1 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                owner_key_status_type_1 = EndpointOwnerKeyStatusType1(data)



                return owner_key_status_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                owner_key_status_type_2_type_1 = EndpointOwnerKeyStatusType2Type1(data)



                return owner_key_status_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                owner_key_status_type_3_type_1 = EndpointOwnerKeyStatusType3Type1(data)



                return owner_key_status_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EndpointOwnerKeyStatusType1 | EndpointOwnerKeyStatusType2Type1 | EndpointOwnerKeyStatusType3Type1 | None | Unset, data)

        owner_key_status = _parse_owner_key_status(d.pop("owner_key_status", UNSET))


        def _parse_disabled_reason(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        disabled_reason = _parse_disabled_reason(d.pop("disabled_reason", UNSET))


        def _parse_delivery(data: object) -> EndpointDeliveryType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                delivery_type_0 = EndpointDeliveryType0.from_dict(data)



                return delivery_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EndpointDeliveryType0 | None | Unset, data)

        delivery = _parse_delivery(d.pop("delivery", UNSET))


        _signed_with = d.pop("signed_with", UNSET)
        signed_with: EndpointSignedWith | Unset
        if isinstance(_signed_with,  Unset):
            signed_with = UNSET
        else:
            signed_with = EndpointSignedWith(_signed_with)




        signing_secret = d.pop("signing_secret", UNSET)

        _warnings = d.pop("warnings", UNSET)
        warnings: list[EndpointCreateWarning] | Unset = UNSET
        if _warnings is not UNSET:
            warnings = []
            for warnings_item_data in _warnings:
                warnings_item = EndpointCreateWarning.from_dict(warnings_item_data)



                warnings.append(warnings_item)


        created_endpoint = cls(
            id=id,
            org_id=org_id,
            enabled=enabled,
            rules=rules,
            created_at=created_at,
            updated_at=updated_at,
            delivery_count=delivery_count,
            success_count=success_count,
            failure_count=failure_count,
            consecutive_fails=consecutive_fails,
            recipient=recipient,
            receiver_capabilities=receiver_capabilities,
            url=url,
            domain_id=domain_id,
            last_delivery_at=last_delivery_at,
            last_success_at=last_success_at,
            last_failure_at=last_failure_at,
            deactivated_at=deactivated_at,
            kind=kind,
            function_id=function_id,
            is_route_target=is_route_target,
            name=name,
            owned_by_key=owned_by_key,
            owner_key_id=owner_key_id,
            owner_key_status=owner_key_status,
            disabled_reason=disabled_reason,
            delivery=delivery,
            signed_with=signed_with,
            signing_secret=signing_secret,
            warnings=warnings,
        )


        created_endpoint.additional_properties = d
        return created_endpoint

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
