from enum import StrEnum

class GateDenialName(StrEnum):
    SEND_TO_CONFIRMED_DOMAINS = "send_to_confirmed_domains"
    SEND_TO_KNOWN_ADDRESSES = "send_to_known_addresses"

    def __str__(self) -> str:
        return str(self.value)
