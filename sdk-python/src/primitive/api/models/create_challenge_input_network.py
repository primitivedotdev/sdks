from enum import Enum

class CreateChallengeInputNetwork(str, Enum):
    BASE = "base"
    BASE_SEPOLIA = "base-sepolia"

    def __str__(self) -> str:
        return str(self.value)
