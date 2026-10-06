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
