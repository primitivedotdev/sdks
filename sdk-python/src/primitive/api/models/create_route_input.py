from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_route_input_match_type import CreateRouteInputMatchType
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="CreateRouteInput")



@_attrs_define
class CreateRouteInput:
    """ Provide exactly one of `endpoint_id` or `function_id`. With `function_id`,
    a route-target endpoint is minted for that function and the route is bound
    to it in one transaction.

        Attributes:
            match_type (CreateRouteInputMatchType):
            pattern (str):
            endpoint_id (UUID | Unset): An existing endpoint to route to. Mutually exclusive with function_id.
            function_id (UUID | Unset): Route to this function, minting its route-target endpoint if needed. Mutually
                exclusive with endpoint_id.
            domain_id (None | Unset | UUID): Scope the route to a domain; defaults to the pattern's domain.
            priority (int | Unset):
            enabled (bool | Unset):
     """

    match_type: CreateRouteInputMatchType
    pattern: str
    endpoint_id: UUID | Unset = UNSET
    function_id: UUID | Unset = UNSET
    domain_id: None | Unset | UUID = UNSET
    priority: int | Unset = UNSET
    enabled: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        match_type = self.match_type.value

        pattern = self.pattern

        endpoint_id: str | Unset = UNSET
        if not isinstance(self.endpoint_id, Unset):
            endpoint_id = str(self.endpoint_id)

        function_id: str | Unset = UNSET
        if not isinstance(self.function_id, Unset):
            function_id = str(self.function_id)

        domain_id: None | str | Unset
        if isinstance(self.domain_id, Unset):
            domain_id = UNSET
        elif isinstance(self.domain_id, UUID):
            domain_id = str(self.domain_id)
        else:
            domain_id = self.domain_id

        priority = self.priority

        enabled = self.enabled


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "match_type": match_type,
            "pattern": pattern,
        })
        if endpoint_id is not UNSET:
            field_dict["endpoint_id"] = endpoint_id
        if function_id is not UNSET:
            field_dict["function_id"] = function_id
        if domain_id is not UNSET:
            field_dict["domain_id"] = domain_id
        if priority is not UNSET:
            field_dict["priority"] = priority
        if enabled is not UNSET:
            field_dict["enabled"] = enabled

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        match_type = CreateRouteInputMatchType(d.pop("match_type"))




        pattern = d.pop("pattern")

        _endpoint_id = d.pop("endpoint_id", UNSET)
        endpoint_id: UUID | Unset
        if isinstance(_endpoint_id,  Unset):
            endpoint_id = UNSET
        else:
            endpoint_id = UUID(_endpoint_id)




        _function_id = d.pop("function_id", UNSET)
        function_id: UUID | Unset
        if isinstance(_function_id,  Unset):
            function_id = UNSET
        else:
            function_id = UUID(_function_id)




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


        priority = d.pop("priority", UNSET)

        enabled = d.pop("enabled", UNSET)

        create_route_input = cls(
            match_type=match_type,
            pattern=pattern,
            endpoint_id=endpoint_id,
            function_id=function_id,
            domain_id=domain_id,
            priority=priority,
            enabled=enabled,
        )

        return create_route_input

