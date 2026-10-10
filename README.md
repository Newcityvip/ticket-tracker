# ticket-tracker

Static support tracker: `index.html` contains the existing API integration and UI;
`privacy.js` centralizes display-only cleaning/masking; `styles.css` provides local
styles without a CDN or build step. Serve these three files together.

Privacy masking preserves line breaks and masks recognized English identifier
labels plus unlabeled email addresses and phone-like digit sequences, including
Bangla digits. All web URLs and known file paths are concealed conservatively.
Rich-text markup is reduced to escaped text; attachment-only messages retain a
translated placeholder. Existing reply selection and sender-role rules remain.

This is not an access-control boundary: raw API responses remain visible to the
browser. Unlabeled usernames and arbitrary identifiers in prose cannot reliably
be recognized. Numeric priorities without a verified mapping retain their original
value. No backend, endpoint, authentication, or deployment configuration changed.

Tests use synthetic responses only. With Node.js, Playwright and its Chromium
browser available, run `node tests/tracker.cjs` (use `NODE_PATH` if Playwright is
installed outside this repository). Tests cover masking, safe rendering, language,
reply counts, entry/deep links, refresh races, the 20-second timer, error states,
and mobile/desktop overflow. Local preview screenshots are ignored by Git.
