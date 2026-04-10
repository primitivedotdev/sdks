package primitive

import "encoding/json"

type EventType string

const EventTypeEmailReceived EventType = "email.received"

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
	Attempt     int    `json:"attempt"`
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
	MaxInlineBytes int     `json:"max_inline_bytes"`
	SizeBytes      int     `json:"size_bytes"`
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
	SizeBytes   int     `json:"size_bytes"`
	SHA256      string  `json:"sha256"`
	PartIndex   int     `json:"part_index"`
	TarPath     string  `json:"tar_path"`
}

type ParsedError struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Retryable bool   `json:"retryable"`
}

type EmailAnalysis struct {
	Spamassassin *SpamAssassinAnalysis `json:"spamassassin,omitempty"`
	Forward      *ForwardAnalysis      `json:"forward,omitempty"`
}

type SpamAssassinAnalysis struct {
	Score float64 `json:"score"`
}

type ForwardAnalysis struct {
	Detected            bool            `json:"detected"`
	Results             []ForwardResult `json:"results"`
	AttachmentsFound    int             `json:"attachments_found"`
	AttachmentsAnalyzed int             `json:"attachments_analyzed"`
	AttachmentsLimit    *int            `json:"attachments_limit"`
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
	DMARCSpfAligned  bool            `json:"dmarcSpfAligned"`
	DMARCDkimAligned bool            `json:"dmarcDkimAligned"`
	DMARCSpfStrict   *bool           `json:"dmarcSpfStrict"`
	DMARCDkimStrict  *bool           `json:"dmarcDkimStrict"`
	DKIMSignatures   []DKIMSignature `json:"dkimSignatures"`
}

type DKIMSignature struct {
	Domain   string     `json:"domain"`
	Selector *string    `json:"selector,omitempty"`
	Result   DkimResult `json:"result"`
	Aligned  bool       `json:"aligned"`
	KeyBits  *int       `json:"keyBits,omitempty"`
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
	ToleranceSeconds int64
	NowSeconds       *int64
}

type HandleWebhookOptions struct {
	Body             any
	Headers          any
	Secret           any
	ToleranceSeconds int64
}
