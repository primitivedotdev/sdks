package primitive

const (
	WebhookVersion           = "2025-12-14"
	PrimitiveSignatureHeader = "Primitive-Signature"
	LegacySignatureHeader    = "MyMX-Signature"
	PrimitiveConfirmedHeader = "X-Primitive-Confirmed"
	LegacyConfirmedHeader    = "X-MyMX-Confirmed"
	// WebhookEventHeader names the webhook event for ALL event families
	// (email.*, payment.*, interaction.*). It is the primary discriminator the
	// parser keys on, because the stored body is sent verbatim with no envelope.
	WebhookEventHeader                   = "X-Webhook-Event"
	StandardWebhookIDHeader              = "webhook-id"
	StandardWebhookTimestampHeader       = "webhook-timestamp"
	StandardWebhookSignatureHeader       = "webhook-signature"
	whsecPrefix                          = "whsec_"
	defaultToleranceSeconds        int64 = 5 * 60
	futureToleranceSeconds         int64 = 60
)
