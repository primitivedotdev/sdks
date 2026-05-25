from enum import Enum

class InboxStatusNextActionKind(str, Enum):
    ADD_DOMAIN = "add_domain"
    CONFIGURE_PROCESSING = "configure_processing"
    FIX_FAILED_FUNCTIONS = "fix_failed_functions"
    SEND_TEST_EMAIL = "send_test_email"
    VERIFY_DOMAIN = "verify_domain"

    def __str__(self) -> str:
        return str(self.value)
