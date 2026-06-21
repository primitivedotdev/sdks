package primitive

import (
	"bytes"
	"encoding/json"
)

type EventType string

const (
	// EventTypeEmailReceived is a normal inbound email.
	EventTypeEmailReceived EventType = "email.received"
	// EventTypeEmailBounced is a delivery status notification (DSN) reporting
	// that a message delivery failed. Carries Email.Analysis.Bounce.
	EventTypeEmailBounced EventType = "email.bounced"
	// EventTypeEmailTLSReport is an SMTP TLS report (RFC 8460). Carries
	// Email.Analysis.TLSReport.
	EventTypeEmailTLSReport EventType = "email.tls_report"
	// EventTypeEmailDMARCReport is a DMARC aggregate report (RFC 7489). Carries
	// Email.Analysis.DMARCReport.
	EventTypeEmailDMARCReport EventType = "email.dmarc_report"
	// EventTypeEmailDMARCFailure is a DMARC failure (forensic) report.
	EventTypeEmailDMARCFailure EventType = "email.dmarc_failure"
)

type ParsedStatus string

const (
	ParsedStatusComplete ParsedStatus = "complete"
	ParsedStatusFailed   ParsedStatus = "failed"
)

type ForwardVerdict string

const (
	ForwardVerdictLegit   ForwardVerdict = "legit"
	ForwardVerdictUnknown ForwardVerdict = "unknown"
)

type SpfResult string

const (
	SpfResultPass      SpfResult = "pass"
	SpfResultFail      SpfResult = "fail"
	SpfResultSoftfail  SpfResult = "softfail"
	SpfResultNeutral   SpfResult = "neutral"
	SpfResultNone      SpfResult = "none"
	SpfResultTemperror SpfResult = "temperror"
	SpfResultPermerror SpfResult = "permerror"
)

type DmarcResult string

const (
	DmarcResultPass      DmarcResult = "pass"
	DmarcResultFail      DmarcResult = "fail"
	DmarcResultNone      DmarcResult = "none"
	DmarcResultTemperror DmarcResult = "temperror"
	DmarcResultPermerror DmarcResult = "permerror"
)

type DmarcPolicy string

const (
	DmarcPolicyReject     DmarcPolicy = "reject"
	DmarcPolicyQuarantine DmarcPolicy = "quarantine"
	DmarcPolicyNone       DmarcPolicy = "none"
)

type DkimResult string

const (
	DkimResultPass      DkimResult = "pass"
	DkimResultFail      DkimResult = "fail"
	DkimResultTemperror DkimResult = "temperror"
	DkimResultPermerror DkimResult = "permerror"
)

type AuthConfidence string

const (
	AuthConfidenceHigh   AuthConfidence = "high"
	AuthConfidenceMedium AuthConfidence = "medium"
	AuthConfidenceLow    AuthConfidence = "low"
)

type AuthVerdict string

const (
	AuthVerdictLegit      AuthVerdict = "legit"
	AuthVerdictSuspicious AuthVerdict = "suspicious"
	AuthVerdictUnknown    AuthVerdict = "unknown"
)

type ValidateEmailAuthResult struct {
	Verdict    AuthVerdict    `json:"verdict"`
	Confidence AuthConfidence `json:"confidence"`
	Reasons    []string       `json:"reasons"`
}

type WebhookEvent interface {
	GetEvent() string
}

type UnknownEvent struct {
	Event   string         `json:"event"`
	ID      *string        `json:"id,omitempty"`
	Version *string        `json:"version,omitempty"`
	Payload map[string]any `json:"-"`
}

func (e UnknownEvent) GetEvent() string { return e.Event }

func (e UnknownEvent) MarshalJSON() ([]byte, error) {
	payload := map[string]any{}
	for key, value := range e.Payload {
		payload[key] = value
	}
	payload["event"] = e.Event
	if e.ID != nil {
		payload["id"] = *e.ID
	}
	if e.Version != nil {
		payload["version"] = *e.Version
	}
	return json.Marshal(payload)
}

