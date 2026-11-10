from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_email_rule_share_emails_result_item_awaiting import ListEmailRuleShareEmailsResultItemAwaiting
from ..models.list_email_rule_share_emails_result_item_interaction_hint import ListEmailRuleShareEmailsResultItemInteractionHint
from ..models.list_email_rule_share_emails_result_item_parse_status_type_1 import ListEmailRuleShareEmailsResultItemParseStatusType1
from ..models.list_email_rule_share_emails_result_item_parse_status_type_2_type_1 import ListEmailRuleShareEmailsResultItemParseStatusType2Type1
from ..models.list_email_rule_share_emails_result_item_parse_status_type_3_type_1 import ListEmailRuleShareEmailsResultItemParseStatusType3Type1
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.list_email_rule_share_emails_result_item_automation_headers_type_0 import ListEmailRuleShareEmailsResultItemAutomationHeadersType0
  from ..models.list_email_rule_share_emails_result_item_delivery_report_type_0 import ListEmailRuleShareEmailsResultItemDeliveryReportType0
  from ..models.list_email_rule_share_emails_result_item_highlights_type_0 import ListEmailRuleShareEmailsResultItemHighlightsType0
  from ..models.list_email_rule_share_emails_result_item_presence_control_type_0 import ListEmailRuleShareEmailsResultItemPresenceControlType0
  from ..models.list_email_rule_share_emails_result_item_relay_type_0 import ListEmailRuleShareEmailsResultItemRelayType0
  from ..models.list_email_rule_share_emails_result_item_repeat_type_0 import ListEmailRuleShareEmailsResultItemRepeatType0
  from ..models.list_email_rule_share_emails_result_item_sender_member_type_0 import ListEmailRuleShareEmailsResultItemSenderMemberType0





T = TypeVar("T", bound="ListEmailRuleShareEmailsResultItem")



