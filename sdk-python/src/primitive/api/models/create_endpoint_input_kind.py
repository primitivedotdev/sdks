from enum import Enum

class CreateEndpointInputKind(str, Enum):
    FUNCTION = "function"
    HTTP = "http"

    def __str__(self) -> str:
        return str(self.value)
