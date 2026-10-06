from enum import StrEnum

class FunctionTestRunState(StrEnum):
    COMPLETED = "completed"
    FAILED = "failed"
    SEND_FAILED = "send_failed"
    WAITING_FOR_FUNCTION = "waiting_for_function"
    WAITING_FOR_INBOUND = "waiting_for_inbound"
    WAITING_FOR_SEND = "waiting_for_send"

    def __str__(self) -> str:
        return str(self.value)
