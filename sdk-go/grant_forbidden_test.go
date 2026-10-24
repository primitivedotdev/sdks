package primitive

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	primitiveapi "github.com/primitivedotdev/sdks/sdk-go/v2/api"
)

func sendWithResponse(t *testing.T, status int, body string) error {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(server.Close)
	apiClient, err := primitiveapi.NewClient(server.URL, attachmentPartSecurity{})
	if err != nil {
		t.Fatal(err)
	}
	_, err = NewClientFromAPI(apiClient).Send(context.Background(), SendParams{
		From:     "support@example.com",
		To:       "alice@example.com",
		Subject:  "Hello",
		BodyText: "Hi",
	})
	return err
}

func TestGrantForbiddenErrorFromTheWire(t *testing.T) {
	err := sendWithResponse(t, http.StatusForbidden, `{"success":false,"error":{
		"code":"grant_forbidden",
		"message":"This credential's grant does not allow this operation (mail:send: permission_missing).",
		"details":{
			"permission":"mail:send",
			"credential_kind":"org_key",
			"credential_grant_id":"g1",
			"catalog_version":"c1",
			"reason":"resource_outside_grant",
			"missing":"mail:read",
			"resource":{"type":"domain","id":"d1"}
		}
	}}`)
	var refused *GrantForbiddenError
	if !errors.As(err, &refused) {
		t.Fatalf("expected GrantForbiddenError, got %T %v", err, err)
	}
	if refused.Permission != "mail:send" || refused.CredentialKind != "org_key" ||
		refused.CredentialGrantID != "g1" || refused.CatalogVersion != "c1" ||
		refused.Reason != "resource_outside_grant" || refused.Missing != "mail:read" ||
		refused.GrantTemplateKey != "" {
		t.Fatalf("unexpected fields: %+v", refused)
	}
	if refused.Resource == nil || *refused.Resource != (GrantForbiddenResource{Type: "domain", ID: "d1"}) {
		t.Fatalf("unexpected resource: %+v", refused.Resource)
	}
	if refused.StatusCode != http.StatusForbidden || refused.Code != GrantForbiddenCode {
		t.Fatalf("unexpected API error: %+v", refused.APIError)
	}
	var apiErr *APIError
	if !errors.As(err, &apiErr) || apiErr.Code != GrantForbiddenCode {
		t.Fatalf("expected APIError to still match, got %T", err)
	}
	if !errors.As(refused, &apiErr) {
		t.Fatal("GrantForbiddenError should unwrap to APIError")
	}
}

func TestOtherForbiddenIsNotGrantForbidden(t *testing.T) {
	err := sendWithResponse(t, http.StatusForbidden, `{"success":false,"error":{"code":"forbidden","message":"Insufficient permissions"}}`)
	var refused *GrantForbiddenError
	if errors.As(err, &refused) {
		t.Fatalf("plain forbidden must not read as grant_forbidden: %+v", refused)
	}
	var apiErr *APIError
	if !errors.As(err, &apiErr) || apiErr.Code != "forbidden" {
		t.Fatalf("expected APIError, got %T %v", err, err)
	}
}

func TestGrantForbiddenWithoutDetails(t *testing.T) {
	refused := newGrantForbiddenError(&APIError{Code: GrantForbiddenCode, StatusCode: 403})
	if refused.Permission != "" || refused.Resource != nil || refused.Unwrap() == nil {
		t.Fatalf("unexpected: %+v", refused)
	}
}

func TestNullDetailFieldsStillDecode(t *testing.T) {
	err := sendWithResponse(t, http.StatusForbidden, `{"success":false,"error":{
		"code":"forbidden",
		"message":"You cannot change this delegation.",
		"details":{"permission":null,"reason":null,"credential_kind":null}
	}}`)
	var apiErr *APIError
	if !errors.As(err, &apiErr) || apiErr.Code != "forbidden" {
		t.Fatalf("expected a decoded forbidden APIError, got %T %v", err, err)
	}
	var refused *GrantForbiddenError
	if errors.As(err, &refused) {
		t.Fatal("forbidden must not read as GrantForbiddenError")
	}
}