func (e *UnknownEvent) UnmarshalJSON(data []byte) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	var payload map[string]any
	if err := decoder.Decode(&payload); err != nil {
		return err
	}
	e.Payload = payload
	if event, ok := payload["event"].(string); ok {
		e.Event = event
	} else {
		e.Event = ""
	}
	if id, ok := payload["id"].(string); ok {
		e.ID = &id
	} else {
		e.ID = nil
	}
	if version, ok := payload["version"].(string); ok {
		e.Version = &version
	} else {
		e.Version = nil
	}
	return nil
}

type EmailReceivedEvent struct {
	ID       string   `json:"id"`
	Event    string   `json:"event"`
	Version  string   `json:"version"`
	Delivery Delivery `json:"delivery"`
	Email    Email    `json:"email"`
}

func (e EmailReceivedEvent) GetEvent() string { return e.Event }

type Delivery struct {
	EndpointID  string `json:"endpoint_id"`
	Attempt     int64  `json:"attempt"`
	AttemptedAt string `json:"attempted_at"`
}

type Email struct {
	ID         string        `json:"id"`
	ReceivedAt string        `json:"received_at"`
	SMTP       SMTPEnvelope  `json:"smtp"`
	Headers    EmailHeaders  `json:"headers"`
	Content    EmailContent  `json:"content"`
	Parsed     ParsedData    `json:"parsed"`
	Analysis   EmailAnalysis `json:"analysis"`
	Auth       EmailAuth     `json:"auth"`
}

type SMTPEnvelope struct {
	Helo     *string  `json:"helo"`
	MailFrom string   `json:"mail_from"`
	RcptTo   []string `json:"rcpt_to"`
}

type EmailHeaders struct {
	MessageID *string `json:"message_id"`
	Subject   *string `json:"subject"`
	From      string  `json:"from"`
	To        string  `json:"to"`
	Date      *string `json:"date"`
}

type EmailContent struct {
	Raw      RawContent   `json:"raw"`
	Download DownloadInfo `json:"download"`
}

type DownloadInfo struct {
	URL       string `json:"url"`
	ExpiresAt string `json:"expires_at"`
}

type RawContent struct {
	Included       bool    `json:"included"`
	Encoding       *string `json:"encoding,omitempty"`
	ReasonCode     *string `json:"reason_code,omitempty"`
	MaxInlineBytes int64   `json:"max_inline_bytes"`
	SizeBytes      int64   `json:"size_bytes"`
	SHA256         string  `json:"sha256"`
	Data           *string `json:"data,omitempty"`
}

type ParsedData struct {
	Status                 ParsedStatus        `json:"status"`
	Error                  *ParsedError        `json:"error"`
	BodyText               *string             `json:"body_text"`
	BodyHTML               *string             `json:"body_html"`
	ReplyTo                []EmailAddress      `json:"reply_to"`
	CC                     []EmailAddress      `json:"cc"`
	BCC                    []EmailAddress      `json:"bcc"`
	ToAddresses            []EmailAddress      `json:"to_addresses"`
	InReplyTo              []string            `json:"in_reply_to"`
	References             []string            `json:"references"`
	Attachments            []WebhookAttachment `json:"attachments"`
	AttachmentsDownloadURL *string             `json:"attachments_download_url"`
}

type EmailAddress struct {
	Address string  `json:"address"`
	Name    *string `json:"name"`
}

type WebhookAttachment struct {
	Filename    *string `json:"filename"`
	ContentType string  `json:"content_type"`
	SizeBytes   int64   `json:"size_bytes"`
	SHA256      string  `json:"sha256"`
	PartIndex   int64   `json:"part_index"`
	TarPath     string  `json:"tar_path"`
}

type ParsedError struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Retryable bool   `json:"retryable"`
}

