from enum import Enum

class SentEmailStatus(str, Enum):
    AGENT_FAILED = "agent_failed"
    BOUNCED = "bounced"
    DEFERRED = "deferred"
    DELIVERED = "delivered"
    GATE_DENIED = "gate_denied"
    QUEUED = "queued"
    SUBMITTED_TO_AGENT = "submitted_to_agent"
    UNKNOWN = "unknown"
    WAIT_TIMEOUT = "wait_timeout"

    def __str__(self) -> str:
        return str(self.value)
