from enum import StrEnum

class ChangeKind(StrEnum):
    ACCESS_CHANGED = "access.changed"
    AGENT_CHANGED = "agent.changed"
    EMAIL_DELETED = "email.deleted"
    EMAIL_UPDATED = "email.updated"
    EMAIL_VISIBLE = "email.visible"
    SENT_EMAIL_CREATED = "sent_email.created"
    SENT_EMAIL_DELETED = "sent_email.deleted"
    SENT_EMAIL_UPDATED = "sent_email.updated"
    THREAD_MUTE_CHANGED = "thread.mute_changed"
    THREAD_READ_STATE_CHANGED = "thread.read_state_changed"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "ChangeKind | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
