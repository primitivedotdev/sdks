from enum import StrEnum

class EndpointReceiverCapabilitiesCompletionModesItem(StrEnum):
    EXEC = "exec"
    HTTP = "http"
    SDK = "sdk"
    STDOUT = "stdout"

    def __str__(self) -> str:
        return str(self.value)
