from enum import Enum

class ErrorResponseErrorCode(str, Enum):
    CANNOT_SEND_FROM_DOMAIN = "cannot_send_from_domain"
    CONFLICT = "conflict"
    FORBIDDEN = "forbidden"
    INBOUND_NOT_REPLIABLE = "inbound_not_repliable"
    INTERNAL_ERROR = "internal_error"
    MX_CONFLICT = "mx_conflict"
    NOT_FOUND = "not_found"
    OUTBOUND_CAPACITY_EXHAUSTED = "outbound_capacity_exhausted"
    OUTBOUND_DISABLED = "outbound_disabled"
    OUTBOUND_KEY_INVALID = "outbound_key_invalid"
    OUTBOUND_KEY_MISSING = "outbound_key_missing"
    OUTBOUND_RELAY_FAILED = "outbound_relay_failed"
    OUTBOUND_RESPONSE_MALFORMED = "outbound_response_malformed"
    OUTBOUND_UNREACHABLE = "outbound_unreachable"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    RECIPIENT_NOT_ALLOWED = "recipient_not_allowed"
    UNAUTHORIZED = "unauthorized"
    VALIDATION_ERROR = "validation_error"

    def __str__(self) -> str:
        return str(self.value)
