from enum import StrEnum

class AgentClaimResultPlan(StrEnum):
    DEVELOPER = "developer"

    def __str__(self) -> str:
        return str(self.value)
