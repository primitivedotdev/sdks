from enum import StrEnum

class CredentialsUpdateCredentialPolicyResultCliAccess(StrEnum):
    ALL_MEMBERS = "all_members"
    OFF = "off"
    OWNERS_ADMINS_AND_OPERATORS = "owners_admins_and_operators"
    OWNERS_AND_ADMINS = "owners_and_admins"

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def _missing_(cls, value: object) -> "CredentialsUpdateCredentialPolicyResultCliAccess | None":
        # A value the API added after this SDK was generated: keep it rather
        # than failing to decode the whole response.
        if not isinstance(value, str):
            return None
        member = str.__new__(cls, value)
        member._name_ = value
        member._value_ = value
        return member
