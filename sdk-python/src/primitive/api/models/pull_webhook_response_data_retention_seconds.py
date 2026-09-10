from enum import IntEnum

class PullWebhookResponseDataRetentionSeconds(IntEnum):
    VALUE_86400 = 86400

    def __str__(self) -> str:
        return str(self.value)
