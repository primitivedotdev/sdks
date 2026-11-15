from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.accept_email_rule_request_request_kind import AcceptEmailRuleRequestRequestKind
from typing import cast

if TYPE_CHECKING:
  from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput
  from ..models.email_rule_tree_input import EmailRuleTreeInput





T = TypeVar("T", bound="AcceptEmailRuleRequestRequest")



@_attrs_define
class AcceptEmailRuleRequestRequest:
    """ 
        Attributes:
            name (str | Unset): A name for the rule. Defaults to the name it was asked for under.
            english (str | Unset): The plain-English description the rule was compiled from.
            tree (EmailRuleTreeInput | Unset):
            kind (AcceptEmailRuleRequestRequestKind | Unset): Only grant.
            expectation_samples (list[EmailRuleExpectationSampleInput] | Unset): Made-up emails the rule must match or not,
                such as look-alikes it must never match, kept on the rule this accept writes.
     """

    name: str | Unset = UNSET
    english: str | Unset = UNSET
    tree: EmailRuleTreeInput | Unset = UNSET
    kind: AcceptEmailRuleRequestRequestKind | Unset = UNSET
    expectation_samples: list[EmailRuleExpectationSampleInput] | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput # noqa: PLC0415
        from ..models.email_rule_tree_input import EmailRuleTreeInput # noqa: PLC0415
        name = self.name

        english = self.english

        tree: dict[str, Any] | Unset = UNSET
        if not isinstance(self.tree, Unset):
            tree = self.tree.to_dict()

        kind: str | Unset = UNSET
        if not isinstance(self.kind, Unset):
            kind = self.kind.value


        expectation_samples: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.expectation_samples, Unset):
            expectation_samples = []
            for expectation_samples_item_data in self.expectation_samples:
                expectation_samples_item = expectation_samples_item_data.to_dict()
                expectation_samples.append(expectation_samples_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if english is not UNSET:
            field_dict["english"] = english
        if tree is not UNSET:
            field_dict["tree"] = tree
        if kind is not UNSET:
            field_dict["kind"] = kind
        if expectation_samples is not UNSET:
            field_dict["expectation_samples"] = expectation_samples

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_expectation_sample_input import EmailRuleExpectationSampleInput # noqa: PLC0415
        from ..models.email_rule_tree_input import EmailRuleTreeInput # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        english = d.pop("english", UNSET)

        _tree = d.pop("tree", UNSET)
        tree: EmailRuleTreeInput | Unset
        if isinstance(_tree,  Unset):
            tree = UNSET
        else:
            tree = EmailRuleTreeInput.from_dict(_tree)




        _kind = d.pop("kind", UNSET)
        kind: AcceptEmailRuleRequestRequestKind | Unset
        if isinstance(_kind,  Unset):
            kind = UNSET
        else:
            kind = AcceptEmailRuleRequestRequestKind(_kind)




        _expectation_samples = d.pop("expectation_samples", UNSET)
        expectation_samples: list[EmailRuleExpectationSampleInput] | Unset = UNSET
        if _expectation_samples is not UNSET:
            expectation_samples = []
            for expectation_samples_item_data in _expectation_samples:
                expectation_samples_item = EmailRuleExpectationSampleInput.from_dict(expectation_samples_item_data)



                expectation_samples.append(expectation_samples_item)


        accept_email_rule_request_request = cls(
            name=name,
            english=english,
            tree=tree,
            kind=kind,
            expectation_samples=expectation_samples,
        )

        return accept_email_rule_request_request

