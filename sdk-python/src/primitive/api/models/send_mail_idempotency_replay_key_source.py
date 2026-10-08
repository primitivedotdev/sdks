from enum import StrEnum

class SendMailIdempotencyReplayKeySource(StrEnum):
    AUTO_CONTENT = "auto_content"
    EXPLICIT = "explicit"
    FUNCTION_TRIGGER = "function_trigger"

    def __str__(self) -> str:
        return str(self.value)
