package primitive

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func loadFixtureCases[T any](t *testing.T, parts ...string) T {
	t.Helper()
	_, filename, _, _ := runtime.Caller(0)
	base := filepath.Join(filepath.Dir(filename), "..", "test-fixtures")
	all := append([]string{base}, parts...)
	data, err := os.ReadFile(filepath.Join(all...))
	if err != nil {
		t.Fatalf("read fixture file: %v", err)
	}
	var value T
	if err := json.Unmarshal(data, &value); err != nil {
		t.Fatalf("decode fixture file: %v", err)
	}
	return value
}

func loadFixtureText(t *testing.T, parts ...string) string {
	t.Helper()
	_, filename, _, _ := runtime.Caller(0)
	base := filepath.Join(filepath.Dir(filename), "..", "test-fixtures")
	all := append([]string{base}, parts...)
	data, err := os.ReadFile(filepath.Join(all...))
	if err != nil {
		t.Fatalf("read fixture file: %v", err)
	}
	return string(data)
}

func webhookErrorCode(err error) (string, bool) {
	var verificationErr *WebhookVerificationError
	if errors.As(err, &verificationErr) {
		return verificationErr.Code(), true
	}
	var payloadErr *WebhookPayloadError
	if errors.As(err, &payloadErr) {
		return payloadErr.Code(), true
	}
	var validationErr *WebhookValidationError
	if errors.As(err, &validationErr) {
		return validationErr.Code(), true
	}
	var decodeErr *RawEmailDecodeError
	if errors.As(err, &decodeErr) {
		return decodeErr.Code(), true
	}
	return "", false
}

