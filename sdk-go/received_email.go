package primitive

import (
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
)

var (
	replyPrefixRe   = regexp.MustCompile(`(?i)^re\s*:`)
	forwardPrefixRe = regexp.MustCompile(`(?i)^(fwd?|fw)\s*:`)
	// Conservative addr-spec check: local-part @ domain . tld with no
	// whitespace, brackets, or `@` inside any of the parts. Mirrors the
	// validator/isEmail behaviour the Node SDK uses (require_tld) so all
	// three SDKs agree on what counts as a parseable header address.
	headerAddressRe   = regexp.MustCompile(`^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$`)
	angleAddressRe    = regexp.MustCompile(`<([^<>@\s]+@[^<>@\s]+\.[^<>@\s]+)>?\s*$`)
	bareAddressRe     = regexp.MustCompile(`^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$`)
	displayNamePrefix = regexp.MustCompile(`^(.+?)\s*<[^>]*>?\s*$`)
)

const maxHeaderBytes = 998

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

	return NormalizeReceivedEmail(*event)
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

// NormalizeReceivedEmail builds a ReceivedEmail from a validated webhook
// event. It returns an error rather than panicking when required fields
// (SMTP recipients) are missing so callers running with hand-built events,
// replays, or test fixtures get a recoverable failure instead of a process
// crash.
func NormalizeReceivedEmail(event EmailReceivedEvent) (*ReceivedEmail, error) {
	if len(event.Email.SMTP.RcptTo) == 0 {
		return nil, fmt.Errorf("email.smtp.rcpt_to must contain at least one recipient")
	}

	sender := ParseHeaderAddress(event.Email.Headers.From)
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
	}, nil
}

func BuildReplySubject(subject string) string {
	trimmed := strings.TrimSpace(subject)
	if trimmed == "" {
		return "Re:"
	}
	if replyPrefixRe.MatchString(trimmed) {
		return trimmed
	}
	return "Re: " + trimmed
}

func BuildForwardSubject(subject string) string {
	trimmed := strings.TrimSpace(subject)
	if trimmed == "" {
		return "Fwd:"
	}
	if forwardPrefixRe.MatchString(trimmed) {
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

// ParseHeaderAddress parses a single RFC 5322 header address (From, Sender,
// Reply-To). Lenient about quirky headers (unquoted commas in display names,
// missing closing angle brackets) but strict about the resulting address: the
// extracted addr-spec must look like a real email or this returns nil and the
// normalizer falls back to the SMTP envelope sender.
func ParseHeaderAddress(value string) *ReceivedEmailAddress {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || len(trimmed) > maxHeaderBytes {
		return nil
	}

	if addrs, err := mail.ParseAddressList(trimmed); err == nil {
		for _, addr := range addrs {
			candidate := strings.TrimSpace(addr.Address)
			if headerAddressRe.MatchString(candidate) {
				return &ReceivedEmailAddress{
					Address: strings.ToLower(candidate),
					Name:    strings.TrimSpace(addr.Name),
				}
			}
		}
	}

	if m := angleAddressRe.FindStringSubmatch(trimmed); len(m) == 2 {
		candidate := m[1]
		if headerAddressRe.MatchString(candidate) {
			return &ReceivedEmailAddress{
				Address: strings.ToLower(candidate),
				Name:    extractDisplayNamePrefix(trimmed),
			}
		}
	}

	if bareAddressRe.MatchString(trimmed) {
		return &ReceivedEmailAddress{
			Address: strings.ToLower(trimmed),
			Name:    "",
		}
	}

	return nil
}

func extractDisplayNamePrefix(value string) string {
	m := displayNamePrefix.FindStringSubmatch(value)
	if len(m) != 2 {
		return ""
	}
	return strings.Trim(strings.TrimSpace(m[1]), `"`)
}

// parseHeaderAddress preserves the prior internal entry point.
func parseHeaderAddress(value string) *ReceivedEmailAddress {
	return ParseHeaderAddress(value)
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
