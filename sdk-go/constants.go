package primitive

const (
	WebhookVersion                 = "2025-12-14"
	PrimitiveSignatureHeader       = "Primitive-Signature"
	PrimitiveConfirmedHeader       = "X-Primitive-Confirmed"
	defaultToleranceSeconds  int64 = 5 * 60
	futureToleranceSeconds   int64 = 60
)
