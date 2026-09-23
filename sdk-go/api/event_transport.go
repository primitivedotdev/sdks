package api

import (
	"bytes"
	"context"
	"net/http"
	"strings"
)

// ReceiverRequest uses this client's configured HTTP transport and bearer source.
// It is the shared transport hook for the high-level local event receiver.
func (c *Client) ReceiverRequest(ctx context.Context, path string, body []byte) (*http.Response, error) {
	method := http.MethodGet
	if body != nil {
		method = http.MethodPost
	}
	request, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(c.requestURL(ctx).String(), "/")+"/"+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	operation := PullWebhookEventOperation
	if path == "endpoints" {
		operation = CreateEndpointOperation
	}
	if path == "account" {
		operation = GetAccountOperation
	}
	if strings.HasSuffix(path, "/complete") {
		operation = CompleteWebhookEventOperation
	}
	if err = c.securityBearerAuth(ctx, operation, request); err != nil {
		return nil, err
	}
	return c.cfg.Client.Do(request)
}

// ReceiverConnection returns a snapshot of the configured origin and current
// bearer credentials. The credentials belong in the first authenticated frame.
func (c *Client) ReceiverConnection(ctx context.Context) (string, string, error) {
	token, err := c.sec.BearerAuth(ctx, PullWebhookEventOperation)
	return c.requestURL(ctx).String(), token.Token, err
}

// ReceiverDo preserves custom TLS/proxy transports for a WebSocket handshake.
func (c *Client) ReceiverDo(request *http.Request) (*http.Response, error) {
	return c.cfg.Client.Do(request)
}
