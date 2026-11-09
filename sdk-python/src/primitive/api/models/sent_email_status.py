from enum import StrEnum

class SentEmailStatus(StrEnum):
    AGENT_FAILED = "agent_failed"
    BOUNCED = "bounced"
    CANCELED = "canceled"
    DEFERRED = "deferred"
    DELIVERED = "delivered"
    GATE_DENIED = "gate_denied"
    QUEUED = "queued"
    SCHEDULED = "scheduled"
    SUBMITTED_TO_AGENT = "submitted_to_agent"
    UNKNOWN = "unknown"
    WAIT_TIMEOUT = "wait_timeout"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "SentEmailStatus | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
