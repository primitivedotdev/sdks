import { describe, expect, it } from "vitest";
import {
  extractVerificationCode,
  extractVerificationLink,
  unwrapTrackingRedirect,
  type VerificationEmail,
} from "../../src/oclif/verification-extract.js";

// Fixture emails written for these tests. They follow the shape of common
// verification mail (code on its own line, footer with an address, social
// links, unsubscribe) without copying any real message.

const github: VerificationEmail = {
  subject: "[GitHub] Please verify your device",
  text: `Hey octo-agent!

A sign in attempt requires further verification because we did not recognize your device. To complete the sign in, enter the verification code on the unrecognized device.

Device: Chrome on macOS
Verification code: 482913

If you did not attempt to sign in to your account, your password may be compromised. Visit https://github.com/settings/security to create a new, strong password for your GitHub account.

Thanks,
The GitHub Team

GitHub, Inc. 88 Colin P Kelly Jr Street, San Francisco, CA 94107`,
};

const google: VerificationEmail = {
  subject: "Email verification code: 731406",
  html: `<html><body><table><tr><td><img src="https://www.gstatic.com/images/logo.png" width="74" height="24"></td></tr>
<tr><td style="font-size:24px">Verify your email</td></tr>
<tr><td>Google needs to verify your email address to finish setting up your account. Enter this code to finish setting up:</td></tr>
<tr><td style="font-size:36px;letter-spacing:3px">731406</td></tr>
<tr><td>This code will expire in 3 hours.</td></tr>
<tr><td>You received this email because agent@example.com was entered as a recovery email. <a href="https://support.google.com/accounts/answer/183723">Learn more</a></td></tr>
<tr><td>&copy; 2026 Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA</td></tr>
</table></body></html>`,
};

const slack: VerificationEmail = {
  subject: "Slack confirmation code: XKP-4QZ",
  text: `Confirm your email address

Your confirmation code is below. Enter it in your open browser window and we'll help you get signed in.

XKP-4QZ

If you didn't request this email, there's nothing to worry about. You can safely ignore it.

Made by Slack Technologies, LLC 500 Howard Street San Francisco, CA 94105

Our Blog https://slack.com/blog | Policies https://slack.com/legal | Help Center https://slack.com/help`,
};

const stripe: VerificationEmail = {
  subject: "Your Stripe verification code",
  text: `Hi there,

Here is the verification code you requested to sign in to your Stripe account:

598 274

This code expires in 10 minutes. If you didn't request it, you can ignore this email.

Questions? Visit https://support.stripe.com or call 1-888-555-0143.

Stripe, 354 Oyster Point Blvd, South San Francisco, CA 94080`,
};

const vercel: VerificationEmail = {
  subject: "Vercel Login Verification",
  html: `<html><body>
<p><a href="https://vercel.com"><img src="https://assets.vercel.com/logo.png" alt="Vercel"></a></p>
<h1>Verify your email to sign in to Vercel</h1>
<p>We have received a sign-in attempt from San Francisco, United States.</p>
<p>To complete the sign-in process, click the button below:</p>
<p><a href="https://vercel.com/notifications/email/click?url=https%3A%2F%2Fvercel.com%2Fconfirm%3Femail%3Dagent%2540example.com%26token%3D6f1aB9cQ2dE8xY4zK7mN0pR3sT5uV&amp;id=42">VERIFY</a></p>
<p>If you did not attempt to sign in, you can safely ignore this email.</p>
<p><a href="https://twitter.com/vercel">Twitter</a> &middot; <a href="https://vercel.com/legal/privacy-policy">Privacy</a> &middot; <a href="https://vercel.com/account/notifications?unsubscribe=1">Unsubscribe</a></p>
<img src="https://vercel.com/o/pixel.gif?e=abc123" width="1" height="1">
</body></html>`,
};

const genericMagicLink: VerificationEmail = {
  subject: "Your sign-in link for Acme",
  text: `Hi,

Click the link below to sign in to Acme. The link expires in 15 minutes and can be used once.

https://app.acme.example/auth/magic?token=Zx81kLmQ0pRsT2uVwXyZ3aBcDeFgHiJ

Not you? You can ignore this email.

Manage email preferences: https://app.acme.example/settings/notifications
Unsubscribe: https://app.acme.example/unsubscribe?u=123
Follow us: https://www.linkedin.com/company/acme`,
};

