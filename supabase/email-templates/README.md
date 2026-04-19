# Grayveil email templates

Branded HTML for the five Supabase auth emails. Dark, monospace accents, Grayveil "V"
logo inline as SVG so Gmail/Outlook render it without external asset fetches.

## How to apply

Supabase Dashboard → Project `vumywqgphjxbcdjtcvyi` → **Authentication → Emails →
Templates**. Each template has its own tab. For each one, replace both the **Subject
heading** and the **Message body** with the values below, then click **Save changes**.

Supabase's default sender is `noreply@mail.app.supabase.io` and is rate-limited. For
real launch traffic, configure a custom SMTP provider under **Authentication →
Emails → SMTP Settings** (Resend, Postmark, SendGrid — any will work) and set the
from-address to something on `grayveil.net`.

## Subject lines

| Template      | File                  | Subject                                            |
| ------------- | --------------------- | -------------------------------------------------- |
| Confirm signup| `confirm-signup.html` | `Confirm your Grayveil Corporation clearance`      |
| Magic link    | `magic-link.html`     | `Your Grayveil access link`                        |
| Password reset| `recovery.html`       | `Grayveil credential reset`                        |
| Invite user   | `invite.html`         | `You've been invited to Grayveil Corporation`      |
| Email change  | `email-change.html`   | `Confirm your new Grayveil contact address`        |

## Template variables used

- `{{ .ConfirmationURL }}` — the primary action link (all templates)
- `{{ .Email }}` — previous email (email-change only)
- `{{ .NewEmail }}` — new email (email-change only)

Do not rename these — Supabase substitutes them server-side before sending.

## Design notes

- Dark `#05060a` canvas with a `#0f1015` card — survives both light and dark inbox modes
- `color-scheme: dark` + `supported-color-schemes: dark` hints for Gmail/Apple Mail
- Bulletproof button built with a nested `<table>` so Outlook renders the CTA
- Inline SVG logo (no external image = no Gmail proxy stripping)
- Monospace labels use `JetBrains Mono` where available, fall back cleanly to
  `Courier New` — matches the in-app aesthetic
- Accent colours: gold `#c8a55a` for routine confirmations, amber `#d48b3a` for
  security-sensitive (password reset)

## Updating

These files are the source of truth. If you tweak them, paste the new HTML back
into the dashboard — Supabase doesn't sync from this folder automatically.
