from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.create_endpoint_input_rules import CreateEndpointInputRules





T = TypeVar("T", bound="CreateEndpointInput")



@_attrs_define
class CreateEndpointInput:
    """ 
        Attributes:
            url (str): The webhook URL to deliver events to
            enabled (bool | Unset): Whether the endpoint is active Default: True.
            domain_id (None | Unset | UUID): Restrict to emails from a specific domain
            rules (CreateEndpointInputRules | Unset): Endpoint-specific filtering rules
     """

    url: str
    enabled: bool | Unset = True
    domain_id: None | Unset | UUID = UNSET
    rules: CreateEndpointInputRules | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_endpoint_input_rules import CreateEndpointInputRules
        url = self.url

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


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "url": url,
        })
        if enabled is not UNSET:
            field_dict["enabled"] = enabled
        if domain_id is not UNSET:
            field_dict["domain_id"] = domain_id
        if rules is not UNSET:
            field_dict["rules"] = rules

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_endpoint_input_rules import CreateEndpointInputRules
        d = dict(src_dict)
        url = d.pop("url")

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




        create_endpoint_input = cls(
            url=url,
            enabled=enabled,
            domain_id=domain_id,
            rules=rules,
        )

        return create_endpoint_input