const orderNoise: VerificationEmail = {
  subject: "Confirm your purchase",
  text: `Thanks for your order!

Order #48392017 placed on 10/21/2026
Order total: $1,249.00 (1249 USD)
Questions? Call us at (415) 555-0199 or +1 415 555 0100.

To confirm this purchase, enter the security code below in the checkout window:

    660215

Ship to: 1200 Market Street, Suite 400, San Francisco, CA 94102

(c) 2026 Example Shop. All rights reserved.`,
};

const htmlOnlyDigitsPerCell: VerificationEmail = {
  subject: "Welcome to Example Cloud",
  html: `<div>
<p>Use this one-time passcode to verify your email address:</p>
<table><tr><td>9</td><td>0</td><td>5</td><td>3</td><td>1</td><td>7</td></tr></table>
<p>The passcode is valid for 10 minutes.</p>
<p style="color:#999">Example Cloud Inc., 2261 Market St #5000, San Francisco, CA 94114</p>
</div>`,
};

const splitCode: VerificationEmail = {
  subject: "Your login code",
  text: "Your code: 123 456\n\nIt expires in 5 minutes.",
};

const subjectFirst: VerificationEmail = {
  subject: "804119 is your Notion login code",
  text: "Enter the code above to log in. Sent from 2026.",
};

const newsletter: VerificationEmail = {
  subject: "October product update",
  text: `Big news for 2026! Over 120000 teams now use Example.

Read more: https://example.com/blog/october?utm_source=email
Call 1-800-555-0123 to talk to sales. Pricing from $49 per month.
Unsubscribe: https://example.com/unsubscribe`,
};

const zipCodeOnly: VerificationEmail = {
  subject: "Confirm your address",
  text: "Please confirm the shipping address on file.\nZip code 94107\nAccount 55120934",
};

const dashedWithNoise: VerificationEmail = {
  subject: "Your Widgetly sign-in code",
  text: `Welcome back to Widgetly! Order #5521 shipped on 22 Oct 2026. Support: +1 (628) 555-0142.

Use this one-time passcode to finish signing in: 4K7-P2Q

It expires in 15 minutes.`,
};

describe("extractVerificationCode", () => {
  it.each([
    ["GitHub device verification", github, "482913"],
    ["Google, HTML only, code also in subject", google, "731406"],
    ["Slack dashed alphanumeric code", slack, "XKP-4QZ"],
    ["Stripe code split as two groups with a phone number", stripe, "598274"],
    ["order total, year, phone numbers and order number", orderNoise, "660215"],
    ["HTML with one digit per cell", htmlOnlyDigitsPerCell, "905317"],
    ['code split as "123 456"', splitCode, "123456"],
    [
      "a dashed passcode kept as written among an order, date and phone",
      dashedWithNoise,
      "4K7-P2Q",
    ],
    ["code leading the subject", subjectFirst, "804119"],
  ])("%s", (_name, email, expected) => {
    expect(extractVerificationCode(email)).toBe(expected);
  });

  it.each([
    [
      "a newsletter with a year, a count, a phone number and a price",
      newsletter,
    ],
    ["a zip code and an account number", zipCodeOnly],
    ["a magic-link email without a code", genericMagicLink],
    ["an empty email", {}],
  ])("returns null for %s", (_name, email) => {
    expect(extractVerificationCode(email)).toBeNull();
  });

  it("does not take a standalone number without a code keyword near it", () => {
    expect(
      extractVerificationCode({
        text: "Your order has shipped.\n\n482913\n\nFor verification, contact support.",
      }),
    ).toBeNull();
  });

  it("takes a code labelled on the line below it", () => {
    expect(
      extractVerificationCode({
        subject: "Your request",
        text: "482913\nis your verification code",
      }),
    ).toBe("482913");
  });

  it("does not treat a line that supplies its own code as a label for the number above", () => {
    expect(
      extractVerificationCode({
        text: "Request reference:\n738296\nYour new reset code is 4455",
      }),
    ).toBe("4455");
  });

  it("keeps a code labelled below when the label states an expiry", () => {
    expect(
      extractVerificationCode({
        text: "482913\nis your verification code. Expires in 3600 seconds.",
      }),
    ).toBe("482913");
  });

  it("does not take an expiry for the code", () => {
    expect(
      extractVerificationCode({
        text: "Your verification code expires in 1440 minutes.",
      }),
    ).toBeNull();
  });

  it("reads the HTML part when the text part has no code", () => {
    expect(
      extractVerificationCode({
        subject: "Verify your email",
        text: "Please view this message in an HTML-capable email client.",
        html: "<p>Your verification code is</p><p><b>604172</b></p>",
      }),
    ).toBe("604172");
  });

  it("ignores digits inside links and email addresses", () => {
    expect(
      extractVerificationCode({
        text: "Your verification link: https://x.example/v/482913\nSent to 553201@example.com",
      }),
    ).toBeNull();
  });

  it("does not take a year after a code keyword over the real code", () => {
    expect(
      extractVerificationCode({
        text: "Security code for your 2026 login\n\n318227",
      }),
    ).toBe("318227");
  });

  it("does not read an account number as the code", () => {
    expect(
      extractVerificationCode({
        text: "Your account verification code is 274110. It was sent to account 99812345.",
      }),
    ).toBe("274110");
  });

  it("does not take a price or decimal for a code", () => {
    expect(
      extractVerificationCode({ text: "Your code total is 1234.50 USD" }),
    ).toBeNull();
  });
});

