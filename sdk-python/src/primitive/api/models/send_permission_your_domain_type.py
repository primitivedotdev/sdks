from enum import Enum

class SendPermissionYourDomainType(str, Enum):
    YOUR_DOMAIN = "your_domain"

    def __str__(self) -> str:
        return str(self.value)
