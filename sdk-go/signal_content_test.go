package primitive

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"net/mail"
	"os"
	"strings"
	"testing"
)

func TestSharedSignalContent(t *testing.T) {
	raw, err := os.ReadFile("../test-fixtures/signal-content.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures []struct {
		Name                   string
		Inventory              SignalContentInventory
		Bodies                 SignalContentBodies
		Source                 *string
		Hex                    *string
		Padding                int
		Classification, Reason string
		InteractionStatus      *string
	}
	if err = json.Unmarshal(raw, &fixtures); err != nil {
		t.Fatal(err)
	}
	for _, f := range fixtures {
		t.Run(f.Name, func(t *testing.T) {
			var source []byte
			if f.Hex != nil {
				source, err = hex.DecodeString(*f.Hex)
				if err != nil {
					t.Fatal(err)
				}
			} else if f.Source != nil {
				source = []byte(*f.Source + strings.Repeat(" ", f.Padding))
			}
			result := ClassifySignalContent(SignalContentInput{f.Inventory, f.Bodies, source})
			if result.Classification != f.Classification || result.Reason != f.Reason {
				t.Fatalf("got %s/%s, want %s/%s", result.Classification, result.Reason, f.Classification, f.Reason)
			}
			if f.InteractionStatus == nil {
				if result.Interaction != nil {
					t.Fatal("unexpected parse result")
				}
				return
			}
			if result.Interaction == nil || result.Interaction.Status != *f.InteractionStatus {
				t.Fatal("parse status mismatch", result.Interaction)
			}
			if result.Interaction.Status != "invalid" {
				if !bytes.Equal(result.Interaction.Source, source) {
					t.Fatal("source changed")
				}
				if len(source) > 0 {
					source[0] = '!'
					if result.Interaction.Source[0] == '!' {
						t.Fatal("source aliased")
					}
				}
			}
		})
	}
}
func TestSignalContentMIMEFixture(t *testing.T) {
	raw, err := os.ReadFile("../test-fixtures/signal-content.eml")
	if err != nil {
		t.Fatal(err)
	}
	message, err := mail.ReadMessage(bytes.NewReader(raw))
	if err != nil {
		t.Fatal(err)
	}
	_, parameters, err := mime.ParseMediaType(message.Header.Get("Content-Type"))
	if err != nil {
		t.Fatal(err)
	}
	reader := multipart.NewReader(message.Body, parameters["boundary"])
	var parts []SignalContentPart
	var text, html *string
	var source []byte
	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		media, _, err := mime.ParseMediaType(part.Header.Get("Content-Type"))
		if err != nil {
			t.Fatal(err)
		}
		var body io.Reader = part
		if part.Header.Get("Content-Transfer-Encoding") == "base64" {
			body = base64.NewDecoder(base64.StdEncoding, part)
		}
		content, err := io.ReadAll(body)
		if err != nil {
			t.Fatal(err)
		}
		if part.FileName() == "" {
			value := string(content)
			if media == "text/plain" {
				text = &value
			} else if media == "text/html" {
				html = &value
			}
			continue
		}
		filename := part.FileName()
		parts = append(parts, SignalContentPart{&filename, &media})
		source = content
	}
	if len(parts) != 1 {
		t.Fatal("fixture inventory")
	}
	result := ClassifySignalContent(SignalContentInput{SignalContentInventory{Status: "complete", Parts: parts}, SignalContentBodies{Status: "complete", Text: text, HTML: html}, source})
	if result.Classification != "informational_only" || result.Interaction == nil || !bytes.Equal(result.Interaction.Source, source) {
		t.Fatal(result)
	}
}
