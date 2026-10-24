from enum import StrEnum

class KeyGrantSpecMatrixAdditionalProperty(StrEnum):
    NONE = "none"
    READ = "read"
    WRITE = "write"

    def __str__(self) -> str:
        return str(self.value)