func TestSharedCompatibilityFixtures(t *testing.T) {
	t.Run("webhook validation", func(t *testing.T) {
		fixtures := loadFixtureCases[struct {
			Cases []struct {
				Name     string         `json:"name"`
				Payload  map[string]any `json:"payload"`
				Expected struct {
					Valid     bool   `json:"valid"`
					ID        string `json:"id"`
					ErrorCode string `json:"error_code"`
				} `json:"expected"`
			} `json:"cases"`
		}](t, "webhook", "validation-cases.json")

		for _, testCase := range fixtures.Cases {
			if testCase.Expected.Valid {
				event, err := ValidateEmailReceivedEvent(testCase.Payload)
				if err != nil {
					t.Fatalf("%s: ValidateEmailReceivedEvent returned error: %v", testCase.Name, err)
				}
				if event.ID != testCase.Expected.ID {
					t.Fatalf("%s: unexpected event ID %q", testCase.Name, event.ID)
				}
				if !SafeValidateEmailReceivedEvent(testCase.Payload).Success {
					t.Fatalf("%s: expected safe validation success", testCase.Name)
				}
				continue
			}

			_, err := ValidateEmailReceivedEvent(testCase.Payload)
			var validationErr *WebhookValidationError
			if !errors.As(err, &validationErr) {
				t.Fatalf("%s: expected WebhookValidationError, got %v", testCase.Name, err)
			}
			if validationErr.Code() != testCase.Expected.ErrorCode {
				t.Fatalf("%s: unexpected error code %q", testCase.Name, validationErr.Code())
			}
		}
	})

	t.Run("signing", func(t *testing.T) {
		fixtures := loadFixtureCases[struct {
			Cases []struct {
				Name              string `json:"name"`
				RawBody           string `json:"raw_body"`
				Secret            string `json:"secret"`
				Timestamp         int64  `json:"timestamp"`
				VerifySecret      string `json:"verify_secret"`
				NowSeconds        int64  `json:"now_seconds"`
				SignatureHeader   string `json:"signature_header"`
				ExpectedV1        string `json:"expected_v1"`
				ExpectedValid     bool   `json:"expected_valid"`
				ExpectedErrorCode string `json:"expected_error_code"`
			} `json:"cases"`
		}](t, "signing", "vectors.json")

		for _, testCase := range fixtures.Cases {
			signed, err := SignWebhookPayload(testCase.RawBody, testCase.Secret, testCase.Timestamp)
			if err != nil {
				t.Fatalf("%s: SignWebhookPayload returned error: %v", testCase.Name, err)
			}
			if signed.V1 != testCase.ExpectedV1 {
				t.Fatalf("%s: unexpected signature %q", testCase.Name, signed.V1)
			}

			verifySecret := testCase.VerifySecret
			if verifySecret == "" {
				verifySecret = testCase.Secret
			}
			nowSeconds := testCase.NowSeconds
			if nowSeconds == 0 {
				nowSeconds = testCase.Timestamp
			}
			signatureHeader := testCase.SignatureHeader
			if signatureHeader == "" {
				signatureHeader = signed.Header
			}

			_, err = VerifyWebhookSignature(VerifyOptions{
				RawBody:         testCase.RawBody,
				SignatureHeader: signatureHeader,
				Secret:          verifySecret,
				NowSeconds:      &nowSeconds,
			})

			if testCase.ExpectedValid {
				if err != nil {
					t.Fatalf("%s: VerifyWebhookSignature returned error: %v", testCase.Name, err)
				}
				continue
			}

			var verificationErr *WebhookVerificationError
			if !errors.As(err, &verificationErr) {
				t.Fatalf("%s: expected WebhookVerificationError, got %v", testCase.Name, err)
			}
			if verificationErr.Code() != testCase.ExpectedErrorCode {
				t.Fatalf("%s: unexpected error code %q", testCase.Name, verificationErr.Code())
			}
		}
	})

	t.Run("auth", func(t *testing.T) {
		fixtures := loadFixtureCases[struct {
			Cases []struct {
				Name     string `json:"name"`
				Input    any    `json:"input"`
				Expected struct {
					Verdict    AuthVerdict    `json:"verdict"`
					Confidence AuthConfidence `json:"confidence"`
				} `json:"expected"`
			} `json:"cases"`
		}](t, "auth", "cases.json")

		for _, testCase := range fixtures.Cases {
			result, err := ValidateEmailAuth(testCase.Input)
			if err != nil {
				t.Fatalf("%s: ValidateEmailAuth returned error: %v", testCase.Name, err)
			}
			if result.Verdict != testCase.Expected.Verdict || result.Confidence != testCase.Expected.Confidence {
				t.Fatalf("%s: unexpected result %#v", testCase.Name, result)
			}
		}
	})

	t.Run("raw", func(t *testing.T) {
		fixtures := loadFixtureCases[struct {
			Cases []struct {
				Name              string         `json:"name"`
				Event             map[string]any `json:"event"`
				DownloadBytesUTF8 string         `json:"download_bytes_utf8"`
				Expected          struct {
					Included                bool   `json:"included"`
					DecodedUTF8             string `json:"decoded_utf8"`
					DecodeErrorCode         string `json:"decode_error_code"`
					VerifyDownload          bool   `json:"verify_download"`
					VerifyDownloadErrorCode string `json:"verify_download_error_code"`
				} `json:"expected"`
			} `json:"cases"`
		}](t, "raw", "cases.json")

		for _, testCase := range fixtures.Cases {
			included, err := IsRawIncluded(testCase.Event)
			if err != nil {
				t.Fatalf("%s: IsRawIncluded returned error: %v", testCase.Name, err)
			}
			if included != testCase.Expected.Included {
				t.Fatalf("%s: unexpected included flag %v", testCase.Name, included)
			}

			if testCase.Expected.DecodedUTF8 != "" {
				decoded, err := DecodeRawEmail(testCase.Event)
				if err != nil {
					t.Fatalf("%s: DecodeRawEmail returned error: %v", testCase.Name, err)
				}
				if string(decoded) != testCase.Expected.DecodedUTF8 {
					t.Fatalf("%s: unexpected decoded content %q", testCase.Name, string(decoded))
				}
			}

			if testCase.Expected.DecodeErrorCode != "" {
				_, err := DecodeRawEmail(testCase.Event)
				var decodeErr *RawEmailDecodeError
				if !errors.As(err, &decodeErr) {
					t.Fatalf("%s: expected RawEmailDecodeError, got %v", testCase.Name, err)
				}
				if decodeErr.Code() != testCase.Expected.DecodeErrorCode {
					t.Fatalf("%s: unexpected error code %q", testCase.Name, decodeErr.Code())
				}
			}

			if testCase.Expected.VerifyDownload {
				verified, err := VerifyRawEmailDownload([]byte(testCase.DownloadBytesUTF8), testCase.Event)
				if err != nil {
					t.Fatalf("%s: VerifyRawEmailDownload returned error: %v", testCase.Name, err)
				}
				if string(verified) != testCase.DownloadBytesUTF8 {
					t.Fatalf("%s: unexpected verified content %q", testCase.Name, string(verified))
				}
			}

			if testCase.Expected.VerifyDownloadErrorCode != "" {
				_, err := VerifyRawEmailDownload([]byte(testCase.DownloadBytesUTF8), testCase.Event)
				var decodeErr *RawEmailDecodeError
				if !errors.As(err, &decodeErr) {
					t.Fatalf("%s: expected RawEmailDecodeError, got %v", testCase.Name, err)
				}
				if decodeErr.Code() != testCase.Expected.VerifyDownloadErrorCode {
					t.Fatalf("%s: unexpected error code %q", testCase.Name, decodeErr.Code())
				}
			}
		}
	})

	t.Run("parse webhook event", func(t *testing.T) {
		fixtures := loadFixtureCases[struct {
			Cases []struct {
				Name         string   `json:"name"`
				Input        any      `json:"input"`
				InputFixture []string `json:"input_fixture"`
				Expected     struct {
					Kind      string `json:"kind"`
					Event     string `json:"event"`
					ID        string `json:"id"`
					Version   string `json:"version"`
					ErrorCode string `json:"error_code"`
				} `json:"expected"`
			} `json:"cases"`
		}](t, "parse-webhook-event", "cases.json")

		for _, testCase := range fixtures.Cases {
			input := testCase.Input
			if len(testCase.InputFixture) > 0 {
				input = loadFixtureCases[any](t, testCase.InputFixture...)
			}

			if testCase.Expected.Kind == "error" {
				_, err := ParseWebhookEvent(input)
				code, ok := webhookErrorCode(err)
				if !ok {
					t.Fatalf("%s: expected PrimitiveWebhookError, got %v", testCase.Name, err)
				}
				if code != testCase.Expected.ErrorCode {
					t.Fatalf("%s: unexpected error code %q", testCase.Name, code)
				}
				continue
			}

			event, err := ParseWebhookEvent(input)
			if err != nil {
				t.Fatalf("%s: ParseWebhookEvent returned error: %v", testCase.Name, err)
			}
			expectedEvent := testCase.Expected.Event
			if expectedEvent == "" {
				expectedEvent = testCase.Expected.Kind
			}
			if event.GetEvent() != expectedEvent {
				t.Fatalf("%s: unexpected event type %q", testCase.Name, event.GetEvent())
			}

			if testCase.Expected.Kind == string(EventTypeEmailReceived) {
				typed, ok := event.(EmailReceivedEvent)
				if !ok {
					t.Fatalf("%s: expected EmailReceivedEvent, got %T", testCase.Name, event)
				}
				if typed.ID != testCase.Expected.ID {
					t.Fatalf("%s: unexpected event ID %q", testCase.Name, typed.ID)
				}
				continue
			}

			unknown, ok := event.(UnknownEvent)
			if !ok {
				t.Fatalf("%s: expected UnknownEvent, got %T", testCase.Name, event)
			}
			if unknown.ID == nil || *unknown.ID != testCase.Expected.ID {
				t.Fatalf("%s: unexpected unknown event ID %#v", testCase.Name, unknown.ID)
			}
			if unknown.Version == nil || *unknown.Version != testCase.Expected.Version {
				t.Fatalf("%s: unexpected unknown event version %#v", testCase.Name, unknown.Version)
			}
		}
	})

	t.Run("handle webhook", func(t *testing.T) {
		fixtures := loadFixtureCases[struct {
			Cases []struct {
				Name             string            `json:"name"`
				Body             string            `json:"body"`
				BodyFixture      []string          `json:"body_fixture"`
				Headers          map[string]string `json:"headers"`
				Secret           string            `json:"secret"`
				SignSecret       string            `json:"sign_secret"`
				Timestamp        *int64            `json:"timestamp"`
				ToleranceSeconds *int64            `json:"tolerance_seconds"`
				Expected         struct {
					Valid     bool   `json:"valid"`
					ID        string `json:"id"`
					ErrorCode string `json:"error_code"`
				} `json:"expected"`
			} `json:"cases"`
		}](t, "handle-webhook", "cases.json")

		for _, testCase := range fixtures.Cases {
			body := testCase.Body
			if len(testCase.BodyFixture) > 0 {
				body = loadFixtureText(t, testCase.BodyFixture...)
			}
			signSecret := testCase.SignSecret
			if signSecret == "" {
				signSecret = testCase.Secret
			}
			signed, err := SignWebhookPayload(body, signSecret)
			if testCase.Timestamp != nil {
				signed, err = SignWebhookPayload(body, signSecret, *testCase.Timestamp)
			}
			if err != nil {
				t.Fatalf("%s: SignWebhookPayload returned error: %v", testCase.Name, err)
			}

			headers := map[string]string{}
			for key, value := range testCase.Headers {
				if value == "{signed}" {
					headers[key] = signed.Header
				} else {
					headers[key] = value
				}
			}

			if testCase.Expected.Valid {
				event, err := HandleWebhook(HandleWebhookOptions{
					Body:             body,
					Headers:          headers,
					Secret:           testCase.Secret,
					ToleranceSeconds: testCase.ToleranceSeconds,
				})
				if err != nil {
					t.Fatalf("%s: HandleWebhook returned error: %v", testCase.Name, err)
				}
				if event.ID != testCase.Expected.ID {
					t.Fatalf("%s: unexpected event ID %q", testCase.Name, event.ID)
				}
				continue
			}

			_, err = HandleWebhook(HandleWebhookOptions{
				Body:             body,
				Headers:          headers,
				Secret:           testCase.Secret,
				ToleranceSeconds: testCase.ToleranceSeconds,
			})
			code, ok := webhookErrorCode(err)
			if !ok {
				t.Fatalf("%s: expected PrimitiveWebhookError, got %v", testCase.Name, err)
			}
			if code != testCase.Expected.ErrorCode {
				t.Fatalf("%s: unexpected error code %q", testCase.Name, code)
			}
		}
	})

	t.Run("standard webhooks signing", func(t *testing.T) {
		fixtures := loadFixtureCases[struct {
			Cases []struct {
				Name                   string  `json:"name"`
				RawBody                string  `json:"raw_body"`
				Secret                 string  `json:"secret"`
				MsgID                  string  `json:"msg_id"`
				Timestamp              int64   `json:"timestamp"`
				VerifySecret           *string `json:"verify_secret"`
				NowSeconds             *int64  `json:"now_seconds"`
				WebhookSignatureHeader *string `json:"webhook_signature_header"`
				ExpectedSignature      string  `json:"expected_signature"`
				ExpectedValid          bool    `json:"expected_valid"`
				ExpectedErrorCode      string  `json:"expected_error_code"`
			} `json:"cases"`
		}](t, "signing", "standard-webhooks-vectors.json")

		for _, testCase := range fixtures.Cases {
			signed, err := SignStandardWebhooksPayload(testCase.RawBody, testCase.Secret, testCase.MsgID, testCase.Timestamp)
			if err != nil {
				t.Fatalf("%s: SignStandardWebhooksPayload returned error: %v", testCase.Name, err)
			}
			expectedSig := "v1," + testCase.ExpectedSignature
			if signed.Signature != expectedSig {
				t.Fatalf("%s: unexpected signature %q, expected %q", testCase.Name, signed.Signature, expectedSig)
			}

			verifySecret := testCase.Secret
			if testCase.VerifySecret != nil {
				verifySecret = *testCase.VerifySecret
			}
			nowSeconds := testCase.Timestamp
			if testCase.NowSeconds != nil {
				nowSeconds = *testCase.NowSeconds
			}
			signatureHeader := signed.Signature
			if testCase.WebhookSignatureHeader != nil {
				signatureHeader = *testCase.WebhookSignatureHeader
			}

			_, err = VerifyStandardWebhooksSignature(StandardWebhooksVerifyOptions{
				RawBody:         testCase.RawBody,
				MsgID:           testCase.MsgID,
				Timestamp:       fmt.Sprintf("%d", testCase.Timestamp),
				SignatureHeader: signatureHeader,
				Secret:          verifySecret,
				NowSeconds:      &nowSeconds,
			})

			if testCase.ExpectedValid {
				if err != nil {
					t.Fatalf("%s: VerifyStandardWebhooksSignature returned error: %v", testCase.Name, err)
				}
				continue
			}

			var verificationErr *WebhookVerificationError
			if !errors.As(err, &verificationErr) {
				t.Fatalf("%s: expected WebhookVerificationError, got %v", testCase.Name, err)
			}
			if verificationErr.Code() != testCase.ExpectedErrorCode {
				t.Fatalf("%s: unexpected error code %q", testCase.Name, verificationErr.Code())
			}
		}
	})

	t.Run("standard webhooks handle webhook", func(t *testing.T) {
		fixtures := loadFixtureCases[struct {
			Cases []struct {
				Name             string            `json:"name"`
				Body             string            `json:"body"`
				BodyFixture      []string          `json:"body_fixture"`
				Headers          map[string]string `json:"headers"`
				Secret           string            `json:"secret"`
				SignSecret       string            `json:"sign_secret"`
				MsgID            string            `json:"msg_id"`
				Timestamp        *int64            `json:"timestamp"`
				ToleranceSeconds *int64            `json:"tolerance_seconds"`
				Expected         struct {
					Valid     bool   `json:"valid"`
					ID        string `json:"id"`
					ErrorCode string `json:"error_code"`
				} `json:"expected"`
			} `json:"cases"`
		}](t, "handle-webhook", "standard-webhooks-cases.json")

		for _, testCase := range fixtures.Cases {
			body := testCase.Body
			if len(testCase.BodyFixture) > 0 {
				body = loadFixtureText(t, testCase.BodyFixture...)
			}
			signSecret := testCase.SignSecret
			if signSecret == "" {
				signSecret = testCase.Secret
			}
			msgID := testCase.MsgID
			if msgID == "" {
				msgID = "msg_default"
			}

			needsSign := false
			for _, v := range testCase.Headers {
				if v == "{signed_standard}" {
					needsSign = true
					break
				}
			}

			var signed StandardWebhooksSignResult
			if needsSign {
				var ts []int64
				if testCase.Timestamp != nil {
					ts = append(ts, *testCase.Timestamp)
				}
				var err error
				signed, err = SignStandardWebhooksPayload(body, signSecret, msgID, ts...)
				if err != nil {
					t.Fatalf("%s: SignStandardWebhooksPayload returned error: %v", testCase.Name, err)
				}
			}

			headers := map[string]string{}
			for key, value := range testCase.Headers {
				switch value {
				case "{signed_standard}":
					headers[key] = signed.Signature
				case "{timestamp}":
					if needsSign {
						headers[key] = fmt.Sprintf("%d", signed.Timestamp)
					} else if testCase.Timestamp != nil {
						headers[key] = fmt.Sprintf("%d", *testCase.Timestamp)
					}
				default:
					headers[key] = value
				}
			}

			if testCase.Expected.Valid {
				event, err := HandleWebhook(HandleWebhookOptions{
					Body:             body,
					Headers:          headers,
					Secret:           testCase.Secret,
					ToleranceSeconds: testCase.ToleranceSeconds,
				})
				if err != nil {
					t.Fatalf("%s: HandleWebhook returned error: %v", testCase.Name, err)
				}
				if event.ID != testCase.Expected.ID {
					t.Fatalf("%s: unexpected event ID %q", testCase.Name, event.ID)
				}
				continue
			}

			_, err := HandleWebhook(HandleWebhookOptions{
				Body:             body,
				Headers:          headers,
				Secret:           testCase.Secret,
				ToleranceSeconds: testCase.ToleranceSeconds,
			})
			code, ok := webhookErrorCode(err)
			if !ok {
				t.Fatalf("%s: expected PrimitiveWebhookError, got %v", testCase.Name, err)
			}
			if code != testCase.Expected.ErrorCode {
				t.Fatalf("%s: unexpected error code %q", testCase.Name, code)
			}
		}
	})
}
