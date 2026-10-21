from enum import StrEnum

class ChangeReasonType1(StrEnum):
    AGENT_CONNECTION = "agent_connection"
    MEMBERSHIP = "membership"

    def __str__(self) -> str:
        return str(self.value)