describe("extractVerificationLink", () => {
  it("unwraps the tracked VERIFY button and skips social, privacy, unsubscribe and pixel links", () => {
    expect(extractVerificationLink(vercel)).toBe(
      "https://vercel.com/confirm?email=agent%40example.com&token=6f1aB9cQ2dE8xY4zK7mN0pR3sT5uV",
    );
  });

  it("finds a bare magic link in a text email from the line above it", () => {
    expect(extractVerificationLink(genericMagicLink)).toBe(
      "https://app.acme.example/auth/magic?token=Zx81kLmQ0pRsT2uVwXyZ3aBcDeFgHiJ",
    );
  });

  it("prefers a confirm link over a homepage link", () => {
    expect(
      extractVerificationLink({
        html: `<a href="https://example.com/">Example</a>
<p>Confirm your email to activate your account.</p>
<a href="https://example.com/email/confirm?t=a1b2c3d4e5f6a1b2c3d4e5f6a1b2">Confirm email address</a>`,
      }),
    ).toBe("https://example.com/email/confirm?t=a1b2c3d4e5f6a1b2c3d4e5f6a1b2");
  });

  it("takes a password reset link and decodes HTML entities in the href", () => {
    expect(
      extractVerificationLink({
        html: `<a href="https://id.example.com/reset?user=7&amp;key=abc">Reset your password</a> <a href="https://id.example.com/help">Help</a>`,
      }),
    ).toBe("https://id.example.com/reset?user=7&key=abc");
  });

  it("returns null when only footer links remain", () => {
    expect(extractVerificationLink(newsletter)).toBeNull();
    expect(extractVerificationLink(github)).toBeNull();
    expect(extractVerificationLink({})).toBeNull();
  });

  it("decodes each href entity once", () => {
    expect(
      extractVerificationLink({
        html: `<a href="https://example.com/verify?a=1&amp;amp;b=2&#38;c=&amp;quot;">Verify</a>`,
      }),
    ).toBe("https://example.com/verify?a=1&amp;b=2&c=&quot;");
  });

  it("ignores mailto and non-web links", () => {
    expect(
      extractVerificationLink({
        html: `<a href="mailto:verify@example.com">Verify by email</a><a href="javascript:verify()">Verify</a>`,
      }),
    ).toBeNull();
  });
});

describe("unwrapTrackingRedirect", () => {
  it("unwraps a safelinks wrapper", () => {
    expect(
      unwrapTrackingRedirect(
        "https://nam02.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fverify%3Ft%3D1&data=05",
      ),
    ).toBe("https://example.com/verify?t=1");
  });

  it("unwraps a short click path with a url parameter", () => {
    expect(
      unwrapTrackingRedirect(
        "https://mail.example.com/c?u=https%3A%2F%2Fexample.com%2Flogin%2Fmagic",
      ),
    ).toBe("https://example.com/login/magic");
  });

  it("leaves OAuth and app redirect parameters alone", () => {
    const oauth =
      "https://auth.example.com/verify?token=abc&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback";
    expect(unwrapTrackingRedirect(oauth)).toBe(oauth);
    const next =
      "https://app.example.com/login/magic?code=1&next=https%3A%2F%2Fapp.example.com%2Fhome";
    expect(unwrapTrackingRedirect(next)).toBe(next);
  });

  it("leaves a tracking-looking URL alone when no URL is embedded", () => {
    const url = "https://click.example.com/c?id=123";
    expect(unwrapTrackingRedirect(url)).toBe(url);
  });
});
