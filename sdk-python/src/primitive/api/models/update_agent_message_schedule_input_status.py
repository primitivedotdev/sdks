from enum import Enum

class UpdateAgentMessageScheduleInputStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    STOPPED_BY_OWNER = "stopped_by_owner"

    def __str__(self) -> str:
        return str(self.value)
