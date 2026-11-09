from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.decide_suspension_request_grant_type_1_depth import DecideSuspensionRequestGrantType1Depth
from ..models.decide_suspension_request_grant_type_1_mail_scope import DecideSuspensionRequestGrantType1MailScope
from ..models.decide_suspension_request_grant_type_1_preset import DecideSuspensionRequestGrantType1Preset
from typing import cast

if TYPE_CHECKING:
  from ..models.decide_suspension_request_grant_type_1_matrix import DecideSuspensionRequestGrantType1Matrix
  from ..models.decide_suspension_request_grant_type_1_resources import DecideSuspensionRequestGrantType1Resources





T = TypeVar("T", bound="DecideSuspensionRequestGrantType1")



@_attrs_define
class DecideSuspensionRequestGrantType1:
    """ 
        Attributes:
            preset (DecideSuspensionRequestGrantType1Preset):
            matrix (DecideSuspensionRequestGrantType1Matrix | Unset):
            permissions (list[str] | Unset):
            addresses (list[str] | Unset):
            domains (list[str] | Unset):
            rules (list[str] | Unset):
            depth (DecideSuspensionRequestGrantType1Depth | Unset): Deprecated: every key that reaches mail reads the full
                email. Ignored, except that raw still adds mail.raw:read (Raw mail) to an address preset or a custom grant.
            resources (DecideSuspensionRequestGrantType1Resources | Unset):
            mail_scope (DecideSuspensionRequestGrantType1MailScope | Unset):
     """

    preset: DecideSuspensionRequestGrantType1Preset
    matrix: DecideSuspensionRequestGrantType1Matrix | Unset = UNSET
    permissions: list[str] | Unset = UNSET
    addresses: list[str] | Unset = UNSET
    domains: list[str] | Unset = UNSET
    rules: list[str] | Unset = UNSET
    depth: DecideSuspensionRequestGrantType1Depth | Unset = UNSET
    resources: DecideSuspensionRequestGrantType1Resources | Unset = UNSET
    mail_scope: DecideSuspensionRequestGrantType1MailScope | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.decide_suspension_request_grant_type_1_matrix import DecideSuspensionRequestGrantType1Matrix # noqa: PLC0415
        from ..models.decide_suspension_request_grant_type_1_resources import DecideSuspensionRequestGrantType1Resources # noqa: PLC0415
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
        from ..models.decide_suspension_request_grant_type_1_matrix import DecideSuspensionRequestGrantType1Matrix # noqa: PLC0415
        from ..models.decide_suspension_request_grant_type_1_resources import DecideSuspensionRequestGrantType1Resources # noqa: PLC0415
        d = dict(src_dict)
        preset = DecideSuspensionRequestGrantType1Preset(d.pop("preset"))




        _matrix = d.pop("matrix", UNSET)
        matrix: DecideSuspensionRequestGrantType1Matrix | Unset
        if isinstance(_matrix,  Unset):
            matrix = UNSET
        else:
            matrix = DecideSuspensionRequestGrantType1Matrix.from_dict(_matrix)




        permissions = cast(list[str], d.pop("permissions", UNSET))


        addresses = cast(list[str], d.pop("addresses", UNSET))


        domains = cast(list[str], d.pop("domains", UNSET))


        rules = cast(list[str], d.pop("rules", UNSET))


        _depth = d.pop("depth", UNSET)
        depth: DecideSuspensionRequestGrantType1Depth | Unset
        if isinstance(_depth,  Unset):
            depth = UNSET
        else:
            depth = DecideSuspensionRequestGrantType1Depth(_depth)




        _resources = d.pop("resources", UNSET)
        resources: DecideSuspensionRequestGrantType1Resources | Unset
        if isinstance(_resources,  Unset):
            resources = UNSET
        else:
            resources = DecideSuspensionRequestGrantType1Resources.from_dict(_resources)




        _mail_scope = d.pop("mail_scope", UNSET)
        mail_scope: DecideSuspensionRequestGrantType1MailScope | Unset
        if isinstance(_mail_scope,  Unset):
            mail_scope = UNSET
        else:
            mail_scope = DecideSuspensionRequestGrantType1MailScope(_mail_scope)




        decide_suspension_request_grant_type_1 = cls(
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

        return decide_suspension_request_grant_type_1

