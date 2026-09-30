from enum import Enum

class AgentNetworkContactAdmissionSenderRelation(str, Enum):
    MEMBER = "member"
    OWNER = "owner"

    def __str__(self) -> str:
        return str(self.value)
