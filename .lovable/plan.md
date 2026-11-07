# GO-PHONE-SHELL-1106 verification (no edits, no publish)

Read-only verification against the sandbox build of commit 43729f37. No project files change and nothing gets published. The report pastes raw output only.

## Steps

1. **Static shell HTML.** Build to a temporary output folder under /tmp, leaving the project build output alone. For each of the 8 routes (/go/straight-talk, /go/simple-mobile, /go/ultra, /go/h2o, plus their /es/go/ twins):
   - Print the exact `[data-go-sms-shell]` outer HTML.
   - Parse the pre-JS HTML with a parser (not regex) and count four things: `[data-go-sms-shell]`, then `input`, `label` and `[data-testid=sms-optin]` inside the shell. Expected counts are 1 / 0 / 0 / 0.
   - Also report the page-wide `input`, `label` and `sms-optin` counts for context.

2. **Disclosure parity.** Extract the EN and ES disclosure JSX children from `DynamicCarrier.tsx` and `GoLander.tsx`. Normalize them to rendered text and run `diff -u` for each language. Then confirm which component renders each /go route according to `App.tsx` routing.

3. **After React loads.** Run Playwright against the local preview with the viewport set to 1280x1800, plus one mobile 390x844 pass. For each route, report:
   - The count of `[data-go-sms-shell]`. Expected: 0.
   - The count of `[data-testid=sms-optin]` checkboxes and their checked/disabled state. Expected: 1, unchecked, enabled.
   - The cumulative layout-shift entries, and the largest-contentful-paint element and its size. These come from a PerformanceObserver that is registered before any page script runs, scoped to localhost only.

4. **Leftover JSX check.** Grep each extracted shell block for `{`, `}`, `className=`, `{/*` and `&&`, and print the matches, or "none".

## Notes
- The local preview is not the production CDN, so the LCP and CLS numbers are indicative only. Any mismatch or failure is reported exactly as observed, with no fixes applied.
