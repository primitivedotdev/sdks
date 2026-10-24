from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.key_preset import KeyPreset
from typing import cast

if TYPE_CHECKING:
  from ..models.key_grant_spec_matrix import KeyGrantSpecMatrix
  from ..models.key_grant_spec_resources import KeyGrantSpecResources





T = TypeVar("T", bound="KeyGrantSpec")



@_attrs_define
class KeyGrantSpec:
    """ A key's grant: a preset, optionally narrowed. Use `matrix` (area to
    `none`, `read` or `write`, areas from `GET /keys/builder`) or
    `permissions` for a custom grant, `addresses` and `domains` to limit
    mail, and `resources` to limit Functions, domains, endpoints or
    routes to selected ids. The server adds the permissions a choice
    implies and reports them in `warnings`.

        Attributes:
            preset (KeyPreset): `super_admin` (every ordinary permission, as keys have today),
                `send_only`, `read_only`, `own_addresses` and
                `own_addresses_read_only` (both need `addresses`), or `custom`.
            matrix (KeyGrantSpecMatrix | Unset):
            permissions (list[str] | Unset):
            addresses (list[str] | Unset):
            domains (list[str] | Unset):
            resources (KeyGrantSpecResources | Unset):
     """

    preset: KeyPreset
    matrix: KeyGrantSpecMatrix | Unset = UNSET
    permissions: list[str] | Unset = UNSET
    addresses: list[str] | Unset = UNSET
    domains: list[str] | Unset = UNSET
    resources: KeyGrantSpecResources | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.key_grant_spec_matrix import KeyGrantSpecMatrix # noqa: PLC0415
        from ..models.key_grant_spec_resources import KeyGrantSpecResources # noqa: PLC0415
        preset = self.preset.value

        matrix: dict[str, Any] | Unset = UNSET
        if not isinstance(self.matrix, Unset):
            matrix = self.matrix.to_dict()

        permissions: list[str] | Unset = UNSET
        if not isinstance(self.permissions, Unset):
            permissions = self.permissions



        addresses: list[str] | Unset = UNSET
        if not isinstance(self.addresses, Unset):
            addresses = self.addresses



        domains: list[str] | Unset = UNSET
        if not isinstance(self.domains, Unset):
            domains = self.domains



        resources: dict[str, Any] | Unset = UNSET
        if not isinstance(self.resources, Unset):
            resources = self.resources.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "preset": preset,
        })
        if matrix is not UNSET:
            field_dict["matrix"] = matrix
        if permissions is not UNSET:
            field_dict["permissions"] = permissions
        if addresses is not UNSET:
            field_dict["addresses"] = addresses
        if domains is not UNSET:
            field_dict["domains"] = domains
        if resources is not UNSET:
            field_dict["resources"] = resources

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.key_grant_spec_matrix import KeyGrantSpecMatrix # noqa: PLC0415
        from ..models.key_grant_spec_resources import KeyGrantSpecResources # noqa: PLC0415
        d = dict(src_dict)
        preset = KeyPreset(d.pop("preset"))




        _matrix = d.pop("matrix", UNSET)
        matrix: KeyGrantSpecMatrix | Unset
        if isinstance(_matrix,  Unset):
            matrix = UNSET
        else:
            matrix = KeyGrantSpecMatrix.from_dict(_matrix)




        permissions = cast(list[str], d.pop("permissions", UNSET))


        addresses = cast(list[str], d.pop("addresses", UNSET))


        domains = cast(list[str], d.pop("domains", UNSET))


        _resources = d.pop("resources", UNSET)
        resources: KeyGrantSpecResources | Unset
        if isinstance(_resources,  Unset):
            resources = UNSET
        else:
            resources = KeyGrantSpecResources.from_dict(_resources)




        key_grant_spec = cls(
            preset=preset,
            matrix=matrix,
            permissions=permissions,
            addresses=addresses,
            domains=domains,
            resources=resources,
        )

        return key_grant_spec

