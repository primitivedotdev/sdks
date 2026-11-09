from enum import StrEnum

class InboxStatusNextActionKind(StrEnum):
    ADD_DOMAIN = "add_domain"
    CONFIGURE_PROCESSING = "configure_processing"
    FIX_FAILED_FUNCTIONS = "fix_failed_functions"
    SEND_TEST_EMAIL = "send_test_email"
    VERIFY_DOMAIN = "verify_domain"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "InboxStatusNextActionKind | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
