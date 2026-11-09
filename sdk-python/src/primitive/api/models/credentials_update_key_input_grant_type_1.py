from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.credentials_update_key_input_grant_type_1_depth import CredentialsUpdateKeyInputGrantType1Depth
from ..models.credentials_update_key_input_grant_type_1_mail_scope import CredentialsUpdateKeyInputGrantType1MailScope
from ..models.credentials_update_key_input_grant_type_1_preset import CredentialsUpdateKeyInputGrantType1Preset
from typing import cast

if TYPE_CHECKING:
  from ..models.credentials_update_key_input_grant_type_1_matrix import CredentialsUpdateKeyInputGrantType1Matrix
  from ..models.credentials_update_key_input_grant_type_1_resources import CredentialsUpdateKeyInputGrantType1Resources





T = TypeVar("T", bound="CredentialsUpdateKeyInputGrantType1")



@_attrs_define
class CredentialsUpdateKeyInputGrantType1:
    """ 
        Attributes:
            preset (CredentialsUpdateKeyInputGrantType1Preset):
            matrix (CredentialsUpdateKeyInputGrantType1Matrix | Unset):
            permissions (list[str] | Unset):
            addresses (list[str] | Unset):
            domains (list[str] | Unset):
            rules (list[str] | Unset):
            depth (CredentialsUpdateKeyInputGrantType1Depth | Unset): Deprecated: every key that reaches mail reads the full
                email. Ignored, except that raw still adds mail.raw:read (Raw mail) to an address preset or a custom grant.
            resources (CredentialsUpdateKeyInputGrantType1Resources | Unset):
            mail_scope (CredentialsUpdateKeyInputGrantType1MailScope | Unset):
     """

    preset: CredentialsUpdateKeyInputGrantType1Preset
    matrix: CredentialsUpdateKeyInputGrantType1Matrix | Unset = UNSET
    permissions: list[str] | Unset = UNSET
    addresses: list[str] | Unset = UNSET
    domains: list[str] | Unset = UNSET
    rules: list[str] | Unset = UNSET
    depth: CredentialsUpdateKeyInputGrantType1Depth | Unset = UNSET
    resources: CredentialsUpdateKeyInputGrantType1Resources | Unset = UNSET
    mail_scope: CredentialsUpdateKeyInputGrantType1MailScope | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.credentials_update_key_input_grant_type_1_matrix import CredentialsUpdateKeyInputGrantType1Matrix # noqa: PLC0415
        from ..models.credentials_update_key_input_grant_type_1_resources import CredentialsUpdateKeyInputGrantType1Resources # noqa: PLC0415
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



        rules: list[str] | Unset = UNSET
        if not isinstance(self.rules, Unset):
            rules = self.rules



        depth: str | Unset = UNSET
        if not isinstance(self.depth, Unset):
            depth = self.depth.value


        resources: dict[str, Any] | Unset = UNSET
        if not isinstance(self.resources, Unset):
            resources = self.resources.to_dict()

        mail_scope: str | Unset = UNSET
        if not isinstance(self.mail_scope, Unset):
            mail_scope = self.mail_scope.value



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
        if rules is not UNSET:
            field_dict["rules"] = rules
        if depth is not UNSET:
            field_dict["depth"] = depth
        if resources is not UNSET:
            field_dict["resources"] = resources
        if mail_scope is not UNSET:
            field_dict["mail_scope"] = mail_scope

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.credentials_update_key_input_grant_type_1_matrix import CredentialsUpdateKeyInputGrantType1Matrix # noqa: PLC0415
        from ..models.credentials_update_key_input_grant_type_1_resources import CredentialsUpdateKeyInputGrantType1Resources # noqa: PLC0415
        d = dict(src_dict)
        preset = CredentialsUpdateKeyInputGrantType1Preset(d.pop("preset"))




        _matrix = d.pop("matrix", UNSET)
        matrix: CredentialsUpdateKeyInputGrantType1Matrix | Unset
        if isinstance(_matrix,  Unset):
            matrix = UNSET
        else:
            matrix = CredentialsUpdateKeyInputGrantType1Matrix.from_dict(_matrix)




        permissions = cast(list[str], d.pop("permissions", UNSET))


        addresses = cast(list[str], d.pop("addresses", UNSET))


        domains = cast(list[str], d.pop("domains", UNSET))


        rules = cast(list[str], d.pop("rules", UNSET))


        _depth = d.pop("depth", UNSET)
        depth: CredentialsUpdateKeyInputGrantType1Depth | Unset
        if isinstance(_depth,  Unset):
            depth = UNSET
        else:
            depth = CredentialsUpdateKeyInputGrantType1Depth(_depth)




        _resources = d.pop("resources", UNSET)
        resources: CredentialsUpdateKeyInputGrantType1Resources | Unset
        if isinstance(_resources,  Unset):
            resources = UNSET
        else:
            resources = CredentialsUpdateKeyInputGrantType1Resources.from_dict(_resources)




        _mail_scope = d.pop("mail_scope", UNSET)
        mail_scope: CredentialsUpdateKeyInputGrantType1MailScope | Unset
        if isinstance(_mail_scope,  Unset):
            mail_scope = UNSET
        else:
            mail_scope = CredentialsUpdateKeyInputGrantType1MailScope(_mail_scope)




        credentials_update_key_input_grant_type_1 = cls(
            preset=preset,
            matrix=matrix,
            permissions=permissions,
            addresses=addresses,
            domains=domains,
            rules=rules,
            depth=depth,
            resources=resources,
            mail_scope=mail_scope,
        )

        return credentials_update_key_input_grant_type_1

