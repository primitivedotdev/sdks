package primitive

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/google/uuid"
	api "github.com/primitivedotdev/sdks/sdk-go/api"
)

type attachmentPartSecurity struct{}

func (attachmentPartSecurity) BearerAuth(context.Context, api.OperationName) (api.BearerAuth, error) {
	return api.BearerAuth{Token: "fixture" + "-credential"}, nil
}
func (attachmentPartSecurity) DownloadToken(context.Context, api.OperationName) (api.DownloadToken, error) {
	panic("Attachment parts must use bearer auth")
}

func TestAttachmentPartOriginalBytes(t *testing.T) {
	var fixture struct {
		ID                 string `json:"id"`
		PartIndex          int32  `json:"part_index"`
		Bytes              []int  `json:"bytes"`
		SHA256             string `json:"sha256"`
		ContentDisposition string `json:"content_disposition"`
	}
	data, err := os.ReadFile("../test-fixtures/attachment-part.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatal(err)
	}
	expected := make([]byte, len(fixture.Bytes))
	for i, b := range fixture.Bytes {
		expected[i] = byte(b)
	}
	for _, direction := range []string{"emails", "sent-emails"} {
		t.Run(direction, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != "GET" || r.URL.Path != "/"+direction+"/"+fixture.ID+"/attachments/7" {
					t.Errorf("Unexpected request %s %s", r.Method, r.URL.Path)
				}
				if r.Header.Get("Authorization") != "Bearer fixture"+"-credential" {
					t.Error("Missing bearer authorization")
				}
				w.Header().Set("Content-Type", "application/octet-stream")
				w.Header().Set("X-Content-SHA256", fixture.SHA256)
				w.Header().Set("Content-Disposition", fixture.ContentDisposition)
				w.Header().Set("Cache-Control", "private, no-store")
				_, _ = w.Write(expected)
			}))
			defer server.Close()
			client, err := api.NewClient(server.URL, attachmentPartSecurity{})
			if err != nil {
				t.Fatal(err)
			}
			var result interface{}
			if direction == "emails" {
				result, err = client.DownloadEmailAttachmentPart(context.Background(), api.DownloadEmailAttachmentPartParams{ID: uuid.MustParse(fixture.ID), PartIndex: fixture.PartIndex})
			} else {
				result, err = client.DownloadSentAttachmentPart(context.Background(), api.DownloadSentAttachmentPartParams{ID: uuid.MustParse(fixture.ID), PartIndex: fixture.PartIndex})
			}
			if err != nil {
				t.Fatal(err)
			}
			part, ok := result.(*api.AttachmentPartHeaders)
			if !ok {
				t.Fatalf("Unexpected response type %T", result)
			}
			actual, err := io.ReadAll(part.Response)
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(actual, expected) {
				t.Fatalf("Bytes changed: %v", actual)
			}
			if part.XContentSHA256.Value != fixture.SHA256 || part.ContentDisposition.Value != fixture.ContentDisposition || part.CacheControl.Value != "private, no-store" {
				t.Fatal("Download metadata changed")
			}
		})
	}
}

func TestAttachmentPartRetryResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Retry-After", "3")
		w.WriteHeader(503)
		_, _ = w.Write([]byte(`{"success":false,"error":{"code":"attachment_storage_unavailable","message":"Unavailable"}}`))
	}))
	defer server.Close()
	client, err := api.NewClient(server.URL, attachmentPartSecurity{})
	if err != nil {
		t.Fatal(err)
	}
	result, err := client.DownloadSentAttachmentPart(context.Background(), api.DownloadSentAttachmentPartParams{ID: uuid.MustParse("11111111-1111-4111-8111-111111111111"), PartIndex: 7})
	if err != nil {
		t.Fatal(err)
	}
	failure, ok := result.(*api.ErrorResponseHeaders)
	if !ok {
		t.Fatalf("Unexpected response type %T", result)
	}
	if failure.RetryAfter.Value != 3 || failure.Response.Error.Code != api.ErrorResponseErrorCodeAttachmentStorageUnavailable {
		t.Fatal("Error metadata changed")
	}
}

