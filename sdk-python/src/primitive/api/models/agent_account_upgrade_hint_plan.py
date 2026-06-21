from enum import Enum

class AgentAccountUpgradeHintPlan(str, Enum):
    DEVELOPER = "developer"

    def __str__(self) -> str:
        return str(self.value)
