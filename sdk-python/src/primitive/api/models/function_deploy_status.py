from enum import StrEnum

class FunctionDeployStatus(StrEnum):
    DEPLOYED = "deployed"
    FAILED = "failed"
    PENDING = "pending"

    def __str__(self) -> str:
        return str(self.value)
