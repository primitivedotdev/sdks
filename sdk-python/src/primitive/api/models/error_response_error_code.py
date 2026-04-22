from enum import Enum

class ErrorResponseErrorCode(str, Enum):
    BAD_GATEWAY = "bad_gateway"
    CONFLICT = "conflict"
    FORBIDDEN = "forbidden"
    GATEWAY_TIMEOUT = "gateway_timeout"
    INTERNAL_ERROR = "internal_error"
    MX_CONFLICT = "mx_conflict"
    NOT_FOUND = "not_found"
    PAYLOAD_TOO_LARGE = "payload_too_large"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    UNAUTHORIZED = "unauthorized"
    VALIDATION_ERROR = "validation_error"

    def __str__(self) -> str:
        return str(self.value)
