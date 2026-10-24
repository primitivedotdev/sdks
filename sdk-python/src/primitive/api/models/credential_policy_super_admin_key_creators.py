from enum import StrEnum

class CredentialPolicySuperAdminKeyCreators(StrEnum):
    OWNERS = "owners"
    OWNERS_AND_ADMINS = "owners_and_admins"

    def __str__(self) -> str:
        return str(self.value)
