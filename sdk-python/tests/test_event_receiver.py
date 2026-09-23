from __future__ import annotations

import asyncio
import json
from pathlib import Path

import httpx
import pytest

from primitive import EventContext, EventReceiverError, LocalEvent, PrimitiveClient

FIXTURE = json.loads(
    (Path(__file__).parents[2] / "test-fixtures/local-event-receiver.json").read_text()
)


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_receipt_and_subscription_lifecycle() -> None:
    completions: list[object] = []

    async def fetch(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/pull"):
            data = {
                "delivery": FIXTURE["delivery"],
                "backlog": 0,
                "gap_count": 0,
                "last_gap_reason": None,
                "retention_seconds": 86400,
                "handler_timeout_seconds": 30,
            }
        elif request.url.path.endswith("/complete"):
            completions.append(json.loads(request.content))
            data = {"result": "completed"}
        else:
            data = {
                "id": "endpoint",
                "kind": "pull",
                "receiver_capabilities": {
                    "completion_modes": ["sdk"],
                    "stream_protocols": ["primitive.events.v1"],
                },
            }
        return httpx.Response(200, json={"success": True, "data": data})

    async with httpx.AsyncClient(
        base_url="https://api.example.test/v1/", transport=httpx.MockTransport(fetch)
    ) as http:
        client = PrimitiveClient("test")
        client.api_client.set_async_httpx_client(http)
        for name in FIXTURE["invalid_names"]:
            with pytest.raises(ValueError):
                await client.events.wait(subscription=name, transport="poll")
        delivery = await client.events.wait(subscription="agent", transport="poll")
        assert delivery is not None
        assert delivery.event.body == FIXTURE["delivery"]["body"]
        assert delivery.event.id == FIXTURE["delivery"]["event_id"]
        assert not completions
        with pytest.raises(EventReceiverError, match="busy"):
            await client.events.wait(subscription="agent", transport="poll")
        await delivery.ack()
        await delivery.ack()
        assert len(completions) == 1
        with pytest.raises(EventReceiverError, match="completion_conflict"):
            await delivery.retry()
        again = await client.events.wait(subscription="agent", transport="poll")
        assert again is not None
        await again.retry()
        assert len(completions) == 2


@pytest.mark.anyio
async def test_timeout_and_cancellation_release_subscription() -> None:
    async def fetch(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/pull"):
            await asyncio.Event().wait()
        return httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "id": "endpoint",
                    "kind": "pull",
                    "receiver_capabilities": {
                        "completion_modes": ["sdk"],
                        "stream_protocols": [],
                    },
                },
            },
        )

    async with httpx.AsyncClient(
        base_url="https://api.example.test/v1/", transport=httpx.MockTransport(fetch)
    ) as http:
        client = PrimitiveClient("test")
        client.api_client.set_async_httpx_client(http)
        assert (
            await client.events.wait(
                subscription="agent", transport="poll", timeout=0.01
            )
            is None
        )
        waiting = asyncio.create_task(
            client.events.wait(subscription="agent", transport="poll")
        )
        await asyncio.sleep(0.01)
        waiting.cancel()
        with pytest.raises(asyncio.CancelledError):
            await waiting
        assert (
            await client.events.wait(
                subscription="agent", transport="poll", timeout=0.01
            )
            is None
        )


@pytest.mark.anyio
async def test_listener_accepts_only_after_handler_and_gracefully_closes() -> None:
    started, finish = asyncio.Event(), asyncio.Event()
    completions: list[object] = []

    async def fetch(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/pull"):
            data = {
                "delivery": FIXTURE["delivery"],
                "backlog": 0,
                "gap_count": 0,
                "last_gap_reason": None,
                "retention_seconds": 86400,
                "handler_timeout_seconds": 30,
            }
        elif request.url.path.endswith("/complete"):
            completions.append(json.loads(request.content))
            data = {"result": "completed"}
        else:
            data = {
                "id": "endpoint",
                "kind": "pull",
                "receiver_capabilities": {
                    "completion_modes": ["sdk"],
                    "stream_protocols": [],
                },
            }
        return httpx.Response(200, json={"success": True, "data": data})

    async def handler(event: LocalEvent, context: EventContext) -> None:
        assert event.type == "future.event"
        assert not context.signal.is_set()
        started.set()
        await finish.wait()

    async with httpx.AsyncClient(
        base_url="https://api.example.test/v1/", transport=httpx.MockTransport(fetch)
    ) as http:
        client = PrimitiveClient("test")
        client.api_client.set_async_httpx_client(http)
        listener = await client.events.listen(
            handler, subscription="agent", transport="poll"
        )
        await started.wait()
        closing = asyncio.create_task(listener.close())
        await asyncio.sleep(0)
        assert not completions
        finish.set()
        await closing
        assert len(completions) == 1


@pytest.mark.anyio
async def test_websocket_reconnect_retries_receipt_without_receiving_again() -> None:
    from websockets.asyncio.server import ServerConnection, serve
    from websockets.typing import Subprotocol

    deliveries = 0
    completions: list[object] = []

    async def socket_handler(socket: ServerConnection) -> None:
        nonlocal deliveries
        try:
            async for message in socket:
                frame = json.loads(message)
                if frame["type"] == "authenticate":
                    assert frame["token"] == "test"
                    await socket.send(
                        json.dumps({"type": "ready", "protocol": "primitive.events.v1"})
                    )
                elif frame["type"] == "receive":
                    deliveries += 1
                    await socket.send(json.dumps({"type": "ping"}))
                    await socket.send(
                        json.dumps(
                            {
                                "type": "event",
                                "data": {
                                    "delivery": FIXTURE["delivery"],
                                    "backlog": 0,
                                    "gap_count": 0,
                                    "last_gap_reason": None,
                                    "retention_seconds": 86400,
                                    "handler_timeout_seconds": 30,
                                },
                            }
                        )
                    )
                elif frame["type"] == "complete":
                    completions.append(frame["body"])
                    if len(completions) == 1:
                        await socket.close()
                        return
                    await socket.send(
                        json.dumps(
                            {"type": "receipt", "data": {"result": "already_completed"}}
                        )
                    )
        finally:
            await socket.close()

    async def fetch(request: httpx.Request) -> httpx.Response:
        data = (
            {"id": "account"}
            if request.url.path.endswith("/account")
            else {
                "id": "endpoint",
                "kind": "pull",
                "receiver_capabilities": {
                    "completion_modes": ["sdk"],
                    "stream_protocols": ["primitive.events.v1"],
                },
            }
        )
        return httpx.Response(200, json={"success": True, "data": data})

    async with serve(
        socket_handler,
        "127.0.0.1",
        0,
        subprotocols=[Subprotocol("primitive.events.v1")],
    ) as server:
        port = server.sockets[0].getsockname()[1]
        async with httpx.AsyncClient(
            base_url=f"http://127.0.0.1:{port}/v1/",
            transport=httpx.MockTransport(fetch),
        ) as http:
            client = PrimitiveClient("test")
            client.api_client.set_async_httpx_client(http)
            delivery = await client.events.wait(subscription="agent", timeout=3)
            assert delivery is not None
            await delivery.ack()
            assert deliveries == 1
            assert len(completions) == 2
            assert completions[0] == completions[1]
