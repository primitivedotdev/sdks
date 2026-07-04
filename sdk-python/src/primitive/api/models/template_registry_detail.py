from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.template_registry_status import TemplateRegistryStatus
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.template_author import TemplateAuthor
  from ..models.template_manifest import TemplateManifest





T = TypeVar("T", bound="TemplateRegistryDetail")



@_attrs_define
class TemplateRegistryDetail:
    """ 
        Attributes:
            id (UUID):
            slug (str): Stable template slug used in template URLs and install commands.
            title (str):
            summary (str):
            author (TemplateAuthor):
            tags (list[str]):
            verified (bool):
            install_count (int):
            github_repo (str): GitHub repository in owner/repo form.
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            description (None | str):
            github_sha (str):
            github_path (None | str):
            manifest (TemplateManifest):
            readme (None | str):
            status (TemplateRegistryStatus):
     """

    id: UUID
    slug: str
    title: str
    summary: str
    author: TemplateAuthor
    tags: list[str]
    verified: bool
    install_count: int
    github_repo: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    description: None | str
    github_sha: str
    github_path: None | str
    manifest: TemplateManifest
    readme: None | str
    status: TemplateRegistryStatus
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.template_author import TemplateAuthor
        from ..models.template_manifest import TemplateManifest
        id = str(self.id)

        slug = self.slug

        title = self.title

        summary = self.summary

        author = self.author.to_dict()

        tags = self.tags



        verified = self.verified

        install_count = self.install_count

        github_repo = self.github_repo

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        description: None | str
        description = self.description

        github_sha = self.github_sha

        github_path: None | str
        github_path = self.github_path

        manifest = self.manifest.to_dict()

        readme: None | str
        readme = self.readme

        status = self.status.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "slug": slug,
            "title": title,
            "summary": summary,
            "author": author,
            "tags": tags,
            "verified": verified,
            "install_count": install_count,
            "github_repo": github_repo,
            "created_at": created_at,
            "updated_at": updated_at,
            "description": description,
            "github_sha": github_sha,
            "github_path": github_path,
            "manifest": manifest,
            "readme": readme,
            "status": status,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.template_author import TemplateAuthor
        from ..models.template_manifest import TemplateManifest
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        slug = d.pop("slug")

        title = d.pop("title")

        summary = d.pop("summary")

        author = TemplateAuthor.from_dict(d.pop("author"))




        tags = cast(list[str], d.pop("tags"))


        verified = d.pop("verified")

        install_count = d.pop("install_count")

        github_repo = d.pop("github_repo")

        created_at = isoparse(d.pop("created_at"))




        updated_at = isoparse(d.pop("updated_at"))




        def _parse_description(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        description = _parse_description(d.pop("description"))


        github_sha = d.pop("github_sha")

        def _parse_github_path(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        github_path = _parse_github_path(d.pop("github_path"))


        manifest = TemplateManifest.from_dict(d.pop("manifest"))




        def _parse_readme(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        readme = _parse_readme(d.pop("readme"))


        status = TemplateRegistryStatus(d.pop("status"))




        template_registry_detail = cls(
            id=id,
            slug=slug,
            title=title,
            summary=summary,
            author=author,
            tags=tags,
            verified=verified,
            install_count=install_count,
            github_repo=github_repo,
            created_at=created_at,
            updated_at=updated_at,
            description=description,
            github_sha=github_sha,
            github_path=github_path,
            manifest=manifest,
            readme=readme,
            status=status,
        )


        template_registry_detail.additional_properties = d
        return template_registry_detail

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
