from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.install_template_body_secrets import InstallTemplateBodySecrets
  from ..models.install_template_body_variables import InstallTemplateBodyVariables





T = TypeVar("T", bound="InstallTemplateBody")



@_attrs_define
class InstallTemplateBody:
    """ 
        Attributes:
            address (str | Unset): Localpart to claim on the selected inbound domain. Defaults to the template slug.
            domain (str | Unset): Org domain name to claim the address on. Defaults to the org's newest active domain.
            variables (InstallTemplateBodyVariables | Unset): Template variable values keyed by manifest variable key.
            secrets (InstallTemplateBodySecrets | Unset): Secret values keyed by manifest secret key.
     """

    address: str | Unset = UNSET
    domain: str | Unset = UNSET
    variables: InstallTemplateBodyVariables | Unset = UNSET
    secrets: InstallTemplateBodySecrets | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.install_template_body_secrets import InstallTemplateBodySecrets
        from ..models.install_template_body_variables import InstallTemplateBodyVariables
        address = self.address

        domain = self.domain

        variables: dict[str, Any] | Unset = UNSET
        if not isinstance(self.variables, Unset):
            variables = self.variables.to_dict()

        secrets: dict[str, Any] | Unset = UNSET
        if not isinstance(self.secrets, Unset):
            secrets = self.secrets.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if address is not UNSET:
            field_dict["address"] = address
        if domain is not UNSET:
            field_dict["domain"] = domain
        if variables is not UNSET:
            field_dict["variables"] = variables
        if secrets is not UNSET:
            field_dict["secrets"] = secrets

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.install_template_body_secrets import InstallTemplateBodySecrets
        from ..models.install_template_body_variables import InstallTemplateBodyVariables
        d = dict(src_dict)
        address = d.pop("address", UNSET)

        domain = d.pop("domain", UNSET)

        _variables = d.pop("variables", UNSET)
        variables: InstallTemplateBodyVariables | Unset
        if isinstance(_variables,  Unset):
            variables = UNSET
        else:
            variables = InstallTemplateBodyVariables.from_dict(_variables)




        _secrets = d.pop("secrets", UNSET)
        secrets: InstallTemplateBodySecrets | Unset
        if isinstance(_secrets,  Unset):
            secrets = UNSET
        else:
            secrets = InstallTemplateBodySecrets.from_dict(_secrets)




        install_template_body = cls(
            address=address,
            domain=domain,
            variables=variables,
            secrets=secrets,
        )

        return install_template_body

