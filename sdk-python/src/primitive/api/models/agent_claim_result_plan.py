from enum import Enum

class AgentClaimResultPlan(str, Enum):
    DEVELOPER = "developer"

    def __str__(self) -> str:
        return str(self.value)
