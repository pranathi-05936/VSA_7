# Voice Shopping Assistant

A voice-based shopping list manager with smart suggestions. Speak naturally to add,
remove, modify, and search items in English, Hindi, or Telugu — the app parses the
command, categorizes the item, and surfaces suggestions that actually adapt to what's
in your cart.

**Live demo:** deployed automatically to GitHub Pages on every push to `main` — see
[Live URL](#live-url) below.

---

## Tech Stack

| Layer            | Technology                                              |
| ----------------- | -------------------------------------------------------- |
| Frontend          | Vanilla HTML/CSS/JS (no build step, no framework)        |
| NLP engine        | Standalone module (`public/js/nlp.js`), unit-tested      |
| Voice recognition | Web Speech API (browser-native)                          |
| Testing           | Node's built-in test runner — zero dependencies          |
| Server            | Node.js + Express (static file server, for Docker)       |
| Container         | Docker (multi-stage) + Docker Compose                    |
| CI                | GitHub Actions — Docker image to GHCR, static site to Pages |

No database, no API keys, no LLM calls — the NLP is a fast, free, offline-capable rule
engine, not an API round-trip. The product catalog, purchase history, and stock status
are mocked in-memory.

---

## Testing

The NLP engine (`public/js/nlp.js`) is a standalone module, not buried in the page —
so it has a real, runnable test suite:

```bash
npm test
```

21 tests, zero install required (Node's built-in test runner, not Jest — nothing to
fail to resolve from a registry). Every test documents the actual bug it was written
to catch — order-independent parsing, Hindi/Telugu verb-stem conjugations, zero-width
Unicode artifacts from ASR, brand resolution, fuzzy-typo tolerance, and a false-positive
regression in the fuzzy matcher itself. See `tests/nlp.test.js`.

---

## Live URL

`.github/workflows/pages-deploy.yml` deploys `public/` to GitHub Pages automatically on
every push to `main`. After your first push:

1. Go to your repo's **Settings → Pages**
2. Under "Build and deployment", set **Source** to "GitHub Actions" (if not already)
3. Your live URL will be `https://<pranathi-05936>.github.io/voice-shopping-assistant/`

No server, no hosting cost, no manual deploy step.

---

## Local Setup

### Prerequisites

- Node.js 20+
- npm
- (optional) Docker Desktop

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/voice-shopping-assistant.git
cd voice-shopping-assistant
npm install
```

### 2. Start the dev server

```bash
npm start
```

Open <http://localhost:3000> in Chrome or Edge (best Web Speech API support).

---

## Running with Docker

### Local development

```bash
docker compose up --build
```

The app is available at `http://localhost:3000`.

### Build and run the image directly

```bash
docker build -t voice-shopping-assistant .
docker run -p 3000:3000 voice-shopping-assistant
```

### Production deployment (Render/Railway/Fly.io)

The same `Dockerfile` works on any Docker-compatible host:

1. Push your image to GHCR (automatically via the GitHub Actions workflow on push to `main`)
2. On Render/Railway, create a new Web Service → Docker → point to your GHCR image
3. No environment variables are required — the app is fully static/client-side

---

## Project Structure

```
.
├── .github/workflows/
│   ├── docker-publish.yml     # CI: build + push Docker image to GHCR
│   └── pages-deploy.yml       # CI: deploy public/ to GitHub Pages (live URL)
├── public/
│   ├── index.html             # UI, state, speech recognition, rendering
│   └── js/nlp.js              # standalone NLP engine — catalog, parsing, matching
├── tests/
│   └── nlp.test.js            # 21 tests against the real nlp.js module
├── server.js                  # Express static file server (for Docker)
├── package.json
├── Dockerfile                 # multi-stage Node build
├── docker-compose.yml
├── .dockerignore
├── .gitignore
├── README.md
└── APPROACH.md                # 200-word approach write-up
```

`public/js/nlp.js` has no DOM or speech-API dependency — it's pure catalog/parsing
logic, loaded by the page via `<script src="js/nlp.js">` and required directly by the
test suite. This split is what makes the NLP layer independently testable instead of
buried inside a single HTML file's inline script.

---

## How It Works

| Feature              | Approach                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| Voice input           | Browser `SpeechRecognition`, interim + final results, language picker for multilingual input                 |
| NLP                   | Order-independent trigger scan across English/Hindi/Telugu/Spanish/French — not anchored to sentence start, so rephrasing and word order don't break it |
| Catalog matching       | Exact → word-boundary-safe substring → edit-distance fuzzy fallback (typo/ASR-mishearing tolerant); 75 items across 8 categories, 26 branded SKUs generated from a data table |
| Size vs. quantity      | "1 liter milk" parses size (1L) separately from item count — not confused with "add 2 milk"                |
| Smart suggestions      | Adapts to the actual cart: pairing suggestions ("add pasta" → offers ketchup) take priority, then simulated purchase-cadence "running low", then seasonal, then a staples fallback so the rail is never empty |
| Modify                 | "change milk to 3" sets quantity directly — distinct from add/remove per the spec                            |
| Categorization         | Each catalog item carries a category; list view groups and re-sorts live                                    |
| Search & price filter  | "find toothpaste under $5" parses into item query + max price + brand, rendered as a results panel with one-tap add |
| Error handling         | No `SpeechRecognition` support, mic permission denial, no-speech timeout, unrecognized commands all show a specific message; text-input fallback always works |
| Accessibility          | Visible focus rings, `aria-live` caption region, `aria-pressed` mic state, reduced-motion respected          |

---

## Features Implemented

| Feature                              | Status |
| ------------------------------------- | ------ |
| Voice command recognition             | ✅      |
| Natural language phrasing flexibility | ✅      |
| Multilingual voice input              | ✅      |
| Product recommendations (running low) | ✅      |
| Seasonal recommendations              | ✅      |
| Substitute suggestions                | ✅      |
| Add / remove / modify by voice        | ✅      |
| Auto-categorization                   | ✅      |
| Quantity parsing                      | ✅      |
| Voice-activated search                | ✅      |
| Price range filtering                 | ✅      |
| Minimalist, mobile-optimized UI       | ✅      |
| Visual feedback / loading states      | ✅      |
| Error handling                        | ✅      |
| Dockerfile + docker-compose           | ✅      |
| GitHub Actions (GHCR push)            | ✅      |
| README + approach write-up            | ✅      |
