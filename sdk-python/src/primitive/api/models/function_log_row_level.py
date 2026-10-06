from enum import StrEnum

class FunctionLogRowLevel(StrEnum):
    DEBUG = "debug"
    ERROR = "error"
    INFO = "info"
    LOG = "log"
    WARN = "warn"

    def __str__(self) -> str:
        return str(self.value)
