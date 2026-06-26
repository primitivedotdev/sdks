from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_function_endpoint_input_kind import CreateFunctionEndpointInputKind
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.create_function_endpoint_input_rules import CreateFunctionEndpointInputRules





T = TypeVar("T", bound="CreateFunctionEndpointInput")



@_attrs_define
class CreateFunctionEndpointInput:
    """ 
        Attributes:
            kind (CreateFunctionEndpointInputKind): Invoke a Primitive Function.
            function_id (UUID): The Function to invoke.
            enabled (bool | Unset): Whether the endpoint is active Default: True.
            domain_id (None | Unset | UUID): Restrict to emails from a specific domain
            rules (CreateFunctionEndpointInputRules | Unset): Endpoint-specific filtering rules
            is_route_target (bool | Unset): Create this endpoint as a route-target: reachable only via an
                explicit recipient route, never a domain's default destination, and
                exempt from the one-endpoint-per-domain rule.
                 Default: False.
     """

    kind: CreateFunctionEndpointInputKind
    function_id: UUID
    enabled: bool | Unset = True
    domain_id: None | Unset | UUID = UNSET
    rules: CreateFunctionEndpointInputRules | Unset = UNSET
    is_route_target: bool | Unset = False





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_function_endpoint_input_rules import CreateFunctionEndpointInputRules
        kind = self.kind.value

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


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "kind": kind,
            "function_id": function_id,
        })
        if enabled is not UNSET:
            field_dict["enabled"] = enabled
        if domain_id is not UNSET:
            field_dict["domain_id"] = domain_id
        if rules is not UNSET:
            field_dict["rules"] = rules
        if is_route_target is not UNSET:
            field_dict["is_route_target"] = is_route_target

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_function_endpoint_input_rules import CreateFunctionEndpointInputRules
        d = dict(src_dict)
        kind = CreateFunctionEndpointInputKind(d.pop("kind"))




        function_id = UUID(d.pop("function_id"))




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
        rules: CreateFunctionEndpointInputRules | Unset
        if isinstance(_rules,  Unset):
            rules = UNSET
        else:
            rules = CreateFunctionEndpointInputRules.from_dict(_rules)




        is_route_target = d.pop("is_route_target", UNSET)

        create_function_endpoint_input = cls(
            kind=kind,
            function_id=function_id,
            enabled=enabled,
            domain_id=domain_id,
            rules=rules,
            is_route_target=is_route_target,
        )

        return create_function_endpoint_input

