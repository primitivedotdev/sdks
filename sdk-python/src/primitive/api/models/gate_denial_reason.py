from enum import Enum

class GateDenialReason(str, Enum):
    DOMAIN_NOT_CONFIRMED = "domain_not_confirmed"
    RECIPIENT_NOT_KNOWN = "recipient_not_known"
    RECIPIENT_UNAUTHENTICATED = "recipient_unauthenticated"

    def __str__(self) -> str:
        return str(self.value)