// EmailAnalysis contains email analysis and classification results.
//
// All fields are optional (pointer types). Which fields are present depends on
// the analysis pipeline processing the email. Primitive's managed service
// populates all fields. Self-hosted or third-party deployments may include
// some, all, or none of these fields depending on their pipeline configuration.
//
// A nil field means that particular analysis was not performed, not that
// analysis produced no results.
type EmailAnalysis struct {
	// Spamassassin holds SpamAssassin analysis results.
	// Optional. Present when the email was processed by a SpamAssassin-equipped
	// pipeline (always present in Primitive's managed service).
	Spamassassin *SpamAssassinAnalysis `json:"spamassassin,omitempty"`

	// Forward holds forward detection and analysis results.
	// Optional. Present when the email was processed by a forward-detection
	// pipeline (always present in Primitive's managed service).
	Forward *ForwardAnalysis `json:"forward,omitempty"`

	// Bounce holds parsed delivery status notification (bounce) details.
	// Present on email.bounced events; absent on all other event types.
	Bounce *BounceAnalysis `json:"bounce,omitempty"`

	// TLSReport holds parsed SMTP TLS report (RFC 8460) details.
	// Present on email.tls_report events; absent on all other event types.
	TLSReport *TLSReportAnalysis `json:"tls_report,omitempty"`

	// DMARCReport holds parsed DMARC aggregate report (RFC 7489) details.
	// Present on email.dmarc_report events; absent on all other event types.
	DMARCReport *DMARCReportAnalysis `json:"dmarc_report,omitempty"`
}

// BounceAnalysis is the parsed delivery status notification carried on
// email.bounced events.
type BounceAnalysis struct {
	IsBounce          bool     `json:"is_bounce"`
	Kind              string   `json:"kind"`
	Type              string   `json:"type"`
	Category          string   `json:"category"`
	ClassifiedBy      string   `json:"classified_by"`
	FailedRecipient   *string  `json:"failed_recipient"`
	SMTPCode          *int64   `json:"smtp_code"`
	StatusCode        *string  `json:"status_code"`
	DiagnosticCode    *string  `json:"diagnostic_code"`
	ReportedByMTA     *string  `json:"reported_by_mta"`
	OriginalMessageID *string  `json:"original_message_id"`
	Reasons           []string `json:"reasons"`
}

// TLSReportAnalysis is the parsed SMTP TLS report carried on email.tls_report
// events.
type TLSReportAnalysis struct {
	Kind                    string            `json:"kind"`
	Organization            *string           `json:"organization"`
	ReportID                *string           `json:"report_id"`
	Contact                 *string           `json:"contact"`
	DateRange               ReportDateRange   `json:"date_range"`
	TotalSuccessfulSessions int64             `json:"total_successful_sessions"`
	TotalFailedSessions     int64             `json:"total_failed_sessions"`
	Policies                []TLSReportPolicy `json:"policies"`
}

type TLSReportPolicy struct {
	PolicyDomain       *string            `json:"policy_domain"`
	PolicyType         *string            `json:"policy_type"`
	SuccessfulSessions int64              `json:"successful_sessions"`
	FailedSessions     int64              `json:"failed_sessions"`
	Failures           []TLSReportFailure `json:"failures"`
}

type TLSReportFailure struct {
	ResultType          *string `json:"result_type"`
	Count               int64   `json:"count"`
	SendingMTAIP        *string `json:"sending_mta_ip"`
	ReceivingMXHostname *string `json:"receiving_mx_hostname"`
}

// DMARCReportAnalysis is the parsed DMARC aggregate report carried on
// email.dmarc_report events.
type DMARCReportAnalysis struct {
	Kind            string               `json:"kind"`
	Organization    *string              `json:"organization"`
	ReportID        *string              `json:"report_id"`
	DateRange       ReportDateRange      `json:"date_range"`
	PolicyPublished DMARCPolicyPublished `json:"policy_published"`
	TotalCount      int64                `json:"total_count"`
	DKIMPassCount   int64                `json:"dkim_pass_count"`
	SPFPassCount    int64                `json:"spf_pass_count"`
	Records         []DMARCRecord        `json:"records"`
}

type DMARCPolicyPublished struct {
	Domain *string `json:"domain"`
	P      *string `json:"p"`
	SP     *string `json:"sp"`
	Pct    *int64  `json:"pct"`
	Adkim  *string `json:"adkim"`
	Aspf   *string `json:"aspf"`
}

type DMARCRecord struct {
	SourceIP    *string `json:"source_ip"`
	Count       int64   `json:"count"`
	Disposition *string `json:"disposition"`
	DKIM        *string `json:"dkim"`
	SPF         *string `json:"spf"`
	HeaderFrom  *string `json:"header_from"`
}

