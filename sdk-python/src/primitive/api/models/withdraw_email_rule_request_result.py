from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.withdraw_email_rule_request_result_status import WithdrawEmailRuleRequestResultStatus
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_request_proposer import EmailRuleRequestProposer
  from ..models.email_rule_request_target import EmailRuleRequestTarget
  from ..models.email_rule_tree import EmailRuleTree





T = TypeVar("T", bound="WithdrawEmailRuleRequestResult")



@_attrs_define
class WithdrawEmailRuleRequestResult:
    """ 
        Attributes:
            id (UUID):
            status (WithdrawEmailRuleRequestResultStatus):
            name (str):
            english (str):
            tree (EmailRuleTree):
            explanation (None | str): What the rule as asked actually does, as a grant rule: Primitive's reading of its
                tree, never the words of the member who asked or of a model. Null when the tree no longer reads as one.
            warnings (list[str]): Primitive's notes on the rule as asked, from its tree and english, worked out on every
                read. To the member asked while pending, also that it carries no made-up emails it was tested on, and how to
                test it on look-alikes and on their own mail.
            vocabulary (str):
            created_at (datetime.datetime):
            decided_at (datetime.datetime | None):
            proposer (EmailRuleRequestProposer):
            target (EmailRuleRequestTarget):
            target_address_typed (None | str): The address the proposer typed to name the target; null for anyone else, and
                when named by user id.
            is_proposer (bool):
            is_target (bool):
            share_id (None | UUID): The share accepting created, while it exists.
            message (None | str): What the member asking wrote about why; null when they wrote nothing.
            decline_reason (None | str): Why the member asked declined it; null unless they gave a reason when declining.
            share_terms (None | str): For the member asked, while pending: what accepting would share. Null otherwise.
                Whether it was accepted with changes is edited_on_accept on the share.
            accepted_english (None | str): When it was accepted with changes, for the member who asked and the member asked:
                the English that was accepted, beside english, which stays what was asked for. Null otherwise, and from a core-
                api release that predates the field. (The accepted English can match english when only the tree changed.)
     """

    id: UUID
    status: WithdrawEmailRuleRequestResultStatus
    name: str
    english: str
    tree: EmailRuleTree
    explanation: None | str
    warnings: list[str]
    vocabulary: str
    created_at: datetime.datetime
    decided_at: datetime.datetime | None
    proposer: EmailRuleRequestProposer
    target: EmailRuleRequestTarget
    target_address_typed: None | str
    is_proposer: bool
    is_target: bool
    share_id: None | UUID
    message: None | str
    decline_reason: None | str
    share_terms: None | str
    accepted_english: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_request_proposer import EmailRuleRequestProposer # noqa: PLC0415
        from ..models.email_rule_request_target import EmailRuleRequestTarget # noqa: PLC0415
        from ..models.email_rule_tree import EmailRuleTree # noqa: PLC0415
        id = str(self.id)

        status = self.status.value

        name = self.name

        english = self.english

        tree = self.tree.to_dict()

        explanation: None | str
        explanation = self.explanation

        warnings = self.warnings



        vocabulary = self.vocabulary

        created_at = self.created_at.isoformat()

        decided_at: None | str
        if isinstance(self.decided_at, datetime.datetime):
            decided_at = self.decided_at.isoformat()
        else:
            decided_at = self.decided_at

        proposer = self.proposer.to_dict()

        target = self.target.to_dict()

        target_address_typed: None | str
        target_address_typed = self.target_address_typed

        is_proposer = self.is_proposer

        is_target = self.is_target

        share_id: None | str
        if isinstance(self.share_id, UUID):
            share_id = str(self.share_id)
        else:
            share_id = self.share_id

        message: None | str
        message = self.message

        decline_reason: None | str
        decline_reason = self.decline_reason

        share_terms: None | str
        share_terms = self.share_terms

        accepted_english: None | str
        accepted_english = self.accepted_english


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "status": status,
            "name": name,
            "english": english,
            "tree": tree,
            "explanation": explanation,
            "warnings": warnings,
            "vocabulary": vocabulary,
            "created_at": created_at,
            "decided_at": decided_at,
            "proposer": proposer,
            "target": target,
            "target_address_typed": target_address_typed,
            "is_proposer": is_proposer,
            "is_target": is_target,
            "share_id": share_id,
            "message": message,
            "decline_reason": decline_reason,
            "share_terms": share_terms,
            "accepted_english": accepted_english,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_request_proposer import EmailRuleRequestProposer # noqa: PLC0415
        from ..models.email_rule_request_target import EmailRuleRequestTarget # noqa: PLC0415
        from ..models.email_rule_tree import EmailRuleTree # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        status = WithdrawEmailRuleRequestResultStatus(d.pop("status"))




        name = d.pop("name")

        english = d.pop("english")

        tree = EmailRuleTree.from_dict(d.pop("tree"))




        def _parse_explanation(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        explanation = _parse_explanation(d.pop("explanation"))


        warnings = cast(list[str], d.pop("warnings"))


        vocabulary = d.pop("vocabulary")

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        def _parse_decided_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                decided_at_type_0 = datetime.datetime.fromisoformat(data)



                return decided_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        decided_at = _parse_decided_at(d.pop("decided_at"))


        proposer = EmailRuleRequestProposer.from_dict(d.pop("proposer"))




        target = EmailRuleRequestTarget.from_dict(d.pop("target"))




        def _parse_target_address_typed(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        target_address_typed = _parse_target_address_typed(d.pop("target_address_typed"))


        is_proposer = d.pop("is_proposer")

        is_target = d.pop("is_target")

        def _parse_share_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                share_id_type_0 = UUID(data)



                return share_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        share_id = _parse_share_id(d.pop("share_id"))


        def _parse_message(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        message = _parse_message(d.pop("message"))


        def _parse_decline_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        decline_reason = _parse_decline_reason(d.pop("decline_reason"))


        def _parse_share_terms(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        share_terms = _parse_share_terms(d.pop("share_terms"))


        def _parse_accepted_english(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        accepted_english = _parse_accepted_english(d.pop("accepted_english"))


        withdraw_email_rule_request_result = cls(
            id=id,
            status=status,
            name=name,
            english=english,
            tree=tree,
            explanation=explanation,
            warnings=warnings,
            vocabulary=vocabulary,
            created_at=created_at,
            decided_at=decided_at,
            proposer=proposer,
            target=target,
            target_address_typed=target_address_typed,
            is_proposer=is_proposer,
            is_target=is_target,
            share_id=share_id,
            message=message,
            decline_reason=decline_reason,
            share_terms=share_terms,
            accepted_english=accepted_english,
        )


        withdraw_email_rule_request_result.additional_properties = d
        return withdraw_email_rule_request_result

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
