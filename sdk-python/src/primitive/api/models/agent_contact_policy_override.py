from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.contact_policy_rule import ContactPolicyRule





T = TypeVar("T", bound="AgentContactPolicyOverride")



@_attrs_define
class AgentContactPolicyOverride:
    """ 
        Attributes:
            rules (list[ContactPolicyRule]):
            contact_request_since (datetime.datetime | None):
            contact_request_generation (None | UUID):
            version (None | UUID):
            updated_at (datetime.datetime | None):
            allow_contact_requests (bool | None):
     """

    rules: list[ContactPolicyRule]
    contact_request_since: datetime.datetime | None
    contact_request_generation: None | UUID
    version: None | UUID
    updated_at: datetime.datetime | None
    allow_contact_requests: bool | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.contact_policy_rule import ContactPolicyRule # noqa: PLC0415
        rules = []
        for rules_item_data in self.rules:
            rules_item = rules_item_data.to_dict()
            rules.append(rules_item)



        contact_request_since: None | str
        if isinstance(self.contact_request_since, datetime.datetime):
            contact_request_since = self.contact_request_since.isoformat()
        else:
            contact_request_since = self.contact_request_since

        contact_request_generation: None | str
        if isinstance(self.contact_request_generation, UUID):
            contact_request_generation = str(self.contact_request_generation)
        else:
            contact_request_generation = self.contact_request_generation

        version: None | str
        if isinstance(self.version, UUID):
            version = str(self.version)
        else:
            version = self.version

        updated_at: None | str
        if isinstance(self.updated_at, datetime.datetime):
            updated_at = self.updated_at.isoformat()
        else:
            updated_at = self.updated_at

        allow_contact_requests: bool | None
        allow_contact_requests = self.allow_contact_requests


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "rules": rules,
            "contact_request_since": contact_request_since,
            "contact_request_generation": contact_request_generation,
            "version": version,
            "updated_at": updated_at,
            "allow_contact_requests": allow_contact_requests,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.contact_policy_rule import ContactPolicyRule # noqa: PLC0415
        d = dict(src_dict)
        rules = []
        _rules = d.pop("rules")
        for rules_item_data in (_rules):
            rules_item = ContactPolicyRule.from_dict(rules_item_data)



            rules.append(rules_item)


        def _parse_contact_request_since(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                contact_request_since_type_0 = datetime.datetime.fromisoformat(data)



                return contact_request_since_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        contact_request_since = _parse_contact_request_since(d.pop("contact_request_since"))


        def _parse_contact_request_generation(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                contact_request_generation_type_0 = UUID(data)



                return contact_request_generation_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        contact_request_generation = _parse_contact_request_generation(d.pop("contact_request_generation"))


        def _parse_version(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                version_type_0 = UUID(data)



                return version_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        version = _parse_version(d.pop("version"))


        def _parse_updated_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                updated_at_type_0 = datetime.datetime.fromisoformat(data)



                return updated_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        updated_at = _parse_updated_at(d.pop("updated_at"))


        def _parse_allow_contact_requests(data: object) -> bool | None:
            if data is None:
                return data
            return cast(bool | None, data)

        allow_contact_requests = _parse_allow_contact_requests(d.pop("allow_contact_requests"))


        agent_contact_policy_override = cls(
            rules=rules,
            contact_request_since=contact_request_since,
            contact_request_generation=contact_request_generation,
            version=version,
            updated_at=updated_at,
            allow_contact_requests=allow_contact_requests,
        )

        return agent_contact_policy_override

