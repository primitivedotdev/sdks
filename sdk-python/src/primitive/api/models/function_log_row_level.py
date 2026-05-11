from enum import Enum

class FunctionLogRowLevel(str, Enum):
    DEBUG = "debug"
    ERROR = "error"
    INFO = "info"
    LOG = "log"
    WARN = "warn"

    def __str__(self) -> str:
        return str(self.value)
