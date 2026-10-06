from enum import StrEnum

class GateFixAction(StrEnum):
    CONFIRM_DOMAIN = "confirm_domain"
    SENDER_MUST_FIX_AUTHENTICATION = "sender_must_fix_authentication"
    WAIT_FOR_INBOUND = "wait_for_inbound"

    def __str__(self) -> str:
        return str(self.value)
