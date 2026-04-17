from enum import Enum

class ErrorResponseErrorCode(str, Enum):
    CONFLICT = "conflict"
    FORBIDDEN = "forbidden"
    INTERNAL_ERROR = "internal_error"
    MX_CONFLICT = "mx_conflict"
    NOT_FOUND = "not_found"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    UNAUTHORIZED = "unauthorized"
    VALIDATION_ERROR = "validation_error"

    def __str__(self) -> str:
        return str(self.value)
