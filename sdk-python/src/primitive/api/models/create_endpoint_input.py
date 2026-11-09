from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_endpoint_input_kind import CreateEndpointInputKind
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.create_endpoint_input_rules import CreateEndpointInputRules





T = TypeVar("T", bound="CreateEndpointInput")



@_attrs_define
class CreateEndpointInput:
    """ 
        Attributes:
            kind (CreateEndpointInputKind | Unset): http: deliver to url. function: invoke function_id. pull: receive
                locally using a stable name, without a URL. Default: CreateEndpointInputKind.HTTP.
            url (str | Unset): The webhook URL to deliver events to. Required when kind is http; omit for function
                endpoints.
            function_id (UUID | Unset): The Function to invoke. Required when kind is function.
            enabled (bool | Unset): Whether the endpoint is active
            domain_id (None | Unset | UUID): Restrict to emails from a specific domain
            rules (CreateEndpointInputRules | Unset): Endpoint-specific filtering rules
            is_route_target (bool | Unset): Create this endpoint as a route-target: reachable only via an
                explicit recipient route, never a domain's default destination, and
                exempt from the one-endpoint-per-domain rule.
            name (str | Unset): Stable name within the credential scope, required for kind=pull. Only connected-agent
                credentials can create pull destinations, and each receives only its assigned address.
            takeover (bool | Unset): When the domain (or, with no domain_id, the organization's fallback slot) already has
                an active endpoint: false (the default) answers 409 conflict with details.holder naming it; true retires that
                endpoint in the same request, after the checks deleting it would need. Route targets and pull destinations never
                hold the slot. A plan limit (one fallback webhook on the free plan, Power for per-domain webhooks) is checked
                first, and takeover lifts only the fallback limit the holder itself would count against.
            owner_key_id (UUID | Unset): Make this webhook owned by an API key of the organization instead of by the
                organization. It receives the mail recipient routes send to it and interaction events for addresses the key
                reads, each checked against the key: only mail the key can read is sent, and nothing while the key is revoked or
                suspended. It is never a domain or organization default: it is created as a route target, and is_route_target
                false or takeover is refused. Not a connected agent key or a Function key.
     """

    kind: CreateEndpointInputKind | Unset = CreateEndpointInputKind.HTTP
    url: str | Unset = UNSET
    function_id: UUID | Unset = UNSET
    enabled: bool | Unset = UNSET
    domain_id: None | Unset | UUID = UNSET
    rules: CreateEndpointInputRules | Unset = UNSET
    is_route_target: bool | Unset = UNSET
    name: str | Unset = UNSET
    takeover: bool | Unset = UNSET
    owner_key_id: UUID | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_endpoint_input_rules import CreateEndpointInputRules # noqa: PLC0415
        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value


        url = self.url

        function_id: str | Unset = UNSET
        if not isinstance(self.function_id, Unset):
            function_id = str(self.function_id)

        enabled = self.enabled

        domain_id: None | str | Unset
        if isinstance(self.domain_id, Unset):
            domain_id = UNSET
        elif isinstance(self.domain_id, UUID):
            domain_id = str(self.domain_id)
        else:
            domain_id = self.domain_id

        rules: dict[str, Any] | Unset = UNSET
        if not isinstance(self.rules, Unset):
            rules = self.rules.to_dict()

        is_route_target = self.is_route_target

        name = self.name

        takeover = self.takeover

        owner_key_id: str | Unset = UNSET
        if not isinstance(self.owner_key_id, Unset):
            owner_key_id = str(self.owner_key_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if kind is not UNSET:
            field_dict["kind"] = kind
        if url is not UNSET:
            field_dict["url"] = url
        if function_id is not UNSET:
            field_dict["function_id"] = function_id
        if enabled is not UNSET:
            field_dict["enabled"] = enabled
        if domain_id is not UNSET:
            field_dict["domain_id"] = domain_id
        if rules is not UNSET:
            field_dict["rules"] = rules
        if is_route_target is not UNSET:
            field_dict["is_route_target"] = is_route_target
        if name is not UNSET:
            field_dict["name"] = name
        if takeover is not UNSET:
            field_dict["takeover"] = takeover
        if owner_key_id is not UNSET:
            field_dict["owner_key_id"] = owner_key_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_endpoint_input_rules import CreateEndpointInputRules # noqa: PLC0415
        d = dict(src_dict)
        _kind = d.pop("kind", UNSET)
        kind: CreateEndpointInputKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = CreateEndpointInputKind(_kind)




        url = d.pop("url", UNSET)

        _function_id = d.pop("function_id", UNSET)
        function_id: UUID | Unset
        if isinstance(_function_id,  Unset):
            function_id = UNSET
        else:
            function_id = UUID(_function_id)




        enabled = d.pop("enabled", UNSET)

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


        _rules = d.pop("rules", UNSET)
        rules: CreateEndpointInputRules | Unset
        if isinstance(_rules,  Unset):
            rules = UNSET
        else:
            rules = CreateEndpointInputRules.from_dict(_rules)




        is_route_target = d.pop("is_route_target", UNSET)

        name = d.pop("name", UNSET)

        takeover = d.pop("takeover", UNSET)

        _owner_key_id = d.pop("owner_key_id", UNSET)
        owner_key_id: UUID | Unset
        if isinstance(_owner_key_id,  Unset):
            owner_key_id = UNSET
        else:
            owner_key_id = UUID(_owner_key_id)




        create_endpoint_input = cls(
            kind=kind,
            url=url,
            function_id=function_id,
            enabled=enabled,
            domain_id=domain_id,
            rules=rules,
            is_route_target=is_route_target,
            name=name,
            takeover=takeover,
            owner_key_id=owner_key_id,
        )

        return create_endpoint_input

