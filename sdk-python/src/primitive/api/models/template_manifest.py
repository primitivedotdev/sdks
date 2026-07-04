from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from typing import Literal, cast

if TYPE_CHECKING:
  from ..models.template_author import TemplateAuthor
  from ..models.template_install import TemplateInstall
  from ..models.template_secret import TemplateSecret
  from ..models.template_secret_group import TemplateSecretGroup
  from ..models.template_setup import TemplateSetup
  from ..models.template_source_type_0 import TemplateSourceType0
  from ..models.template_source_type_1 import TemplateSourceType1
  from ..models.template_variable import TemplateVariable





T = TypeVar("T", bound="TemplateManifest")



@_attrs_define
class TemplateManifest:
    """ 
        Attributes:
            schema_version (Literal[1]):
            id (str): Stable template slug from the manifest.
            title (str):
            summary (str):
            author (TemplateAuthor):
            tags (list[str]):
            source (TemplateSourceType0 | TemplateSourceType1):
            install (TemplateInstall):
            secrets (list[TemplateSecret]):
            secret_groups (list[TemplateSecretGroup]):
            variables (list[TemplateVariable]):
            description (str | Unset):
            setup (TemplateSetup | Unset):
            post_install (str | Unset):
     """

    schema_version: Literal[1]
    id: str
    title: str
    summary: str
    author: TemplateAuthor
    tags: list[str]
    source: TemplateSourceType0 | TemplateSourceType1
    install: TemplateInstall
    secrets: list[TemplateSecret]
    secret_groups: list[TemplateSecretGroup]
    variables: list[TemplateVariable]
    description: str | Unset = UNSET
    setup: TemplateSetup | Unset = UNSET
    post_install: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.template_author import TemplateAuthor
        from ..models.template_install import TemplateInstall
        from ..models.template_secret import TemplateSecret
        from ..models.template_secret_group import TemplateSecretGroup
        from ..models.template_setup import TemplateSetup
        from ..models.template_source_type_0 import TemplateSourceType0
        from ..models.template_source_type_1 import TemplateSourceType1
        from ..models.template_variable import TemplateVariable
        schema_version = self.schema_version

        id = self.id

        title = self.title

        summary = self.summary

        author = self.author.to_dict()

        tags = self.tags



        source: dict[str, Any]
        if isinstance(self.source, TemplateSourceType0):
            source = self.source.to_dict()
        else:
            source = self.source.to_dict()


        install = self.install.to_dict()

        secrets = []
        for secrets_item_data in self.secrets:
            secrets_item = secrets_item_data.to_dict()
            secrets.append(secrets_item)



        secret_groups = []
        for secret_groups_item_data in self.secret_groups:
            secret_groups_item = secret_groups_item_data.to_dict()
            secret_groups.append(secret_groups_item)



        variables = []
        for variables_item_data in self.variables:
            variables_item = variables_item_data.to_dict()
            variables.append(variables_item)



        description = self.description

        setup: dict[str, Any] | Unset = UNSET
        if not isinstance(self.setup, Unset):
            setup = self.setup.to_dict()

        post_install = self.post_install


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "schemaVersion": schema_version,
            "id": id,
            "title": title,
            "summary": summary,
            "author": author,
            "tags": tags,
            "source": source,
            "install": install,
            "secrets": secrets,
            "secretGroups": secret_groups,
            "variables": variables,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if setup is not UNSET:
            field_dict["setup"] = setup
        if post_install is not UNSET:
            field_dict["postInstall"] = post_install

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.template_author import TemplateAuthor
        from ..models.template_install import TemplateInstall
        from ..models.template_secret import TemplateSecret
        from ..models.template_secret_group import TemplateSecretGroup
        from ..models.template_setup import TemplateSetup
        from ..models.template_source_type_0 import TemplateSourceType0
        from ..models.template_source_type_1 import TemplateSourceType1
        from ..models.template_variable import TemplateVariable
        d = dict(src_dict)
        schema_version = cast(Literal[1] , d.pop("schemaVersion"))
        if schema_version != 1:
            raise ValueError(f"schemaVersion must match const 1, got '{schema_version}'")

        id = d.pop("id")

        title = d.pop("title")

        summary = d.pop("summary")

        author = TemplateAuthor.from_dict(d.pop("author"))




        tags = cast(list[str], d.pop("tags"))


        def _parse_source(data: object) -> TemplateSourceType0 | TemplateSourceType1:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_template_source_type_0 = TemplateSourceType0.from_dict(data)



                return componentsschemas_template_source_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_template_source_type_1 = TemplateSourceType1.from_dict(data)



            return componentsschemas_template_source_type_1

        source = _parse_source(d.pop("source"))


        install = TemplateInstall.from_dict(d.pop("install"))




        secrets = []
        _secrets = d.pop("secrets")
        for secrets_item_data in (_secrets):
            secrets_item = TemplateSecret.from_dict(secrets_item_data)



            secrets.append(secrets_item)


        secret_groups = []
        _secret_groups = d.pop("secretGroups")
        for secret_groups_item_data in (_secret_groups):
            secret_groups_item = TemplateSecretGroup.from_dict(secret_groups_item_data)



            secret_groups.append(secret_groups_item)


        variables = []
        _variables = d.pop("variables")
        for variables_item_data in (_variables):
            variables_item = TemplateVariable.from_dict(variables_item_data)



            variables.append(variables_item)


        description = d.pop("description", UNSET)

        _setup = d.pop("setup", UNSET)
        setup: TemplateSetup | Unset
        if isinstance(_setup,  Unset):
            setup = UNSET
        else:
            setup = TemplateSetup.from_dict(_setup)




        post_install = d.pop("postInstall", UNSET)

        template_manifest = cls(
            schema_version=schema_version,
            id=id,
            title=title,
            summary=summary,
            author=author,
            tags=tags,
            source=source,
            install=install,
            secrets=secrets,
            secret_groups=secret_groups,
            variables=variables,
            description=description,
            setup=setup,
            post_install=post_install,
        )

        return template_manifest

