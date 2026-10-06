from enum import StrEnum

class SendPermissionYourDomainType(StrEnum):
    YOUR_DOMAIN = "your_domain"

    def __str__(self) -> str:
        return str(self.value)
