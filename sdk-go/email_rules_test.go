package primitive

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/google/uuid"
	api "github.com/primitivedotdev/sdks/sdk-go/v3/api"
)

func apiClientAnswering(t *testing.T, status int, body []byte) *api.Client {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write(body)
	}))
	t.Cleanup(server.Close)
	client, err := api.NewClient(server.URL, attachmentPartSecurity{})
	if err != nil {
		t.Fatal(err)
	}
	return client
}

// A value the API adds after this SDK was generated still decodes instead of
// failing the whole response.
func TestGetEmailRuleDecodesUnfamiliarState(t *testing.T) {
	body, err := os.ReadFile("../test-fixtures/email-rules/rule-detail.json")
	if err != nil {
		t.Fatal(err)
	}
	client := apiClientAnswering(t, http.StatusOK, body)

	result, err := client.GetEmailRule(context.Background(), api.GetEmailRuleParams{ID: uuid.MustParse("3c9e7a1b-2d4f-4b6a-8c0e-1f2a3b4c5d6e")})
	if err != nil {
		t.Fatal(err)
	}
	ok, isOK := result.(*api.GetEmailRuleOK)
	if !isOK {
		t.Fatalf("unexpected response type %T", result)
	}
	rule := ok.Data
	if string(rule.State) != "some_future_state" || rule.Name != "Internship applicants" {
		t.Fatalf("unexpected rule %+v", rule)
	}
	current, set := rule.Current.Get()
	if !set {
		t.Fatal("expected a current version")
	}
	if current.Version != 2 || current.CompiledBy != "rule-compiler-v1" || len(current.Tree.Questions) != 1 {
		t.Fatalf("unexpected current version %+v", current)
	}
}

func TestCompileEmailRuleDecodesNotCompiledError(t *testing.T) {
	client := apiClientAnswering(t, http.StatusUnprocessableEntity, []byte(`{"success":false,"error":{"code":"email_rule_not_compiled","message":"Rephrase it.","details":{"reason":"invalid"}}}`))

	result, err := client.CompileEmailRule(context.Background(), &api.CompileEmailRuleRequest{English: "college students looking for internships"}, api.CompileEmailRuleParams{})
	if err != nil {
		t.Fatal(err)
	}
	failure, isFailure := result.(*api.CompileEmailRuleUnprocessableEntity)
	if !isFailure {
		t.Fatalf("unexpected response type %T", result)
	}
	if failure.Error.Code != api.ErrorResponseErrorCodeEmailRuleNotCompiled {
		t.Fatalf("unexpected error code %q", failure.Error.Code)
	}
}

func TestErrorCodeNotInTheSpecStillDecodes(t *testing.T) {
	client := apiClientAnswering(t, http.StatusUnprocessableEntity, []byte(`{"success":false,"error":{"code":"some_future_code","message":"Later."}}`))

	result, err := client.CompileEmailRule(context.Background(), &api.CompileEmailRuleRequest{English: "anything"}, api.CompileEmailRuleParams{})
	if err != nil {
		t.Fatal(err)
	}
	failure, isFailure := result.(*api.CompileEmailRuleUnprocessableEntity)
	if !isFailure {
		t.Fatalf("unexpected response type %T", result)
	}
	if string(failure.Error.Code) != "some_future_code" {
		t.Fatalf("unexpected error code %q", failure.Error.Code)
	}
}
