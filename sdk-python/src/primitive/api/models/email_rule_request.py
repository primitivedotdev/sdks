from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_rule_request_proposed_via import EmailRuleRequestProposedVia
from ..models.email_rule_request_status import EmailRuleRequestStatus
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_request_proposer import EmailRuleRequestProposer
  from ..models.email_rule_request_target import EmailRuleRequestTarget
  from ..models.email_rule_tree import EmailRuleTree





T = TypeVar("T", bound="EmailRuleRequest")



@_attrs_define
class EmailRuleRequest:
    """ 
        Attributes:
            id (UUID):
            status (EmailRuleRequestStatus):
            name (str):
            english (str):
            tree (EmailRuleTree):
            explanation (str):
            assumptions (list[str]):
            warnings (list[str]):
            compiled_by (str):
            vocabulary (str):
            proposed_via (EmailRuleRequestProposedVia): session: the proposer's own session; oauth: an OAuth or CLI token
                acting for them.
            created_at (datetime.datetime):
            decided_at (datetime.datetime | None):
            decided_by_user_id (None | UUID):
            proposer (EmailRuleRequestProposer):
            target (EmailRuleRequestTarget):
            target_address_typed (None | str): The address the proposer typed to name the target; null for anyone else, and
                when named by user id.
            is_proposer (bool):
            is_target (bool):
            share_id (None | UUID): The share accepting created, while it exists.
            message (None | str | Unset): What the member asking wrote about why; null when they wrote nothing.
            decline_reason (None | str | Unset): Why the member asked declined it; null unless they gave a reason when
                declining.
     """

    id: UUID
    status: EmailRuleRequestStatus
    name: str
    english: str
    tree: EmailRuleTree
    explanation: str
    assumptions: list[str]
    warnings: list[str]
    compiled_by: str
    vocabulary: str
    proposed_via: EmailRuleRequestProposedVia
    created_at: datetime.datetime
    decided_at: datetime.datetime | None
    decided_by_user_id: None | UUID
    proposer: EmailRuleRequestProposer
    target: EmailRuleRequestTarget
    target_address_typed: None | str
    is_proposer: bool
    is_target: bool
    share_id: None | UUID
    message: None | str | Unset = UNSET
    decline_reason: None | str | Unset = UNSET
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

        explanation = self.explanation

        assumptions = self.assumptions



        warnings = self.warnings



        compiled_by = self.compiled_by

        vocabulary = self.vocabulary

        proposed_via = self.proposed_via.value

        created_at = self.created_at.isoformat()

        decided_at: None | str
        if isinstance(self.decided_at, datetime.datetime):
            decided_at = self.decided_at.isoformat()
        else:
            decided_at = self.decided_at

        decided_by_user_id: None | str
        if isinstance(self.decided_by_user_id, UUID):
            decided_by_user_id = str(self.decided_by_user_id)
        else:
            decided_by_user_id = self.decided_by_user_id

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

        message: None | str | Unset
        if isinstance(self.message, Unset):
            message = UNSET
        else:
            message = self.message

        decline_reason: None | str | Unset
        if isinstance(self.decline_reason, Unset):
            decline_reason = UNSET
        else:
            decline_reason = self.decline_reason


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "status": status,
            "name": name,
            "english": english,
            "tree": tree,
            "explanation": explanation,
            "assumptions": assumptions,
            "warnings": warnings,
            "compiled_by": compiled_by,
            "vocabulary": vocabulary,
            "proposed_via": proposed_via,
            "created_at": created_at,
            "decided_at": decided_at,
            "decided_by_user_id": decided_by_user_id,
            "proposer": proposer,
            "target": target,
            "target_address_typed": target_address_typed,
            "is_proposer": is_proposer,
            "is_target": is_target,
            "share_id": share_id,
        })
        if message is not UNSET:
            field_dict["message"] = message
        if decline_reason is not UNSET:
            field_dict["decline_reason"] = decline_reason

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_request_proposer import EmailRuleRequestProposer # noqa: PLC0415
        from ..models.email_rule_request_target import EmailRuleRequestTarget # noqa: PLC0415
        from ..models.email_rule_tree import EmailRuleTree # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        status = EmailRuleRequestStatus(d.pop("status"))




        name = d.pop("name")

        english = d.pop("english")

        tree = EmailRuleTree.from_dict(d.pop("tree"))




        explanation = d.pop("explanation")

        assumptions = cast(list[str], d.pop("assumptions"))


        warnings = cast(list[str], d.pop("warnings"))


        compiled_by = d.pop("compiled_by")

        vocabulary = d.pop("vocabulary")

        proposed_via = EmailRuleRequestProposedVia(d.pop("proposed_via"))




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


        def _parse_decided_by_user_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                decided_by_user_id_type_0 = UUID(data)



                return decided_by_user_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        decided_by_user_id = _parse_decided_by_user_id(d.pop("decided_by_user_id"))


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


        def _parse_message(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        message = _parse_message(d.pop("message", UNSET))


        def _parse_decline_reason(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        decline_reason = _parse_decline_reason(d.pop("decline_reason", UNSET))


        email_rule_request = cls(
            id=id,
            status=status,
            name=name,
            english=english,
            tree=tree,
            explanation=explanation,
            assumptions=assumptions,
            warnings=warnings,
            compiled_by=compiled_by,
            vocabulary=vocabulary,
            proposed_via=proposed_via,
            created_at=created_at,
            decided_at=decided_at,
            decided_by_user_id=decided_by_user_id,
            proposer=proposer,
            target=target,
            target_address_typed=target_address_typed,
            is_proposer=is_proposer,
            is_target=is_target,
            share_id=share_id,
            message=message,
            decline_reason=decline_reason,
        )


        email_rule_request.additional_properties = d
        return email_rule_request

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
