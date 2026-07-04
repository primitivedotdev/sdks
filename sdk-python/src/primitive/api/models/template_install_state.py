from enum import Enum

class TemplateInstallState(str, Enum):
    BIND_FAILED = "bind_failed"
    BOUND = "bound"
    CONNECTING = "connecting"
    DEPLOYING = "deploying"
    DEPLOY_FAILED = "deploy_failed"
    TESTED = "tested"
    TEST_FAILED = "test_failed"

    def __str__(self) -> str:
        return str(self.value)
