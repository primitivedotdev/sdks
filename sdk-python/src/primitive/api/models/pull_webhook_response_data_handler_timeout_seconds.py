from enum import IntEnum

class PullWebhookResponseDataHandlerTimeoutSeconds(IntEnum):
    VALUE_30 = 30

    def __str__(self) -> str:
        return str(self.value)
