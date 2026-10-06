from enum import StrEnum

class CreateEndpointInputKind(StrEnum):
    FUNCTION = "function"
    HTTP = "http"
    PULL = "pull"

    def __str__(self) -> str:
        return str(self.value)
