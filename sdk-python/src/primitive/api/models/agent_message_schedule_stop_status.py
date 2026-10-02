from enum import Enum

class AgentMessageScheduleStopStatus(str, Enum):
    STOPPED_BY_AGENT = "stopped_by_agent"

    def __str__(self) -> str:
        return str(self.value)
