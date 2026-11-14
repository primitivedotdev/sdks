from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_email_rule_share_result_end_reason_type_1 import GetEmailRuleShareResultEndReasonType1
from ..models.get_email_rule_share_result_end_reason_type_2_type_1 import GetEmailRuleShareResultEndReasonType2Type1
from ..models.get_email_rule_share_result_end_reason_type_3_type_1 import GetEmailRuleShareResultEndReasonType3Type1
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_share_activity import EmailRuleShareActivity
  from ..models.email_rule_share_beneficiary import EmailRuleShareBeneficiary
  from ..models.email_rule_share_granter import EmailRuleShareGranter
  from ..models.get_email_rule_share_result_rule_type_0 import GetEmailRuleShareResultRuleType0





T = TypeVar("T", bound="GetEmailRuleShareResult")



@_attrs_define
class GetEmailRuleShareResult:
    """ 
        Attributes:
            id (UUID):
            request_id (UUID):
            created_at (datetime.datetime):
            ended_at (datetime.datetime | None):
            end_reason (GetEmailRuleShareResultEndReasonType1 | GetEmailRuleShareResultEndReasonType2Type1 |
                GetEmailRuleShareResultEndReasonType3Type1 | None): Why it ended, once it has: stopped_by_granter,
                removed_by_beneficiary, stopped_by_admin, rule_changed (a new version of the rule was saved, on a share that
                ended before new versions kept shares) or rule_deleted (the rule was deleted; the share keeps its record, and
                the rule is no longer shown). Null while it has not.
            accepted_rule_version (int): The version of the rule that was accepted. A later version keeps the share: what
                each version matches is shared from when it is saved.
            edited_on_accept (bool): Whether the member who accepted changed the rule's English, tree or explanation before
                accepting (a new name does not count).
            live (bool): Not ended, and both people are still members under the memberships that were recorded.
            delivery_paused (bool | None): True when the rule is active and the share live but new email is not being shared
                now (what was shared stays visible); false when new email is shared. Null when it does not apply (share not
                live, rule not active, or you are not on the share) or could not be read.
            is_granter (bool): Whether you are the member sharing their mail.
            is_beneficiary (bool): Whether you are the member it is shared with.
            granter (EmailRuleShareGranter):
            beneficiary (EmailRuleShareBeneficiary):
            rule (GetEmailRuleShareResultRuleType0 | None): The rule's name, state and description; null once the share is
                not live, except for the member sharing their mail.
            rule_id (None | UUID): The rule itself. Only for the member sharing their mail; null for anyone else. The member
                it is shared with lists this share's id in a key's grant.rules instead (from the dashboard), and their own
                webhooks receive what it shares.
            activity (EmailRuleShareActivity | None | Unset): For the member it is shared with, on the dashboard or the
                Primitive CLI, while it is live and their access reads content: whether it is working, so a quiet mailbox can be
                told from a stopped share. Null otherwise.
     """

    id: UUID
    request_id: UUID
    created_at: datetime.datetime
    ended_at: datetime.datetime | None
    end_reason: GetEmailRuleShareResultEndReasonType1 | GetEmailRuleShareResultEndReasonType2Type1 | GetEmailRuleShareResultEndReasonType3Type1 | None
    accepted_rule_version: int
    edited_on_accept: bool
    live: bool
    delivery_paused: bool | None
    is_granter: bool
    is_beneficiary: bool
    granter: EmailRuleShareGranter
    beneficiary: EmailRuleShareBeneficiary
    rule: GetEmailRuleShareResultRuleType0 | None
    rule_id: None | UUID
    activity: EmailRuleShareActivity | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_share_activity import EmailRuleShareActivity # noqa: PLC0415
        from ..models.email_rule_share_beneficiary import EmailRuleShareBeneficiary # noqa: PLC0415
        from ..models.email_rule_share_granter import EmailRuleShareGranter # noqa: PLC0415
        from ..models.get_email_rule_share_result_rule_type_0 import GetEmailRuleShareResultRuleType0 # noqa: PLC0415
        id = str(self.id)

        request_id = str(self.request_id)

        created_at = self.created_at.isoformat()

        ended_at: None | str
        if isinstance(self.ended_at, datetime.datetime):
            ended_at = self.ended_at.isoformat()
        else:
            ended_at = self.ended_at

        end_reason: None | str
        if isinstance(self.end_reason, GetEmailRuleShareResultEndReasonType1):
            end_reason = self.end_reason.value
        elif isinstance(self.end_reason, GetEmailRuleShareResultEndReasonType2Type1):
            end_reason = self.end_reason.value
        elif isinstance(self.end_reason, GetEmailRuleShareResultEndReasonType3Type1):
            end_reason = self.end_reason.value
        else:
            end_reason = self.end_reason

        accepted_rule_version = self.accepted_rule_version

        edited_on_accept = self.edited_on_accept

        live = self.live

        delivery_paused: bool | None
        delivery_paused = self.delivery_paused

        is_granter = self.is_granter

        is_beneficiary = self.is_beneficiary

        granter = self.granter.to_dict()

        beneficiary = self.beneficiary.to_dict()

        rule: dict[str, Any] | None
        if isinstance(self.rule, GetEmailRuleShareResultRuleType0):
            rule = self.rule.to_dict()
        else:
            rule = self.rule

        rule_id: None | str
        if isinstance(self.rule_id, UUID):
            rule_id = str(self.rule_id)
        else:
            rule_id = self.rule_id

        activity: dict[str, Any] | None | Unset
        if isinstance(self.activity, Unset):
            activity = UNSET
        elif isinstance(self.activity, EmailRuleShareActivity):
            activity = self.activity.to_dict()
        else:
            activity = self.activity


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "request_id": request_id,
            "created_at": created_at,
            "ended_at": ended_at,
            "end_reason": end_reason,
            "accepted_rule_version": accepted_rule_version,
            "edited_on_accept": edited_on_accept,
            "live": live,
            "delivery_paused": delivery_paused,
            "is_granter": is_granter,
            "is_beneficiary": is_beneficiary,
            "granter": granter,
            "beneficiary": beneficiary,
            "rule": rule,
            "rule_id": rule_id,
        })
        if activity is not UNSET:
            field_dict["activity"] = activity

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_share_activity import EmailRuleShareActivity # noqa: PLC0415
        from ..models.email_rule_share_beneficiary import EmailRuleShareBeneficiary # noqa: PLC0415
        from ..models.email_rule_share_granter import EmailRuleShareGranter # noqa: PLC0415
        from ..models.get_email_rule_share_result_rule_type_0 import GetEmailRuleShareResultRuleType0 # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        request_id = UUID(d.pop("request_id"))




        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




        def _parse_ended_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                ended_at_type_0 = datetime.datetime.fromisoformat(data)



                return ended_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        ended_at = _parse_ended_at(d.pop("ended_at"))


        def _parse_end_reason(data: object) -> GetEmailRuleShareResultEndReasonType1 | GetEmailRuleShareResultEndReasonType2Type1 | GetEmailRuleShareResultEndReasonType3Type1 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                end_reason_type_1 = GetEmailRuleShareResultEndReasonType1(data)



                return end_reason_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                end_reason_type_2_type_1 = GetEmailRuleShareResultEndReasonType2Type1(data)



                return end_reason_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                end_reason_type_3_type_1 = GetEmailRuleShareResultEndReasonType3Type1(data)



                return end_reason_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(GetEmailRuleShareResultEndReasonType1 | GetEmailRuleShareResultEndReasonType2Type1 | GetEmailRuleShareResultEndReasonType3Type1 | None, data)

        end_reason = _parse_end_reason(d.pop("end_reason"))


        accepted_rule_version = d.pop("accepted_rule_version")

        edited_on_accept = d.pop("edited_on_accept")

        live = d.pop("live")

        def _parse_delivery_paused(data: object) -> bool | None:
            if data is None:
                return data
            return cast(bool | None, data)

        delivery_paused = _parse_delivery_paused(d.pop("delivery_paused"))


        is_granter = d.pop("is_granter")

        is_beneficiary = d.pop("is_beneficiary")

        granter = EmailRuleShareGranter.from_dict(d.pop("granter"))




        beneficiary = EmailRuleShareBeneficiary.from_dict(d.pop("beneficiary"))




        def _parse_rule(data: object) -> GetEmailRuleShareResultRuleType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                rule_type_0 = GetEmailRuleShareResultRuleType0.from_dict(data)



                return rule_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(GetEmailRuleShareResultRuleType0 | None, data)

        rule = _parse_rule(d.pop("rule"))


        def _parse_rule_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                rule_id_type_0 = UUID(data)



                return rule_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        rule_id = _parse_rule_id(d.pop("rule_id"))


        def _parse_activity(data: object) -> EmailRuleShareActivity | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                activity_type_1 = EmailRuleShareActivity.from_dict(data)



                return activity_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailRuleShareActivity | None | Unset, data)

        activity = _parse_activity(d.pop("activity", UNSET))


        get_email_rule_share_result = cls(
            id=id,
            request_id=request_id,
            created_at=created_at,
            ended_at=ended_at,
            end_reason=end_reason,
            accepted_rule_version=accepted_rule_version,
            edited_on_accept=edited_on_accept,
            live=live,
            delivery_paused=delivery_paused,
            is_granter=is_granter,
            is_beneficiary=is_beneficiary,
            granter=granter,
            beneficiary=beneficiary,
            rule=rule,
            rule_id=rule_id,
            activity=activity,
        )


        get_email_rule_share_result.additional_properties = d
        return get_email_rule_share_result

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
