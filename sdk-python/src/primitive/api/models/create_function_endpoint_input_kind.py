from enum import Enum

class CreateFunctionEndpointInputKind(str, Enum):
    FUNCTION = "function"

    def __str__(self) -> str:
        return str(self.value)
