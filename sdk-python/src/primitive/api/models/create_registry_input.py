from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.publish_policy import PublishPolicy
from typing import cast






T = TypeVar("T", bound="CreateRegistryInput")



@_attrs_define
class CreateRegistryInput:
    """ 
        Attributes:
            slug (str): Lowercase slug, unique across registries.
            name (str):
            description (None | str | Unset):
            is_public (bool | Unset):
            publish_policy (PublishPolicy | Unset): Who may publish into a registry. owner_only: only the registry owner.
                request: anyone may request and the owner approves. open: anyone may
                publish and it lists immediately (no approval step).
     """

    slug: str
    name: str
    description: None | str | Unset = UNSET
    is_public: bool | Unset = UNSET
    publish_policy: PublishPolicy | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        slug = self.slug

        name = self.name

        description: None | str | Unset
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        is_public = self.is_public

        publish_policy: str | Unset = UNSET
        if not isinstance(self.publish_policy, Unset):
            publish_policy = self.publish_policy.value



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "slug": slug,
            "name": name,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if is_public is not UNSET:
            field_dict["is_public"] = is_public
        if publish_policy is not UNSET:
            field_dict["publish_policy"] = publish_policy

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        slug = d.pop("slug")

        name = d.pop("name")

        def _parse_description(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        description = _parse_description(d.pop("description", UNSET))


        is_public = d.pop("is_public", UNSET)

        _publish_policy = d.pop("publish_policy", UNSET)
        publish_policy: PublishPolicy | Unset
        if isinstance(_publish_policy,  Unset):
            publish_policy = UNSET
        else:
            publish_policy = PublishPolicy(_publish_policy)




        create_registry_input = cls(
            slug=slug,
            name=name,
            description=description,
            is_public=is_public,
            publish_policy=publish_policy,
        )


        create_registry_input.additional_properties = d
        return create_registry_input

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
