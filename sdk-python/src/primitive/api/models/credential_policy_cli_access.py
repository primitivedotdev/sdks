from enum import StrEnum

class CredentialPolicyCliAccess(StrEnum):
    ALL_MEMBERS = "all_members"
    OFF = "off"
    OWNERS_AND_ADMINS = "owners_and_admins"

    def __str__(self) -> str:
        return str(self.value)
