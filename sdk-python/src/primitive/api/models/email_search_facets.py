from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.email_search_facet_bucket import EmailSearchFacetBucket
  from ..models.email_search_facets_has_attachment import EmailSearchFacetsHasAttachment





T = TypeVar("T", bound="EmailSearchFacets")



@_attrs_define
class EmailSearchFacets:
    """ 
        Attributes:
            by_sender (list[EmailSearchFacetBucket]):
            by_domain (list[EmailSearchFacetBucket]):
            by_status (list[EmailSearchFacetBucket]):
            has_attachment (EmailSearchFacetsHasAttachment):
     """

    by_sender: list[EmailSearchFacetBucket]
    by_domain: list[EmailSearchFacetBucket]
    by_status: list[EmailSearchFacetBucket]
    has_attachment: EmailSearchFacetsHasAttachment
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_search_facet_bucket import EmailSearchFacetBucket
        from ..models.email_search_facets_has_attachment import EmailSearchFacetsHasAttachment
        by_sender = []
        for by_sender_item_data in self.by_sender:
            by_sender_item = by_sender_item_data.to_dict()
            by_sender.append(by_sender_item)



        by_domain = []
        for by_domain_item_data in self.by_domain:
            by_domain_item = by_domain_item_data.to_dict()
            by_domain.append(by_domain_item)



        by_status = []
        for by_status_item_data in self.by_status:
            by_status_item = by_status_item_data.to_dict()
            by_status.append(by_status_item)



        has_attachment = self.has_attachment.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "by_sender": by_sender,
            "by_domain": by_domain,
            "by_status": by_status,
            "has_attachment": has_attachment,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_search_facet_bucket import EmailSearchFacetBucket
        from ..models.email_search_facets_has_attachment import EmailSearchFacetsHasAttachment
        d = dict(src_dict)
        by_sender = []
        _by_sender = d.pop("by_sender")
        for by_sender_item_data in (_by_sender):
            by_sender_item = EmailSearchFacetBucket.from_dict(by_sender_item_data)



            by_sender.append(by_sender_item)


        by_domain = []
        _by_domain = d.pop("by_domain")
        for by_domain_item_data in (_by_domain):
            by_domain_item = EmailSearchFacetBucket.from_dict(by_domain_item_data)



            by_domain.append(by_domain_item)


        by_status = []
        _by_status = d.pop("by_status")
        for by_status_item_data in (_by_status):
            by_status_item = EmailSearchFacetBucket.from_dict(by_status_item_data)



            by_status.append(by_status_item)


        has_attachment = EmailSearchFacetsHasAttachment.from_dict(d.pop("has_attachment"))




        email_search_facets = cls(
            by_sender=by_sender,
            by_domain=by_domain,
            by_status=by_status,
            has_attachment=has_attachment,
        )


        email_search_facets.additional_properties = d
        return email_search_facets

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
