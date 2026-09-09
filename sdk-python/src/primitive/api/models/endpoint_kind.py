from enum import Enum

class EndpointKind(str, Enum):
    FUNCTION = "function"
    HTTP = "http"
    PULL = "pull"

    def __str__(self) -> str:
        return str(self.value)
