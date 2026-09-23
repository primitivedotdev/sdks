from enum import Enum

class EndpointReceiverCapabilitiesCompletionModesItem(str, Enum):
    EXEC = "exec"
    HTTP = "http"
    SDK = "sdk"
    STDOUT = "stdout"

    def __str__(self) -> str:
        return str(self.value)
