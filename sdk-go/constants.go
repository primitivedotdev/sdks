package primitive

const (
	WebhookVersion                 = "2025-12-14"
	PrimitiveSignatureHeader       = "Primitive-Signature"
	LegacySignatureHeader          = "MyMX-Signature"
	PrimitiveConfirmedHeader       = "X-Primitive-Confirmed"
	LegacyConfirmedHeader          = "X-MyMX-Confirmed"
	defaultToleranceSeconds  int64 = 5 * 60
	futureToleranceSeconds   int64 = 60
)
