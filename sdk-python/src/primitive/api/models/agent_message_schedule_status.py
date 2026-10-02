from enum import Enum

class AgentMessageScheduleStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    STOPPED_BY_AGENT = "stopped_by_agent"
    STOPPED_BY_OWNER = "stopped_by_owner"

    def __str__(self) -> str:
        return str(self.value)
