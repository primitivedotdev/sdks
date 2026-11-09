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

    @classmethod
    def _missing_(cls, value: object) -> "FunctionTestRunState | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
