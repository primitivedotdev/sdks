from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.update_endpoint_input_rules import UpdateEndpointInputRules





T = TypeVar("T", bound="UpdateEndpointInput")



@_attrs_define
class UpdateEndpointInput:
    """ 
        Attributes:
            url (str | Unset): New webhook URL (triggers endpoint rotation)
            enabled (bool | Unset):
            domain_id (None | Unset | UUID):
            rules (UpdateEndpointInputRules | Unset):
            takeover (bool | Unset): For a move to another domain_id whose slot already has an active endpoint: false (the
                default) answers 409 conflict with details.holder naming it; true retires that endpoint in the same request,
                after the checks deleting it would need.
            owner_key_id (None | Unset | UUID): Give this webhook to an API key of the organization. Only a route target can
                be given to a key; a default endpoint stays the organization's, and takeover is refused with it. null gives a
                key-owned webhook back to the organization (a caller with access to every mailbox only); it stays a route
                target.
            name (None | str | Unset): A webhook's label, up to 200 characters, shown with it in lists; null removes it.
                Only for http webhooks: a pull destination keeps the name it was created with.
     """

    url: str | Unset = UNSET
    enabled: bool | Unset = UNSET
    domain_id: None | Unset | UUID = UNSET
    rules: UpdateEndpointInputRules | Unset = UNSET
    takeover: bool | Unset = UNSET
    owner_key_id: None | Unset | UUID = UNSET
    name: None | str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_endpoint_input_rules import UpdateEndpointInputRules # noqa: PLC0415
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

        takeover = self.takeover

        owner_key_id: None | str | Unset
        if isinstance(self.owner_key_id, Unset):
            owner_key_id = UNSET
        elif isinstance(self.owner_key_id, UUID):
            owner_key_id = str(self.owner_key_id)
        else:
            owner_key_id = self.owner_key_id

        name: None | str | Unset
        if isinstance(self.name, Unset):
            name = UNSET
        else:
            name = self.name


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if url is not UNSET:
            field_dict["url"] = url
        if enabled is not UNSET:
            field_dict["enabled"] = enabled
        if domain_id is not UNSET:
            field_dict["domain_id"] = domain_id
        if rules is not UNSET:
            field_dict["rules"] = rules
        if takeover is not UNSET:
            field_dict["takeover"] = takeover
        if owner_key_id is not UNSET:
            field_dict["owner_key_id"] = owner_key_id
        if name is not UNSET:
            field_dict["name"] = name

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_endpoint_input_rules import UpdateEndpointInputRules # noqa: PLC0415
        d = dict(src_dict)
        url = d.pop("url", UNSET)

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
        rules: UpdateEndpointInputRules | Unset
        if isinstance(_rules,  Unset):
            rules = UNSET
        else:
            rules = UpdateEndpointInputRules.from_dict(_rules)




        takeover = d.pop("takeover", UNSET)

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


        def _parse_name(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        name = _parse_name(d.pop("name", UNSET))


        update_endpoint_input = cls(
            url=url,
            enabled=enabled,
            domain_id=domain_id,
            rules=rules,
            takeover=takeover,
            owner_key_id=owner_key_id,
            name=name,
        )

        return update_endpoint_input