// ReportDateRange is the reporting window shared by TLS and DMARC reports.
type ReportDateRange struct {
	Start *string `json:"start"`
	End   *string `json:"end"`
}

type SpamAssassinAnalysis struct {
	Score float64 `json:"score"`
}

type ForwardAnalysis struct {
	Detected            bool            `json:"detected"`
	Results             []ForwardResult `json:"results"`
	AttachmentsFound    int64           `json:"attachments_found"`
	AttachmentsAnalyzed int64           `json:"attachments_analyzed"`
	AttachmentsLimit    *int64          `json:"attachments_limit"`
}

type ForwardResult struct {
	Type               string                 `json:"type"`
	AttachmentTarPath  *string                `json:"attachment_tar_path,omitempty"`
	AttachmentFilename *string                `json:"attachment_filename,omitempty"`
	Analyzed           *bool                  `json:"analyzed,omitempty"`
	OriginalSender     *ForwardOriginalSender `json:"original_sender"`
	Verification       *ForwardVerification   `json:"verification"`
	Summary            string                 `json:"summary"`
}

func (r ForwardResult) MarshalJSON() ([]byte, error) {
	payload := map[string]any{
		"type":            r.Type,
		"original_sender": r.OriginalSender,
		"verification":    r.Verification,
		"summary":         r.Summary,
	}

	if r.Type == "attachment" {
		payload["attachment_tar_path"] = r.AttachmentTarPath
		payload["attachment_filename"] = r.AttachmentFilename
		payload["analyzed"] = r.Analyzed
	}

	return json.Marshal(payload)
}

type ForwardOriginalSender struct {
	Email  string `json:"email"`
	Domain string `json:"domain"`
}

type ForwardVerification struct {
	Verdict      ForwardVerdict `json:"verdict"`
	Confidence   AuthConfidence `json:"confidence"`
	DKIMVerified bool           `json:"dkim_verified"`
	DKIMDomain   *string        `json:"dkim_domain"`
	DMARCPolicy  *DmarcPolicy   `json:"dmarc_policy"`
}

type EmailAuth struct {
	SPF              SpfResult       `json:"spf"`
	DMARC            DmarcResult     `json:"dmarc"`
	DMARCPolicy      *DmarcPolicy    `json:"dmarcPolicy"`
	DMARCFromDomain  *string         `json:"dmarcFromDomain"`
	DMARCSpfAligned  *bool           `json:"dmarcSpfAligned,omitempty"`
	DMARCDkimAligned *bool           `json:"dmarcDkimAligned,omitempty"`
	DMARCSpfStrict   *bool           `json:"dmarcSpfStrict"`
	DMARCDkimStrict  *bool           `json:"dmarcDkimStrict"`
	DKIMSignatures   []DKIMSignature `json:"dkimSignatures"`
}

type DKIMSignature struct {
	Domain   string     `json:"domain"`
	Selector *string    `json:"selector,omitempty"`
	Result   DkimResult `json:"result"`
	Aligned  bool       `json:"aligned"`
	KeyBits  *int64     `json:"keyBits,omitempty"`
	Algo     *string    `json:"algo,omitempty"`
}

type ValidationResult[T any] struct {
	Success bool
	Data    T
	Error   *WebhookValidationError
}

type SignResult struct {
	Header    string `json:"header"`
	Timestamp int64  `json:"timestamp"`
	V1        string `json:"v1"`
}

type VerifyOptions struct {
	RawBody          any
	SignatureHeader  string
	Secret           any
	ToleranceSeconds *int64
	NowSeconds       *int64
}

type HandleWebhookOptions struct {
	Body             any
	Headers          any
	Secret           any
	ToleranceSeconds *int64
}

type StandardWebhooksVerifyOptions struct {
	RawBody          any
	MsgID            string
	Timestamp        string
	SignatureHeader  string
	Secret           any
	ToleranceSeconds *int64
	NowSeconds       *int64
}

type StandardWebhooksSignResult struct {
	Signature string `json:"signature"`
	MsgID     string `json:"msg_id"`
	Timestamp int64  `json:"timestamp"`
}
