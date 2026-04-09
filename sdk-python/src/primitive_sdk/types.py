from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import NotRequired, TypeAlias, TypedDict

from primitive_sdk.models_generated import (
    AuthConfidence as GeneratedAuthConfidence,
)
from primitive_sdk.models_generated import (
    DkimResult as GeneratedDkimResult,
)
from primitive_sdk.models_generated import (
    DkimSignature as GeneratedDkimSignature,
)
from primitive_sdk.models_generated import (
    DmarcPolicy as GeneratedDmarcPolicy,
)
from primitive_sdk.models_generated import (
    DmarcResult as GeneratedDmarcResult,
)
from primitive_sdk.models_generated import (
    EmailAddress as GeneratedEmailAddress,
)
from primitive_sdk.models_generated import (
    EmailAnalysis as GeneratedEmailAnalysis,
)
from primitive_sdk.models_generated import (
    EmailAuth as GeneratedEmailAuth,
)
from primitive_sdk.models_generated import (
    EmailReceivedEvent as GeneratedEmailReceivedEvent,
)
from primitive_sdk.models_generated import (
    ForwardAnalysis as GeneratedForwardAnalysis,
)
from primitive_sdk.models_generated import (
    ForwardOriginalSender as GeneratedForwardOriginalSender,
)
from primitive_sdk.models_generated import (
    ForwardResult as GeneratedForwardResult,
)
from primitive_sdk.models_generated import (
    ForwardResultAttachmentAnalyzed as GeneratedForwardResultAttachmentAnalyzed,
)
from primitive_sdk.models_generated import (
    ForwardResultAttachmentSkipped as GeneratedForwardResultAttachmentSkipped,
)
from primitive_sdk.models_generated import (
    ForwardResultInline as GeneratedForwardResultInline,
)
from primitive_sdk.models_generated import (
    ForwardVerdict as GeneratedForwardVerdict,
)
from primitive_sdk.models_generated import (
    ForwardVerification as GeneratedForwardVerification,
)
from primitive_sdk.models_generated import (
    ParsedData as GeneratedParsedData,
)
from primitive_sdk.models_generated import (
    ParsedDataComplete as GeneratedParsedDataComplete,
)
from primitive_sdk.models_generated import (
    ParsedDataFailed as GeneratedParsedDataFailed,
)
from primitive_sdk.models_generated import (
    ParsedError as GeneratedParsedError,
)
from primitive_sdk.models_generated import (
    RawContent as GeneratedRawContent,
)
from primitive_sdk.models_generated import (
    RawContentDownloadOnly as GeneratedRawContentDownloadOnly,
)
from primitive_sdk.models_generated import (
    RawContentInline as GeneratedRawContentInline,
)
from primitive_sdk.models_generated import (
    SpfResult as GeneratedSpfResult,
)
from primitive_sdk.models_generated import (
    WebhookAttachment as GeneratedWebhookAttachment,
)

EmailReceivedEvent = GeneratedEmailReceivedEvent
RawContent = GeneratedRawContent
RawContentInline = GeneratedRawContentInline
RawContentDownloadOnly = GeneratedRawContentDownloadOnly
ParsedData = GeneratedParsedData
ParsedDataComplete = GeneratedParsedDataComplete
ParsedDataFailed = GeneratedParsedDataFailed
ParsedError = GeneratedParsedError
EmailAddress = GeneratedEmailAddress
WebhookAttachment = GeneratedWebhookAttachment
EmailAnalysis = GeneratedEmailAnalysis
ForwardAnalysis = GeneratedForwardAnalysis
ForwardResult = GeneratedForwardResult
ForwardResultInline = GeneratedForwardResultInline
ForwardResultAttachmentAnalyzed = GeneratedForwardResultAttachmentAnalyzed
ForwardResultAttachmentSkipped = GeneratedForwardResultAttachmentSkipped
ForwardOriginalSender = GeneratedForwardOriginalSender
ForwardVerification = GeneratedForwardVerification
EmailAuth = GeneratedEmailAuth
DkimSignature = GeneratedDkimSignature


class EventType(StrEnum):
    EMAIL_RECEIVED = "email.received"


class ParsedStatus(StrEnum):
    COMPLETE = "complete"
    FAILED = "failed"


class ForwardVerdict(StrEnum):
    LEGIT = GeneratedForwardVerdict.legit
    UNKNOWN = GeneratedForwardVerdict.unknown


class SpfResult(StrEnum):
    PASS = GeneratedSpfResult.pass_
    FAIL = GeneratedSpfResult.fail
    SOFTFAIL = GeneratedSpfResult.softfail
    NEUTRAL = GeneratedSpfResult.neutral
    NONE = GeneratedSpfResult.none
    TEMPERROR = GeneratedSpfResult.temperror
    PERMERROR = GeneratedSpfResult.permerror


class DmarcResult(StrEnum):
    PASS = GeneratedDmarcResult.pass_
    FAIL = GeneratedDmarcResult.fail
    NONE = GeneratedDmarcResult.none
    TEMPERROR = GeneratedDmarcResult.temperror
    PERMERROR = GeneratedDmarcResult.permerror


class DmarcPolicy(StrEnum):
    REJECT = str(GeneratedDmarcPolicy.reject.value)
    QUARANTINE = str(GeneratedDmarcPolicy.quarantine.value)
    NONE = str(GeneratedDmarcPolicy.none.value)


class DkimResult(StrEnum):
    PASS = GeneratedDkimResult.pass_
    FAIL = GeneratedDkimResult.fail
    TEMPERROR = GeneratedDkimResult.temperror
    PERMERROR = GeneratedDkimResult.permerror


class AuthConfidence(StrEnum):
    HIGH = GeneratedAuthConfidence.high
    MEDIUM = GeneratedAuthConfidence.medium
    LOW = GeneratedAuthConfidence.low


class AuthVerdict(StrEnum):
    LEGIT = "legit"
    SUSPICIOUS = "suspicious"
    UNKNOWN = "unknown"


@dataclass(slots=True)
class ValidateEmailAuthResult:
    verdict: AuthVerdict
    confidence: AuthConfidence
    reasons: list[str]


class UnknownEvent(TypedDict):
    event: str
    id: NotRequired[str]
    version: NotRequired[str]


KnownWebhookEvent: TypeAlias = EmailReceivedEvent
WebhookEvent: TypeAlias = KnownWebhookEvent | UnknownEvent
