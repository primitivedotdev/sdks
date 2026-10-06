from enum import StrEnum

class AgentAccountUpgradeHintPlan(StrEnum):
    DEVELOPER = "developer"

    def __str__(self) -> str:
        return str(self.value)
