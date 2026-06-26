from enum import Enum

class CreateHttpEndpointInputKind(str, Enum):
    HTTP = "http"

    def __str__(self) -> str:
        return str(self.value)
