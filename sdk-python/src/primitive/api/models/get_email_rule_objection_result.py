from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_email_rule_objection_result_status import GetEmailRuleObjectionResultStatus
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_objection_person import EmailRuleObjectionPerson
  from ..models.get_email_rule_objection_result_rule import GetEmailRuleObjectionResultRule





T = TypeVar("T", bound="GetEmailRuleObjectionResult")



@_attrs_define
class GetEmailRuleObjectionResult:
    """ 
        Attributes:
            id (UUID):
            status (GetEmailRuleObjectionResultStatus): pending until the rule's author accepts it (turning the rule off),
                declines it, or answers it amended (they saved a newer version of the rule), or the member who made it withdraws
                it; never changes after.
            rule (GetEmailRuleObjectionResultRule):
            objector (EmailRuleObjectionPerson):
            author (EmailRuleObjectionPerson):
            is_objector (bool): Whether you made it, in your current membership.
            is_author (bool): Whether it is to a rule you wrote, in your current membership.
            message (None | str): Why they object and what they ask (to turn the rule off, narrow it, or explain who
                receives it); null when none was given, or once withdrawn.
            decline_reason (None | str): The author's answer when declining, which the objector sees; null when none was
                given.
            amend_note (None | str): The author's note when answering amended, which the objector sees; null when none was
                given.
            created_at (datetime.datetime):
            decided_at (datetime.datetime | None):
            decided_by_user_id (None | UUID):
     """

    id: UUID
    status: GetEmailRuleObjectionResultStatus
    rule: GetEmailRuleObjectionResultRule
    objector: EmailRuleObjectionPerson
    author: EmailRuleObjectionPerson
    is_objector: bool
    is_author: bool
    message: None | str
    decline_reason: None | str
    amend_note: None | str
    created_at: datetime.datetime
    decided_at: datetime.datetime | None
    decided_by_user_id: None | UUID
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_objection_person import EmailRuleObjectionPerson # noqa: PLC0415
        from ..models.get_email_rule_objection_result_rule import GetEmailRuleObjectionResultRule # noqa: PLC0415
        id = str(self.id)

        status = self.status.value

        rule = self.rule.to_dict()

        objector = self.objector.to_dict()

        author = self.author.to_dict()

        is_objector = self.is_objector

        is_author = self.is_author

        message: None | str
        message = self.message

        decline_reason: None | str
        decline_reason = self.decline_reason

        amend_note: None | str
        amend_note = self.amend_note

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


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "status": status,
            "rule": rule,
            "objector": objector,
            "author": author,
            "is_objector": is_objector,
            "is_author": is_author,
            "message": message,
            "decline_reason": decline_reason,
            "amend_note": amend_note,
            "created_at": created_at,
            "decided_at": decided_at,
            "decided_by_user_id": decided_by_user_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_objection_person import EmailRuleObjectionPerson # noqa: PLC0415
        from ..models.get_email_rule_objection_result_rule import GetEmailRuleObjectionResultRule # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        status = GetEmailRuleObjectionResultStatus(d.pop("status"))




        rule = GetEmailRuleObjectionResultRule.from_dict(d.pop("rule"))




        objector = EmailRuleObjectionPerson.from_dict(d.pop("objector"))




        author = EmailRuleObjectionPerson.from_dict(d.pop("author"))




        is_objector = d.pop("is_objector")

        is_author = d.pop("is_author")

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


        def _parse_amend_note(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        amend_note = _parse_amend_note(d.pop("amend_note"))


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


        get_email_rule_objection_result = cls(
            id=id,
            status=status,
            rule=rule,
            objector=objector,
            author=author,
            is_objector=is_objector,
            is_author=is_author,
            message=message,
            decline_reason=decline_reason,
            amend_note=amend_note,
            created_at=created_at,
            decided_at=decided_at,
            decided_by_user_id=decided_by_user_id,
        )


        get_email_rule_objection_result.additional_properties = d
        return get_email_rule_objection_result

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
