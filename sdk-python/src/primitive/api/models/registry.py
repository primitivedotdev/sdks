from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.publish_policy import PublishPolicy
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="Registry")



@_attrs_define
class Registry:
    """ 
        Attributes:
            id (UUID):
            slug (str):
            name (str):
            description (None | str):
            is_public (bool):
            publish_policy (PublishPolicy): Who may publish into a registry. owner_only: only the registry owner.
                request: anyone may request and the owner approves. open: anyone may
                publish and it lists immediately (no approval step).
     """

    id: UUID
    slug: str
    name: str
    description: None | str
    is_public: bool
    publish_policy: PublishPolicy
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        slug = self.slug

        name = self.name

        description: None | str
        description = self.description

        is_public = self.is_public

        publish_policy = self.publish_policy.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "slug": slug,
            "name": name,
            "description": description,
            "is_public": is_public,
            "publish_policy": publish_policy,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        slug = d.pop("slug")

        name = d.pop("name")

        def _parse_description(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        description = _parse_description(d.pop("description"))


        is_public = d.pop("is_public")

        publish_policy = PublishPolicy(d.pop("publish_policy"))




        registry = cls(
            id=id,
            slug=slug,
            name=name,
            description=description,
            is_public=is_public,
            publish_policy=publish_policy,
        )


        registry.additional_properties = d
        return registry

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