@_attrs_define
class ListEmailRuleShareEmailsResultItem:
    """ 
        Attributes:
            id (UUID):
            message_id (None | str):
            domain_id (None | UUID):
            org_id (UUID):
            status (str):
            sender (str):
            recipient (str):
            subject (None | str):
            domain (str):
            spam_score (float | None):
            created_at (str):
            received_at (str):
            raw_size_bytes (float | None):
            automated (bool):
            automated_reasons (list[str]):
            from_verified (bool):
            from_header_email (None | str):
            relay (ListEmailRuleShareEmailsResultItemRelayType0 | None):
            reply_count (int):
            last_replied_at (None | str):
            awaiting (ListEmailRuleShareEmailsResultItemAwaiting):
            interaction_hint (ListEmailRuleShareEmailsResultItemInteractionHint):
            interaction_kind (None | str):
            interaction_candidate (bool):
            shared_at (datetime.datetime | None): When the share's rule first matched this email. The email was shared then
                or shortly after. Null if that could not be read.
            delivery_report (ListEmailRuleShareEmailsResultItemDeliveryReportType0 | None | Unset):
            presence_control (ListEmailRuleShareEmailsResultItemPresenceControlType0 | None | Unset):
            sender_member (ListEmailRuleShareEmailsResultItemSenderMemberType0 | None | Unset):
            repeat (ListEmailRuleShareEmailsResultItemRepeatType0 | None | Unset):
            thread_id (None | Unset | UUID):
            webhook_status (None | str | Unset):
            webhook_attempt_count (float | Unset):
            from_header (None | str | Unset):
            from_name (None | str | Unset):
            from_email (str | Unset):
            to_email (str | Unset):
            from_known_address (bool | Unset):
            attachment_count (float | Unset):
            automation_headers (ListEmailRuleShareEmailsResultItemAutomationHeadersType0 | None | Unset):
            fyi (bool | Unset):
            muted (bool | Unset):
            snippet (None | str | Unset):
            parse_status (ListEmailRuleShareEmailsResultItemParseStatusType1 |
                ListEmailRuleShareEmailsResultItemParseStatusType2Type1 |
                ListEmailRuleShareEmailsResultItemParseStatusType3Type1 | None | Unset):
            in_reply_to (list[str] | None | Unset):
            references (list[str] | None | Unset):
            score (float | Unset):
            highlights (ListEmailRuleShareEmailsResultItemHighlightsType0 | None | Unset):
     """

    id: UUID
    message_id: None | str
    domain_id: None | UUID
    org_id: UUID
    status: str
    sender: str
    recipient: str
    subject: None | str
    domain: str
    spam_score: float | None
    created_at: str
    received_at: str
    raw_size_bytes: float | None
    automated: bool
    automated_reasons: list[str]
    from_verified: bool
    from_header_email: None | str
    relay: ListEmailRuleShareEmailsResultItemRelayType0 | None
    reply_count: int
    last_replied_at: None | str
    awaiting: ListEmailRuleShareEmailsResultItemAwaiting
    interaction_hint: ListEmailRuleShareEmailsResultItemInteractionHint
    interaction_kind: None | str
    interaction_candidate: bool
    shared_at: datetime.datetime | None
    delivery_report: ListEmailRuleShareEmailsResultItemDeliveryReportType0 | None | Unset = UNSET
    presence_control: ListEmailRuleShareEmailsResultItemPresenceControlType0 | None | Unset = UNSET
    sender_member: ListEmailRuleShareEmailsResultItemSenderMemberType0 | None | Unset = UNSET
    repeat: ListEmailRuleShareEmailsResultItemRepeatType0 | None | Unset = UNSET
    thread_id: None | Unset | UUID = UNSET
    webhook_status: None | str | Unset = UNSET
    webhook_attempt_count: float | Unset = UNSET
    from_header: None | str | Unset = UNSET
    from_name: None | str | Unset = UNSET
    from_email: str | Unset = UNSET
    to_email: str | Unset = UNSET
    from_known_address: bool | Unset = UNSET
    attachment_count: float | Unset = UNSET
    automation_headers: ListEmailRuleShareEmailsResultItemAutomationHeadersType0 | None | Unset = UNSET
    fyi: bool | Unset = UNSET
    muted: bool | Unset = UNSET
    snippet: None | str | Unset = UNSET
    parse_status: ListEmailRuleShareEmailsResultItemParseStatusType1 | ListEmailRuleShareEmailsResultItemParseStatusType2Type1 | ListEmailRuleShareEmailsResultItemParseStatusType3Type1 | None | Unset = UNSET
    in_reply_to: list[str] | None | Unset = UNSET
    references: list[str] | None | Unset = UNSET
    score: float | Unset = UNSET
    highlights: ListEmailRuleShareEmailsResultItemHighlightsType0 | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_email_rule_share_emails_result_item_automation_headers_type_0 import ListEmailRuleShareEmailsResultItemAutomationHeadersType0 # noqa: PLC0415
        from ..models.list_email_rule_share_emails_result_item_delivery_report_type_0 import ListEmailRuleShareEmailsResultItemDeliveryReportType0 # noqa: PLC0415
        from ..models.list_email_rule_share_emails_result_item_highlights_type_0 import ListEmailRuleShareEmailsResultItemHighlightsType0 # noqa: PLC0415
        from ..models.list_email_rule_share_emails_result_item_presence_control_type_0 import ListEmailRuleShareEmailsResultItemPresenceControlType0 # noqa: PLC0415
        from ..models.list_email_rule_share_emails_result_item_relay_type_0 import ListEmailRuleShareEmailsResultItemRelayType0 # noqa: PLC0415
        from ..models.list_email_rule_share_emails_result_item_repeat_type_0 import ListEmailRuleShareEmailsResultItemRepeatType0 # noqa: PLC0415
        from ..models.list_email_rule_share_emails_result_item_sender_member_type_0 import ListEmailRuleShareEmailsResultItemSenderMemberType0 # noqa: PLC0415
        id = str(self.id)

        message_id: None | str
        message_id = self.message_id

        domain_id: None | str
        if isinstance(self.domain_id, UUID):
            domain_id = str(self.domain_id)
        else:
            domain_id = self.domain_id

        org_id = str(self.org_id)

        status = self.status

        sender = self.sender

        recipient = self.recipient

        subject: None | str
        subject = self.subject

        domain = self.domain

        spam_score: float | None
        spam_score = self.spam_score

        created_at = self.created_at

        received_at = self.received_at

        raw_size_bytes: float | None
        raw_size_bytes = self.raw_size_bytes

        automated = self.automated

        automated_reasons = self.automated_reasons



        from_verified = self.from_verified

        from_header_email: None | str
        from_header_email = self.from_header_email

        relay: dict[str, Any] | None
        if isinstance(self.relay, ListEmailRuleShareEmailsResultItemRelayType0):
            relay = self.relay.to_dict()
        else:
            relay = self.relay

        reply_count = self.reply_count

        last_replied_at: None | str
        last_replied_at = self.last_replied_at

        awaiting = self.awaiting.value

        interaction_hint = self.interaction_hint.value

        interaction_kind: None | str
        interaction_kind = self.interaction_kind

        interaction_candidate = self.interaction_candidate

        shared_at: None | str
        if isinstance(self.shared_at, datetime.datetime):
            shared_at = self.shared_at.isoformat()
        else:
            shared_at = self.shared_at

        delivery_report: dict[str, Any] | None | Unset
        if isinstance(self.delivery_report, Unset):
            delivery_report = UNSET
        elif isinstance(self.delivery_report, ListEmailRuleShareEmailsResultItemDeliveryReportType0):
            delivery_report = self.delivery_report.to_dict()
        else:
            delivery_report = self.delivery_report

        presence_control: dict[str, Any] | None | Unset
        if isinstance(self.presence_control, Unset):
            presence_control = UNSET
        elif isinstance(self.presence_control, ListEmailRuleShareEmailsResultItemPresenceControlType0):
            presence_control = self.presence_control.to_dict()
        else:
            presence_control = self.presence_control

        sender_member: dict[str, Any] | None | Unset
        if isinstance(self.sender_member, Unset):
            sender_member = UNSET
        elif isinstance(self.sender_member, ListEmailRuleShareEmailsResultItemSenderMemberType0):
            sender_member = self.sender_member.to_dict()
        else:
            sender_member = self.sender_member

        repeat: dict[str, Any] | None | Unset
        if isinstance(self.repeat, Unset):
            repeat = UNSET
        elif isinstance(self.repeat, ListEmailRuleShareEmailsResultItemRepeatType0):
            repeat = self.repeat.to_dict()
        else:
            repeat = self.repeat

        thread_id: None | str | Unset
        if isinstance(self.thread_id, Unset):
            thread_id = UNSET
        elif isinstance(self.thread_id, UUID):
            thread_id = str(self.thread_id)
        else:
            thread_id = self.thread_id

        webhook_status: None | str | Unset
        if isinstance(self.webhook_status, Unset):
            webhook_status = UNSET
        else:
            webhook_status = self.webhook_status

        webhook_attempt_count = self.webhook_attempt_count

        from_header: None | str | Unset
        if isinstance(self.from_header, Unset):
            from_header = UNSET
        else:
            from_header = self.from_header

        from_name: None | str | Unset
        if isinstance(self.from_name, Unset):
            from_name = UNSET
        else:
            from_name = self.from_name

        from_email = self.from_email

        to_email = self.to_email

        from_known_address = self.from_known_address

        attachment_count = self.attachment_count

        automation_headers: dict[str, Any] | None | Unset
        if isinstance(self.automation_headers, Unset):
            automation_headers = UNSET
        elif isinstance(self.automation_headers, ListEmailRuleShareEmailsResultItemAutomationHeadersType0):
            automation_headers = self.automation_headers.to_dict()
        else:
            automation_headers = self.automation_headers

        fyi = self.fyi

        muted = self.muted

        snippet: None | str | Unset
        if isinstance(self.snippet, Unset):
            snippet = UNSET
        else:
            snippet = self.snippet

        parse_status: None | str | Unset
        if isinstance(self.parse_status, Unset):
            parse_status = UNSET
        elif isinstance(self.parse_status, ListEmailRuleShareEmailsResultItemParseStatusType1):
            parse_status = self.parse_status.value
        elif isinstance(self.parse_status, ListEmailRuleShareEmailsResultItemParseStatusType2Type1):
            parse_status = self.parse_status.value
        elif isinstance(self.parse_status, ListEmailRuleShareEmailsResultItemParseStatusType3Type1):
            parse_status = self.parse_status.value
        else:
            parse_status = self.parse_status

        in_reply_to: list[str] | None | Unset
        if isinstance(self.in_reply_to, Unset):
            in_reply_to = UNSET
        elif isinstance(self.in_reply_to, list):
            in_reply_to = self.in_reply_to


        else:
            in_reply_to = self.in_reply_to

        references: list[str] | None | Unset
        if isinstance(self.references, Unset):
            references = UNSET
        elif isinstance(self.references, list):
            references = self.references


        else:
            references = self.references

        score = self.score

        highlights: dict[str, Any] | None | Unset
        if isinstance(self.highlights, Unset):
            highlights = UNSET
        elif isinstance(self.highlights, ListEmailRuleShareEmailsResultItemHighlightsType0):
            highlights = self.highlights.to_dict()
        else:
            highlights = self.highlights


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "message_id": message_id,
            "domain_id": domain_id,
            "org_id": org_id,
            "status": status,
            "sender": sender,
            "recipient": recipient,
            "subject": subject,
            "domain": domain,
            "spam_score": spam_score,
            "created_at": created_at,
            "received_at": received_at,
            "raw_size_bytes": raw_size_bytes,
            "automated": automated,
            "automated_reasons": automated_reasons,
            "from_verified": from_verified,
            "from_header_email": from_header_email,
            "relay": relay,
            "reply_count": reply_count,
            "last_replied_at": last_replied_at,
            "awaiting": awaiting,
            "interaction_hint": interaction_hint,
            "interaction_kind": interaction_kind,
            "interaction_candidate": interaction_candidate,
            "shared_at": shared_at,
        })
        if delivery_report is not UNSET:
            field_dict["delivery_report"] = delivery_report
        if presence_control is not UNSET:
            field_dict["presence_control"] = presence_control
        if sender_member is not UNSET:
            field_dict["sender_member"] = sender_member
        if repeat is not UNSET:
            field_dict["repeat"] = repeat
        if thread_id is not UNSET:
            field_dict["thread_id"] = thread_id
        if webhook_status is not UNSET:
            field_dict["webhook_status"] = webhook_status
        if webhook_attempt_count is not UNSET:
            field_dict["webhook_attempt_count"] = webhook_attempt_count
        if from_header is not UNSET:
            field_dict["from_header"] = from_header
        if from_name is not UNSET:
            field_dict["from_name"] = from_name
        if from_email is not UNSET:
            field_dict["from_email"] = from_email
        if to_email is not UNSET:
            field_dict["to_email"] = to_email
        if from_known_address is not UNSET:
            field_dict["from_known_address"] = from_known_address
        if attachment_count is not UNSET:
            field_dict["attachment_count"] = attachment_count
        if automation_headers is not UNSET:
            field_dict["automation_headers"] = automation_headers
        if fyi is not UNSET:
            field_dict["fyi"] = fyi
        if muted is not UNSET:
            field_dict["muted"] = muted
        if snippet is not UNSET:
            field_dict["snippet"] = snippet
        if parse_status is not UNSET:
            field_dict["parse_status"] = parse_status
        if in_reply_to is not UNSET:
            field_dict["in_reply_to"] = in_reply_to
        if references is not UNSET:
            field_dict["references"] = references
        if score is not UNSET:
            field_dict["score"] = score
        if highlights is not UNSET:
            field_dict["highlights"] = highlights

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_email_rule_share_emails_result_item_automation_headers_type_0 import ListEmailRuleShareEmailsResultItemAutomationHeadersType0 # noqa: PLC0415
        from ..models.list_email_rule_share_emails_result_item_delivery_report_type_0 import ListEmailRuleShareEmailsResultItemDeliveryReportType0 # noqa: PLC0415
        from ..models.list_email_rule_share_emails_result_item_highlights_type_0 import ListEmailRuleShareEmailsResultItemHighlightsType0 # noqa: PLC0415
        from ..models.list_email_rule_share_emails_result_item_presence_control_type_0 import ListEmailRuleShareEmailsResultItemPresenceControlType0 # noqa: PLC0415
        from ..models.list_email_rule_share_emails_result_item_relay_type_0 import ListEmailRuleShareEmailsResultItemRelayType0 # noqa: PLC0415
        from ..models.list_email_rule_share_emails_result_item_repeat_type_0 import ListEmailRuleShareEmailsResultItemRepeatType0 # noqa: PLC0415
        from ..models.list_email_rule_share_emails_result_item_sender_member_type_0 import ListEmailRuleShareEmailsResultItemSenderMemberType0 # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        def _parse_message_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        message_id = _parse_message_id(d.pop("message_id"))


        def _parse_domain_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                domain_id_type_0 = UUID(data)



                return domain_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        domain_id = _parse_domain_id(d.pop("domain_id"))


        org_id = UUID(d.pop("org_id"))




        status = d.pop("status")

        sender = d.pop("sender")

        recipient = d.pop("recipient")

        def _parse_subject(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        subject = _parse_subject(d.pop("subject"))


        domain = d.pop("domain")

        def _parse_spam_score(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        spam_score = _parse_spam_score(d.pop("spam_score"))


        created_at = d.pop("created_at")

        received_at = d.pop("received_at")

        def _parse_raw_size_bytes(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        raw_size_bytes = _parse_raw_size_bytes(d.pop("raw_size_bytes"))


        automated = d.pop("automated")

        automated_reasons = cast(list[str], d.pop("automated_reasons"))


        from_verified = d.pop("from_verified")

        def _parse_from_header_email(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        from_header_email = _parse_from_header_email(d.pop("from_header_email"))


        def _parse_relay(data: object) -> ListEmailRuleShareEmailsResultItemRelayType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                relay_type_0 = ListEmailRuleShareEmailsResultItemRelayType0.from_dict(data)



                return relay_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListEmailRuleShareEmailsResultItemRelayType0 | None, data)

        relay = _parse_relay(d.pop("relay"))


        reply_count = d.pop("reply_count")

        def _parse_last_replied_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        last_replied_at = _parse_last_replied_at(d.pop("last_replied_at"))


        awaiting = ListEmailRuleShareEmailsResultItemAwaiting(d.pop("awaiting"))




        interaction_hint = ListEmailRuleShareEmailsResultItemInteractionHint(d.pop("interaction_hint"))




        def _parse_interaction_kind(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        interaction_kind = _parse_interaction_kind(d.pop("interaction_kind"))


        interaction_candidate = d.pop("interaction_candidate")

        def _parse_shared_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                shared_at_type_0 = datetime.datetime.fromisoformat(data)



                return shared_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        shared_at = _parse_shared_at(d.pop("shared_at"))


        def _parse_delivery_report(data: object) -> ListEmailRuleShareEmailsResultItemDeliveryReportType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                delivery_report_type_0 = ListEmailRuleShareEmailsResultItemDeliveryReportType0.from_dict(data)



                return delivery_report_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListEmailRuleShareEmailsResultItemDeliveryReportType0 | None | Unset, data)

        delivery_report = _parse_delivery_report(d.pop("delivery_report", UNSET))


        def _parse_presence_control(data: object) -> ListEmailRuleShareEmailsResultItemPresenceControlType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                presence_control_type_0 = ListEmailRuleShareEmailsResultItemPresenceControlType0.from_dict(data)



                return presence_control_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListEmailRuleShareEmailsResultItemPresenceControlType0 | None | Unset, data)

        presence_control = _parse_presence_control(d.pop("presence_control", UNSET))


        def _parse_sender_member(data: object) -> ListEmailRuleShareEmailsResultItemSenderMemberType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                sender_member_type_0 = ListEmailRuleShareEmailsResultItemSenderMemberType0.from_dict(data)



                return sender_member_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListEmailRuleShareEmailsResultItemSenderMemberType0 | None | Unset, data)

        sender_member = _parse_sender_member(d.pop("sender_member", UNSET))


        def _parse_repeat(data: object) -> ListEmailRuleShareEmailsResultItemRepeatType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                repeat_type_0 = ListEmailRuleShareEmailsResultItemRepeatType0.from_dict(data)



                return repeat_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListEmailRuleShareEmailsResultItemRepeatType0 | None | Unset, data)

        repeat = _parse_repeat(d.pop("repeat", UNSET))


        def _parse_thread_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                thread_id_type_0 = UUID(data)



                return thread_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        thread_id = _parse_thread_id(d.pop("thread_id", UNSET))


        def _parse_webhook_status(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        webhook_status = _parse_webhook_status(d.pop("webhook_status", UNSET))


        webhook_attempt_count = d.pop("webhook_attempt_count", UNSET)

        def _parse_from_header(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        from_header = _parse_from_header(d.pop("from_header", UNSET))


        def _parse_from_name(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        from_name = _parse_from_name(d.pop("from_name", UNSET))


        from_email = d.pop("from_email", UNSET)

        to_email = d.pop("to_email", UNSET)

        from_known_address = d.pop("from_known_address", UNSET)

        attachment_count = d.pop("attachment_count", UNSET)

        def _parse_automation_headers(data: object) -> ListEmailRuleShareEmailsResultItemAutomationHeadersType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                automation_headers_type_0 = ListEmailRuleShareEmailsResultItemAutomationHeadersType0.from_dict(data)



                return automation_headers_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListEmailRuleShareEmailsResultItemAutomationHeadersType0 | None | Unset, data)

        automation_headers = _parse_automation_headers(d.pop("automation_headers", UNSET))


        fyi = d.pop("fyi", UNSET)

        muted = d.pop("muted", UNSET)

        def _parse_snippet(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        snippet = _parse_snippet(d.pop("snippet", UNSET))


        def _parse_parse_status(data: object) -> ListEmailRuleShareEmailsResultItemParseStatusType1 | ListEmailRuleShareEmailsResultItemParseStatusType2Type1 | ListEmailRuleShareEmailsResultItemParseStatusType3Type1 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                parse_status_type_1 = ListEmailRuleShareEmailsResultItemParseStatusType1(data)



                return parse_status_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                parse_status_type_2_type_1 = ListEmailRuleShareEmailsResultItemParseStatusType2Type1(data)



                return parse_status_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                parse_status_type_3_type_1 = ListEmailRuleShareEmailsResultItemParseStatusType3Type1(data)



                return parse_status_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListEmailRuleShareEmailsResultItemParseStatusType1 | ListEmailRuleShareEmailsResultItemParseStatusType2Type1 | ListEmailRuleShareEmailsResultItemParseStatusType3Type1 | None | Unset, data)

        parse_status = _parse_parse_status(d.pop("parse_status", UNSET))


        def _parse_in_reply_to(data: object) -> list[str] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                in_reply_to_type_0 = cast(list[str], data)

                return in_reply_to_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None | Unset, data)

        in_reply_to = _parse_in_reply_to(d.pop("in_reply_to", UNSET))


        def _parse_references(data: object) -> list[str] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                references_type_0 = cast(list[str], data)

                return references_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None | Unset, data)

        references = _parse_references(d.pop("references", UNSET))


        score = d.pop("score", UNSET)

        def _parse_highlights(data: object) -> ListEmailRuleShareEmailsResultItemHighlightsType0 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                highlights_type_0 = ListEmailRuleShareEmailsResultItemHighlightsType0.from_dict(data)



                return highlights_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ListEmailRuleShareEmailsResultItemHighlightsType0 | None | Unset, data)

        highlights = _parse_highlights(d.pop("highlights", UNSET))


        list_email_rule_share_emails_result_item = cls(
            id=id,
            message_id=message_id,
            domain_id=domain_id,
            org_id=org_id,
            status=status,
            sender=sender,
            recipient=recipient,
            subject=subject,
            domain=domain,
            spam_score=spam_score,
            created_at=created_at,
            received_at=received_at,
            raw_size_bytes=raw_size_bytes,
            automated=automated,
            automated_reasons=automated_reasons,
            from_verified=from_verified,
            from_header_email=from_header_email,
            relay=relay,
            reply_count=reply_count,
            last_replied_at=last_replied_at,
            awaiting=awaiting,
            interaction_hint=interaction_hint,
            interaction_kind=interaction_kind,
            interaction_candidate=interaction_candidate,
            shared_at=shared_at,
            delivery_report=delivery_report,
            presence_control=presence_control,
            sender_member=sender_member,
            repeat=repeat,
            thread_id=thread_id,
            webhook_status=webhook_status,
            webhook_attempt_count=webhook_attempt_count,
            from_header=from_header,
            from_name=from_name,
            from_email=from_email,
            to_email=to_email,
            from_known_address=from_known_address,
            attachment_count=attachment_count,
            automation_headers=automation_headers,
            fyi=fyi,
            muted=muted,
            snippet=snippet,
            parse_status=parse_status,
            in_reply_to=in_reply_to,
            references=references,
            score=score,
            highlights=highlights,
        )


        list_email_rule_share_emails_result_item.additional_properties = d
        return list_email_rule_share_emails_result_item

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
