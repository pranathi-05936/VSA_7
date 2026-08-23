Approach

I built this as a dependency-free static app: an Express server only wraps it for Docker/hosting — the app itself is vanilla HTML/CSS/JS, no framework, no LLM API calls.

**NLP:** The parsing engine lives in its own module (`public/js/nlp.js`), separate from the UI, with a 34-test automated suite (`npm test`, Node's built-in runner, zero install). It's order-independent — trigger words are found anywhere in a sentence rather than requiring a fixed structure — with a fuzzy edit-distance fallback for typos and ASR mishearings, word-boundary-safe matching (avoiding false substring hits), and explicit Unicode normalization for Hindi/Telugu (stripping the zero-width joiners speech recognition often inserts). Verb *stems*, not just dictionary roots, cover conjugated/polite forms in Hindi and Telugu.

**Catalog:** 110 items across 9 categories, with 55+ branded SKUs generated from a data table (one line adds a new brand everywhere), fruit/vegetable subcategorization, and size parsing distinct from quantity ("1 liter milk").

**Suggestions:** Three adaptive tiers — pairing/alternatives react to the actual cart contents (not a fixed list), seasonal combines calendar season with on-sale flags.

**Search & UI:** Voice-activated search supports brand, size, and price-range filtering, plus category-level queries ("find me fruits") and superlative selection ("cheapest toothpaste"). The interface is mobile-first and voice-primary, with a text fallback for accessibility.

**Deployment:** Dockerized (multi-stage build) with CI to GHCR, plus a GitHub Actions workflow that auto-deploys the static site to GitHub Pages on every push — a live URL with no manual hosting step.

**Trade-off:** catalog and history are mocked in-memory; production would swap these for a real inventory API.
