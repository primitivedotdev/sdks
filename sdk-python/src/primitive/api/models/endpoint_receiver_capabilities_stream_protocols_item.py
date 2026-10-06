from enum import StrEnum

class EndpointReceiverCapabilitiesStreamProtocolsItem(StrEnum):
    PRIMITIVE_EVENTS_V1 = "primitive.events.v1"

    def __str__(self) -> str:
        return str(self.value)
