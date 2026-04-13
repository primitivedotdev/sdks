from __future__ import annotations

import sys
from dataclasses import dataclass
from typing import Literal, TypeAlias, TypedDict

from ._compat import StrEnum

if sys.version_info >= (3, 11):
    from typing import NotRequired
else:
    from typing_extensions import NotRequired

from .models_generated import (
    AuthConfidence as GeneratedAuthConfidence,
)
from .models_generated import (
    Content as GeneratedContent,
)
from .models_generated import (
    Delivery as GeneratedDelivery,
)
from .models_generated import (
    DkimResult as GeneratedDkimResult,
)
from .models_generated import (
    DkimSignature as GeneratedDkimSignature,
)
from .models_generated import (
    DmarcPolicy as GeneratedDmarcPolicy,
)
from .models_generated import (
    DmarcResult as GeneratedDmarcResult,
)
from .models_generated import (
    Download as GeneratedDownload,
)
from .models_generated import (
    Email as GeneratedEmail,
)
from .models_generated import (
    EmailAddress as GeneratedEmailAddress,
)
from .models_generated import (
    EmailAnalysis as GeneratedEmailAnalysis,
)
from .models_generated import (
    EmailAuth as GeneratedEmailAuth,
)
from .models_generated import (
    EmailReceivedEvent as GeneratedEmailReceivedEvent,
)
from .models_generated import (
    ForwardAnalysis as GeneratedForwardAnalysis,
)
from .models_generated import (
    ForwardOriginalSender as GeneratedForwardOriginalSender,
)
from .models_generated import (
    ForwardResult as GeneratedForwardResult,
)
from .models_generated import (
    ForwardResultAttachmentAnalyzed as GeneratedForwardResultAttachmentAnalyzed,
)
from .models_generated import (
    ForwardResultAttachmentSkipped as GeneratedForwardResultAttachmentSkipped,
)
from .models_generated import (
    ForwardResultInline as GeneratedForwardResultInline,
)
from .models_generated import (
    ForwardVerdict as GeneratedForwardVerdict,
)
from .models_generated import (
    ForwardVerification as GeneratedForwardVerification,
)
from .models_generated import (
    Headers as GeneratedHeaders,
)
from .models_generated import (
    ParsedData as GeneratedParsedData,
)
from .models_generated import (
    ParsedDataComplete as GeneratedParsedDataComplete,
)
from .models_generated import (
    ParsedDataFailed as GeneratedParsedDataFailed,
)
from .models_generated import (
    ParsedError as GeneratedParsedError,
)
from .models_generated import (
    RawContent as GeneratedRawContent,
)
from .models_generated import (
    RawContentDownloadOnly as GeneratedRawContentDownloadOnly,
)
from .models_generated import (
    RawContentInline as GeneratedRawContentInline,
)
from .models_generated import (
    Smtp as GeneratedSmtp,
)
from .models_generated import (
    Spamassassin as GeneratedSpamassassin,
)
from .models_generated import (
    SpfResult as GeneratedSpfResult,
)
from .models_generated import (
    WebhookAttachment as GeneratedWebhookAttachment,
)
from .models_generated import (
    WebhookVersion as GeneratedWebhookVersion,
)


def _add_enum_aliases(enum_cls, aliases: dict[str, object]):
    for name, member in aliases.items():
        setattr(enum_cls, name, member)
    return enum_cls


EmailReceivedEvent = GeneratedEmailReceivedEvent
Delivery = GeneratedDelivery
Smtp = GeneratedSmtp
Headers = GeneratedHeaders
RawContent = GeneratedRawContent
RawContentInline = GeneratedRawContentInline
RawContentDownloadOnly = GeneratedRawContentDownloadOnly
Download = GeneratedDownload
ParsedData = GeneratedParsedData
ParsedDataComplete = GeneratedParsedDataComplete
ParsedDataFailed = GeneratedParsedDataFailed
ParsedError = GeneratedParsedError
Content = GeneratedContent
Email = GeneratedEmail
EmailAddress = GeneratedEmailAddress
WebhookAttachment = GeneratedWebhookAttachment
WebhookVersion = GeneratedWebhookVersion
EmailAnalysis = GeneratedEmailAnalysis
Spamassassin = GeneratedSpamassassin
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


ForwardVerdict = _add_enum_aliases(
    GeneratedForwardVerdict,
    {
        "LEGIT": GeneratedForwardVerdict.legit,
        "UNKNOWN": GeneratedForwardVerdict.unknown,
    },
)


SpfResult = _add_enum_aliases(
    GeneratedSpfResult,
    {
        "PASS": GeneratedSpfResult.pass_,
        "FAIL": GeneratedSpfResult.fail,
        "SOFTFAIL": GeneratedSpfResult.softfail,
        "NEUTRAL": GeneratedSpfResult.neutral,
        "NONE": GeneratedSpfResult.none,
        "TEMPERROR": GeneratedSpfResult.temperror,
        "PERMERROR": GeneratedSpfResult.permerror,
    },
)


DmarcResult = _add_enum_aliases(
    GeneratedDmarcResult,
    {
        "PASS": GeneratedDmarcResult.pass_,
        "FAIL": GeneratedDmarcResult.fail,
        "NONE": GeneratedDmarcResult.none,
        "TEMPERROR": GeneratedDmarcResult.temperror,
        "PERMERROR": GeneratedDmarcResult.permerror,
    },
)


DmarcPolicy = _add_enum_aliases(
    GeneratedDmarcPolicy,
    {
        "REJECT": GeneratedDmarcPolicy.reject,
        "QUARANTINE": GeneratedDmarcPolicy.quarantine,
        "NONE": GeneratedDmarcPolicy.none,
        "NULL": GeneratedDmarcPolicy.none_type_none,
    },
)


DkimResult = _add_enum_aliases(
    GeneratedDkimResult,
    {
        "PASS": GeneratedDkimResult.pass_,
        "FAIL": GeneratedDkimResult.fail,
        "TEMPERROR": GeneratedDkimResult.temperror,
        "PERMERROR": GeneratedDkimResult.permerror,
    },
)


AuthConfidence = _add_enum_aliases(
    GeneratedAuthConfidence,
    {
        "HIGH": GeneratedAuthConfidence.high,
        "MEDIUM": GeneratedAuthConfidence.medium,
        "LOW": GeneratedAuthConfidence.low,
    },
)


class AuthVerdict(StrEnum):
    LEGIT = "legit"
    SUSPICIOUS = "suspicious"
    UNKNOWN = "unknown"


@dataclass(slots=True)
class ValidateEmailAuthResult:
    verdict: AuthVerdict
    confidence: Literal["high", "medium", "low"]
    reasons: list[str]


class UnknownEvent(TypedDict):
    event: str
    id: NotRequired[str]
    version: NotRequired[str]


KnownWebhookEvent: TypeAlias = GeneratedEmailReceivedEvent
WebhookEvent: TypeAlias = KnownWebhookEvent | UnknownEvent
