from enum import Enum

class ErrorResponseErrorCode(str, Enum):
    FORBIDDEN = "forbidden"
    INTERNAL_ERROR = "internal_error"
    NOT_FOUND = "not_found"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    UNAUTHORIZED = "unauthorized"
    VALIDATION_ERROR = "validation_error"

    def __str__(self) -> str:
        return str(self.value)
