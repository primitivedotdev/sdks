from enum import StrEnum

class AgentAccountResultPlan(StrEnum):
    AGENT = "agent"

    def __str__(self) -> str:
        return str(self.value)