func TestAttachmentPartSentDiscovery(t *testing.T) {
	raw, err := os.ReadFile("../test-fixtures/sent-email-attachment.json")
	if err != nil {
		t.Fatal(err)
	}
	var document map[string]any
	if err = json.Unmarshal(raw, &document); err != nil {
		t.Fatal(err)
	}
	detailObject, ok := document["data"].(map[string]any)
	if !ok {
		t.Fatal("Missing fixture detail")
	}
	var partFixture struct {
		Bytes []int `json:"bytes"`
	}
	partRaw, err := os.ReadFile("../test-fixtures/attachment-part.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(partRaw, &partFixture); err != nil {
		t.Fatal(err)
	}
	expected := make([]byte, len(partFixture.Bytes))
	for i, b := range partFixture.Bytes {
		expected[i] = byte(b)
	}
	for _, available := range []bool{true, false} {
		detailObject["attachments_download_available"] = available
		responseJSON, err := json.Marshal(document)
		if err != nil {
			t.Fatal(err)
		}
		paths := []string{}
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			paths = append(paths, r.URL.Path)
			switch r.URL.Path {
			case "/sent-emails/11111111-1111-4111-8111-111111111111":
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write(responseJSON)
			case "/sent-emails/11111111-1111-4111-8111-111111111111/attachments/7":
				w.Header().Set("Content-Type", "application/octet-stream")
				_, _ = w.Write(expected)
			default:
				t.Errorf("Unexpected request %s", r.URL.Path)
				w.WriteHeader(404)
			}
		}))
		client, err := api.NewClient(server.URL, attachmentPartSecurity{})
		if err != nil {
			server.Close()
			t.Fatal(err)
		}
		response, err := client.GetSentEmail(context.Background(), api.GetSentEmailParams{ID: uuid.MustParse("11111111-1111-4111-8111-111111111111")})
		if err != nil {
			server.Close()
			t.Fatal(err)
		}
		read, ok := response.(*api.GetSentEmailOK)
		if !ok {
			server.Close()
			t.Fatalf("Unexpected detail response %T", response)
		}
		detail := read.Data
		if value, set := detail.AttachmentsDownloadAvailable.Get(); !set || value != available {
			t.Fatal("Lost archive availability")
		}
		if value, set := detail.AttachmentsSizeBytes.Get(); !set || value != 1024 {
			t.Fatal("Lost total accepted byte size")
		}
		if len(detail.Attachments) != 1 {
			t.Fatal("Lost attachment inventory")
		}
		metadata := detail.Attachments[0]
		if metadata.PartIndex != 7 || metadata.SizeBytes != len(expected) || metadata.ContentType != "application/octet-stream" || metadata.TarPath != "7/sample.bin" {
			t.Fatalf("Lost metadata: %+v", metadata)
		}
		downloaded, err := client.DownloadSentAttachmentPart(context.Background(), api.DownloadSentAttachmentPartParams{ID: detail.ID, PartIndex: int32(metadata.PartIndex)})
		if err != nil {
			server.Close()
			t.Fatal(err)
		}
		part, ok := downloaded.(*api.AttachmentPartHeaders)
		if !ok {
			server.Close()
			t.Fatalf("Unexpected download %T", downloaded)
		}
		actual, err := io.ReadAll(part.Response)
		server.Close()
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(actual, expected) {
			t.Fatal("Downloaded bytes changed")
		}
		if len(paths) != 2 || paths[1] != "/sent-emails/11111111-1111-4111-8111-111111111111/attachments/7" {
			t.Fatalf("Wrong read/download sequence: %v", paths)
		}
	}
}

func TestAttachmentPartOptionalSentInventory(t *testing.T) {
	raw, err := os.ReadFile("../test-fixtures/sent-email-attachment.json")
	if err != nil {
		t.Fatal(err)
	}
	var document struct {
		Data map[string]any `json:"data"`
	}
	if err = json.Unmarshal(raw, &document); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"attachments", "attachments_size_bytes", "attachments_download_available"} {
		delete(document.Data, key)
	}
	legacy, err := json.Marshal(document.Data)
	if err != nil {
		t.Fatal(err)
	}
	var detail api.SentEmailDetail
	if err = json.Unmarshal(legacy, &detail); err != nil {
		t.Fatal(err)
	}
	if detail.Attachments != nil || detail.AttachmentsSizeBytes.IsSet() || detail.AttachmentsDownloadAvailable.IsSet() {
		t.Fatal("Absent legacy metadata became a known inventory")
	}
	document.Data["attachments"] = []any{}
	document.Data["attachments_size_bytes"] = 0
	document.Data["attachments_download_available"] = false
	empty, err := json.Marshal(document.Data)
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(empty, &detail); err != nil {
		t.Fatal(err)
	}
	if detail.Attachments == nil || len(detail.Attachments) != 0 {
		t.Fatal("Lost explicit empty inventory")
	}
	if value, set := detail.AttachmentsDownloadAvailable.Get(); !set || value {
		t.Fatal("Lost explicit false availability")
	}
}
