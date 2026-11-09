from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.install_template_body_runtime_grant_type_1 import InstallTemplateBodyRuntimeGrantType1
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
            runtime_grant (InstallTemplateBodyRuntimeGrantType1 | str | Unset): The key the installed function runs with, in
                the same form as runtime_grant on createFunction. Omitted: the template's recommended grant when runtime key
                choice is available, otherwise the organization's shared function key.
     """

    address: str | Unset = UNSET
    domain: str | Unset = UNSET
    variables: InstallTemplateBodyVariables | Unset = UNSET
    secrets: InstallTemplateBodySecrets | Unset = UNSET
    runtime_grant: InstallTemplateBodyRuntimeGrantType1 | str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.install_template_body_runtime_grant_type_1 import InstallTemplateBodyRuntimeGrantType1 # noqa: PLC0415
        from ..models.install_template_body_secrets import InstallTemplateBodySecrets # noqa: PLC0415
        from ..models.install_template_body_variables import InstallTemplateBodyVariables # noqa: PLC0415
        address = self.address

        domain = self.domain

        variables: dict[str, Any] | Unset = UNSET
        if not isinstance(self.variables, Unset):
            variables = self.variables.to_dict()

        secrets: dict[str, Any] | Unset = UNSET
        if not isinstance(self.secrets, Unset):
            secrets = self.secrets.to_dict()

        runtime_grant: dict[str, Any] | str | Unset
        if isinstance(self.runtime_grant, Unset):
            runtime_grant = UNSET
        elif isinstance(self.runtime_grant, InstallTemplateBodyRuntimeGrantType1):
            runtime_grant = self.runtime_grant.to_dict()
        else:
            runtime_grant = self.runtime_grant


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
        if runtime_grant is not UNSET:
            field_dict["runtime_grant"] = runtime_grant

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.install_template_body_runtime_grant_type_1 import InstallTemplateBodyRuntimeGrantType1 # noqa: PLC0415
        from ..models.install_template_body_secrets import InstallTemplateBodySecrets # noqa: PLC0415
        from ..models.install_template_body_variables import InstallTemplateBodyVariables # noqa: PLC0415
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




        def _parse_runtime_grant(data: object) -> InstallTemplateBodyRuntimeGrantType1 | str | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                runtime_grant_type_1 = InstallTemplateBodyRuntimeGrantType1.from_dict(data)



                return runtime_grant_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(InstallTemplateBodyRuntimeGrantType1 | str | Unset, data)

        runtime_grant = _parse_runtime_grant(d.pop("runtime_grant", UNSET))


        install_template_body = cls(
            address=address,
            domain=domain,
            variables=variables,
            secrets=secrets,
            runtime_grant=runtime_grant,
        )

        return install_template_body

