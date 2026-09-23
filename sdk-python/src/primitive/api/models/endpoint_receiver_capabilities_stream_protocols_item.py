from enum import Enum

class EndpointReceiverCapabilitiesStreamProtocolsItem(str, Enum):
    PRIMITIVE_EVENTS_V1 = "primitive.events.v1"

    def __str__(self) -> str:
        return str(self.value)
