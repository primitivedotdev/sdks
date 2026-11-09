from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.template_manifest_schema_version import TemplateManifestSchemaVersion
from typing import cast

if TYPE_CHECKING:
  from ..models.template_author import TemplateAuthor
  from ..models.template_install import TemplateInstall
  from ..models.template_schedule import TemplateSchedule
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
            schema_version (TemplateManifestSchemaVersion):
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
            schedule (TemplateSchedule | Unset): A default wake schedule the install creates for the function: the command
                it sends, a 5-field cron expression and timezone, and the scheduler sender localpart on the installed address's
                domain. The owner can change or delete it after install.
            setup (TemplateSetup | Unset):
            post_install (str | Unset):
            recommended_grant (Any | Unset): The runtime key the template suggests for the function it installs: a preset
                name, or an object with preset and optional addresses, permissions and mail_scope. The installer still chooses
                within their own access, and a value the server cannot use is ignored.
     """

    schema_version: TemplateManifestSchemaVersion
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
    schedule: TemplateSchedule | Unset = UNSET
    setup: TemplateSetup | Unset = UNSET
    post_install: str | Unset = UNSET
    recommended_grant: Any | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.template_author import TemplateAuthor # noqa: PLC0415
        from ..models.template_install import TemplateInstall # noqa: PLC0415
        from ..models.template_schedule import TemplateSchedule # noqa: PLC0415
        from ..models.template_secret import TemplateSecret # noqa: PLC0415
        from ..models.template_secret_group import TemplateSecretGroup # noqa: PLC0415
        from ..models.template_setup import TemplateSetup # noqa: PLC0415
        from ..models.template_source_type_0 import TemplateSourceType0 # noqa: PLC0415
        from ..models.template_source_type_1 import TemplateSourceType1 # noqa: PLC0415
        from ..models.template_variable import TemplateVariable # noqa: PLC0415
        schema_version = self.schema_version.value

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

        schedule: dict[str, Any] | Unset = UNSET
        if not isinstance(self.schedule, Unset):
            schedule = self.schedule.to_dict()

        setup: dict[str, Any] | Unset = UNSET
        if not isinstance(self.setup, Unset):
            setup = self.setup.to_dict()

        post_install = self.post_install

        recommended_grant = self.recommended_grant


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
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
        if schedule is not UNSET:
            field_dict["schedule"] = schedule
        if setup is not UNSET:
            field_dict["setup"] = setup
        if post_install is not UNSET:
            field_dict["postInstall"] = post_install
        if recommended_grant is not UNSET:
            field_dict["recommendedGrant"] = recommended_grant

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.template_author import TemplateAuthor # noqa: PLC0415
        from ..models.template_install import TemplateInstall # noqa: PLC0415
        from ..models.template_schedule import TemplateSchedule # noqa: PLC0415
        from ..models.template_secret import TemplateSecret # noqa: PLC0415
        from ..models.template_secret_group import TemplateSecretGroup # noqa: PLC0415
        from ..models.template_setup import TemplateSetup # noqa: PLC0415
        from ..models.template_source_type_0 import TemplateSourceType0 # noqa: PLC0415
        from ..models.template_source_type_1 import TemplateSourceType1 # noqa: PLC0415
        from ..models.template_variable import TemplateVariable # noqa: PLC0415
        d = dict(src_dict)
        schema_version = TemplateManifestSchemaVersion(d.pop("schemaVersion"))




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

        _schedule = d.pop("schedule", UNSET)
        schedule: TemplateSchedule | Unset
        if isinstance(_schedule,  Unset):
            schedule = UNSET
        else:
            schedule = TemplateSchedule.from_dict(_schedule)




        _setup = d.pop("setup", UNSET)
        setup: TemplateSetup | Unset
        if isinstance(_setup,  Unset):
            setup = UNSET
        else:
            setup = TemplateSetup.from_dict(_setup)




        post_install = d.pop("postInstall", UNSET)

        recommended_grant = d.pop("recommendedGrant", UNSET)

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
            schedule=schedule,
            setup=setup,
            post_install=post_install,
            recommended_grant=recommended_grant,
        )


        template_manifest.additional_properties = d
        return template_manifest

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
