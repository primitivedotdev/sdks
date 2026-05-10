from enum import Enum

class FunctionDeployStatus(str, Enum):
    DEPLOYED = "deployed"
    FAILED = "failed"
    PENDING = "pending"

    def __str__(self) -> str:
        return str(self.value)
