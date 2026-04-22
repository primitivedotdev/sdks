package primitive

import (
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"strings"
)

type ReceivedEmailAddress struct {
	Address string
	Name    string
}

type ReceivedEmailThread struct {
	MessageID  string
	InReplyTo  []string
	References []string
}

type ReceivedEmail struct {
	ID             string
	EventID        string
	ReceivedAt     string
	Sender         ReceivedEmailAddress
	ReplyTarget    ReceivedEmailAddress
	ReceivedBy     string
	ReceivedByAll  []string
	Subject        string
	ReplySubject   string
	ForwardSubject string
	Text           string
	Thread         ReceivedEmailThread
	Attachments    []WebhookAttachment
	Auth           EmailAuth
	Analysis       EmailAnalysis
	Raw            EmailReceivedEvent
}

type ReceiveRequestOptions struct {
	Secret           string
	ToleranceSeconds *int64
}

func Receive(options HandleWebhookOptions) (*ReceivedEmail, error) {
	event, err := HandleWebhook(options)
	if err != nil {
		return nil, err
	}

	return NormalizeReceivedEmail(*event), nil
}

func ReceiveFromHTTPRequest(request *http.Request, options ReceiveRequestOptions) (*ReceivedEmail, error) {
	if request == nil {
		return nil, fmt.Errorf("request is required")
	}
	if options.Secret == "" {
		return nil, NewWebhookVerificationError(
			"MISSING_SECRET",
			"Webhook secret is required but was empty or not provided",
			"",
		)
	}

	body, err := io.ReadAll(request.Body)
	if err != nil {
		return nil, err
	}

	return Receive(HandleWebhookOptions{
		Body:             body,
		Headers:          request.Header,
		Secret:           options.Secret,
		ToleranceSeconds: options.ToleranceSeconds,
	})
}

func NormalizeReceivedEmail(event EmailReceivedEvent) *ReceivedEmail {
	sender := parseHeaderAddress(event.Email.Headers.From)
	if sender == nil {
		sender = &ReceivedEmailAddress{Address: strings.ToLower(strings.TrimSpace(event.Email.SMTP.MailFrom))}
	}

	replyTarget := sender
	if len(event.Email.Parsed.ReplyTo) > 0 {
		replyTarget = &ReceivedEmailAddress{
			Address: strings.ToLower(strings.TrimSpace(event.Email.Parsed.ReplyTo[0].Address)),
			Name:    deref(event.Email.Parsed.ReplyTo[0].Name),
		}
	}

	messageID := deref(event.Email.Headers.MessageID)
	references := append([]string{}, event.Email.Parsed.References...)

	return &ReceivedEmail{
		ID:             event.Email.ID,
		EventID:        event.ID,
		ReceivedAt:     event.Email.ReceivedAt,
		Sender:         *sender,
		ReplyTarget:    *replyTarget,
		ReceivedBy:     event.Email.SMTP.RcptTo[0],
		ReceivedByAll:  append([]string{}, event.Email.SMTP.RcptTo...),
		Subject:        deref(event.Email.Headers.Subject),
		ReplySubject:   BuildReplySubject(deref(event.Email.Headers.Subject)),
		ForwardSubject: BuildForwardSubject(deref(event.Email.Headers.Subject)),
		Text:           deref(event.Email.Parsed.BodyText),
		Thread: ReceivedEmailThread{
			MessageID:  messageID,
			InReplyTo:  append([]string{}, event.Email.Parsed.InReplyTo...),
			References: references,
		},
		Attachments: append([]WebhookAttachment{}, event.Email.Parsed.Attachments...),
		Auth:        event.Email.Auth,
		Analysis:    event.Email.Analysis,
		Raw:         event,
	}
}

func BuildReplySubject(subject string) string {
	trimmed := strings.TrimSpace(subject)
	if trimmed == "" {
		return "Re:"
	}
	if strings.HasPrefix(strings.ToLower(trimmed), "re:") {
		return trimmed
	}
	return "Re: " + trimmed
}

func BuildForwardSubject(subject string) string {
	trimmed := strings.TrimSpace(subject)
	if trimmed == "" {
		return "Fwd:"
	}
	lowered := strings.ToLower(trimmed)
	if strings.HasPrefix(lowered, "fwd:") || strings.HasPrefix(lowered, "fw:") {
		return trimmed
	}
	return "Fwd: " + trimmed
}

func FormatAddress(address ReceivedEmailAddress) string {
	if address.Name == "" {
		return address.Address
	}
	return fmt.Sprintf("%s <%s>", address.Name, address.Address)
}

func parseHeaderAddress(value string) *ReceivedEmailAddress {
	addresses, err := mail.ParseAddressList(value)
	if err != nil || len(addresses) == 0 {
		return nil
	}

	return &ReceivedEmailAddress{
		Address: strings.ToLower(strings.TrimSpace(addresses[0].Address)),
		Name:    strings.TrimSpace(addresses[0].Name),
	}
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
