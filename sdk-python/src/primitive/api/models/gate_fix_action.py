from enum import Enum

class GateFixAction(str, Enum):
    CONFIRM_DOMAIN = "confirm_domain"
    SENDER_MUST_FIX_AUTHENTICATION = "sender_must_fix_authentication"
    WAIT_FOR_INBOUND = "wait_for_inbound"

    def __str__(self) -> str:
        return str(self.value)
