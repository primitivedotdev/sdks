from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.semantic_search_field import SemanticSearchField
from ..models.semantic_search_result_source_type import SemanticSearchResultSourceType
from typing import cast

if TYPE_CHECKING:
  from ..models.semantic_search_score_breakdown import SemanticSearchScoreBreakdown
  from ..models.semantic_search_snippet import SemanticSearchSnippet





T = TypeVar("T", bound="SemanticSearchResult")



@_attrs_define
class SemanticSearchResult:
    """ 
        Attributes:
            source_type (SemanticSearchResultSourceType): Whether this row is a received or sent message.
            id (str): Message id. Combine with `api_url` to fetch the full record.
            subject (None | str):
            from_ (None | str):
            to (None | str):
            timestamp (str): Message timestamp (received_at for inbound, created_at for sent).
            status (str): Lifecycle status of the message.
            score (float): Overall relevance score; the `score_breakdown` components account for it.
            semantic_score (float | None): Raw semantic similarity signal, or null when not applicable.
            keyword_score (float | None): Raw keyword (lexical) signal, or null when not applicable.
            matched_fields (list[SemanticSearchField]): Fields where the query matched.
            snippets (list[SemanticSearchSnippet]): Match-centered excerpts, one per matched field.
            score_breakdown (SemanticSearchScoreBreakdown): Additive contributions to `score`. `semantic` and `keyword` are
                the
                raw signals times the mode's weight (null when not applicable);
                these plus `field_boost` and `recency` sum to `score` before each
                value is independently rounded to 5 decimal places.
            api_url (None | str): Relative API path to fetch the full message.
     """

    source_type: SemanticSearchResultSourceType
    id: str
    subject: None | str
    from_: None | str
    to: None | str
    timestamp: str
    status: str
    score: float
    semantic_score: float | None
    keyword_score: float | None
    matched_fields: list[SemanticSearchField]
    snippets: list[SemanticSearchSnippet]
    score_breakdown: SemanticSearchScoreBreakdown
    api_url: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.semantic_search_score_breakdown import SemanticSearchScoreBreakdown
        from ..models.semantic_search_snippet import SemanticSearchSnippet
        source_type = self.source_type.value

        id = self.id

        subject: None | str
        subject = self.subject

        from_: None | str
        from_ = self.from_

        to: None | str
        to = self.to

        timestamp = self.timestamp

        status = self.status

        score = self.score

        semantic_score: float | None
        semantic_score = self.semantic_score

        keyword_score: float | None
        keyword_score = self.keyword_score

        matched_fields = []
        for matched_fields_item_data in self.matched_fields:
            matched_fields_item = matched_fields_item_data.value
            matched_fields.append(matched_fields_item)



        snippets = []
        for snippets_item_data in self.snippets:
            snippets_item = snippets_item_data.to_dict()
            snippets.append(snippets_item)



        score_breakdown = self.score_breakdown.to_dict()

        api_url: None | str
        api_url = self.api_url


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "source_type": source_type,
            "id": id,
            "subject": subject,
            "from": from_,
            "to": to,
            "timestamp": timestamp,
            "status": status,
            "score": score,
            "semantic_score": semantic_score,
            "keyword_score": keyword_score,
            "matched_fields": matched_fields,
            "snippets": snippets,
            "score_breakdown": score_breakdown,
            "api_url": api_url,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.semantic_search_score_breakdown import SemanticSearchScoreBreakdown
        from ..models.semantic_search_snippet import SemanticSearchSnippet
        d = dict(src_dict)
        source_type = SemanticSearchResultSourceType(d.pop("source_type"))




        id = d.pop("id")

        def _parse_subject(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        subject = _parse_subject(d.pop("subject"))


        def _parse_from_(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        from_ = _parse_from_(d.pop("from"))


        def _parse_to(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        to = _parse_to(d.pop("to"))


        timestamp = d.pop("timestamp")

        status = d.pop("status")

        score = d.pop("score")

        def _parse_semantic_score(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        semantic_score = _parse_semantic_score(d.pop("semantic_score"))


        def _parse_keyword_score(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        keyword_score = _parse_keyword_score(d.pop("keyword_score"))


        matched_fields = []
        _matched_fields = d.pop("matched_fields")
        for matched_fields_item_data in (_matched_fields):
            matched_fields_item = SemanticSearchField(matched_fields_item_data)



            matched_fields.append(matched_fields_item)


        snippets = []
        _snippets = d.pop("snippets")
        for snippets_item_data in (_snippets):
            snippets_item = SemanticSearchSnippet.from_dict(snippets_item_data)



            snippets.append(snippets_item)


        score_breakdown = SemanticSearchScoreBreakdown.from_dict(d.pop("score_breakdown"))




        def _parse_api_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        api_url = _parse_api_url(d.pop("api_url"))


        semantic_search_result = cls(
            source_type=source_type,
            id=id,
            subject=subject,
            from_=from_,
            to=to,
            timestamp=timestamp,
            status=status,
            score=score,
            semantic_score=semantic_score,
            keyword_score=keyword_score,
            matched_fields=matched_fields,
            snippets=snippets,
            score_breakdown=score_breakdown,
            api_url=api_url,
        )


        semantic_search_result.additional_properties = d
        return semantic_search_result

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
