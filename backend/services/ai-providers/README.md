# BlankUp AI Provider Layer

```
                    BlankUp
                       │
                AI Provider Layer
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   OmniRoute       OpenAI Direct   Cloudflare
        │              │
   Provider A/B     OpenAI API
        │
        └──── Future Providers ───────┘
```

OmniRoute và direct providers là **independent providers** trong cùng abstraction, không phải `BlankUp → OmniRoute → OpenAI`.

## Providers

| Provider | Class | Env Enabled | Key Required | Image Support | Endpoint |
|----------|-------|-------------|--------------|---------------|----------|
| OmniRoute | `OmniRouteProvider` | `OMNIROUTE_ENABLED` | `OMNIROUTE_API_KEY` + `OMNIROUTE_BASE_URL` | ✅ `POST /v1/images/generations` + `/v1/images/edits` (OpenAI-compatible) | `http://localhost:20128/v1` |
| OpenAI Direct | `OpenAIProvider` | `OPENAI_ENABLED` (auto true if `OPENAI_API_KEY` set) | `OPENAI_API_KEY` | ✅ `https://api.openai.com/v1/images/generations` + `/images/edits` | Direct |
| Cloudflare | `CloudflareProvider` | `CLOUDFLARE_ENABLED` (auto true if `ACCOUNT_ID`+`TOKEN`) | `CLOUDFLARE_API_TOKEN` + `ACCOUNT_ID` | ✅ `https://api.cloudflare.com/client/v4/accounts/{id}/ai/run/{model}` | Cloudflare AI |
| Future | Add `FutureProvider extends BaseAIProvider` | — | — | — | — |

All providers implement `BaseAIProvider` (`base.provider.js`):
```js
generateImage({prompt, style, designId, finalPrompt}) → {designUrl, finalPrompt}
generateFromImage({file, idea, designId, finalPrompt}) → {designUrl, finalPrompt}
isAvailable() → bool
```

## Configuration

```env
AI_PROVIDER=auto          # omniroute | openai | cloudflare | auto
OMNIROUTE_ENABLED=false
OMNIROUTE_BASE_URL=http://localhost:20128/v1
OMNIROUTE_API_KEY=
OMNIROUTE_MODEL=openai/gpt-image-2
OMNIROUTE_TIMEOUT_MS=90000
OMNIROUTE_MAX_RETRIES=1

OPENAI_ENABLED=false      # auto true if OPENAI_API_KEY set
OPENAI_API_KEY=
OPENAI_MODEL=gpt-image-2
OPENAI_TIMEOUT_MS=90000
OPENAI_MAX_RETRIES=1

CLOUDFLARE_ENABLED=false  # auto true if ACCOUNT_ID+TOKEN set
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell
CLOUDFLARE_TIMEOUT_MS=90000
```

All providers can be enabled in parallel:
```env
OMNIROUTE_ENABLED=true
OPENAI_ENABLED=true
CLOUDFLARE_ENABLED=true
```
No `if OmniRoute has key → skip OpenAI` logic.

## Provider Selection

- `AI_PROVIDER=omniroute` → primary OmniRoute, fallback to other available in priority `omniroute > openai > cloudflare`
- `AI_PROVIDER=openai` → primary OpenAI
- `AI_PROVIDER=cloudflare` → primary Cloudflare
- `AI_PROVIDER=auto` (default) → priority `omniroute > openai > cloudflare` (first available)

`provider.config.js:getFallbackOrder(primary)` returns deterministic order without duplicates.

## Fallback / Retry

```
Primary Provider
      ↓ failure (retryable? retry maxRetries)
      ↓
Secondary Provider
      ↓ failure
      ↓
... visited Set prevents loop
      ↓
All fail → fallback SVG + refund
```

- **Retry same provider:** timeout (`AbortError`), 429, 5xx → retry up to `MAX_RETRIES` per provider (default 1 → 2 attempts).
- **Fallback:** non-retryable or retries exhausted → next provider. `visited Set` prevents `OmniRoute → OpenAI → OmniRoute` loop.
- **Observability:** each attempt logs `requestId, provider, model, attempt, latency, success` (`index.js: generateWithFallback`). No API key logged.

## Credit Integrity (Invariant)

Business layer owns credit:
```
authenticate → validate → deduct 1 credit (Serializable tx)
→ choose provider → generateWithFallback
→ if success → save, no refund, no extra deduct
→ if all fail → refund 1 (Serializable)
→ if provider A fail → B success → no second deduct, no refund
```
Provider layer **never** touches `UserAiAccounts`/`Ledger`. Proven by code: `deductCreditForGenerate` before `generateWithFallback`, `refundCreditForGenerate` only on `ALL_PROVIDERS_FAILED`.

## Security

- All `*_API_KEY` / `*_TOKEN` backend-only, `.env` ignored (`.gitignore:3`), not in `frontend/js` bundle (verified `ai-provider.test.js`).
- Not logged: `console.log` only `provider, model, latency`, never `apiKey`.
- Not stored in DB.

## Health

- `isAvailable()` checks `enabled && hasKey && typeof fetch`. No health API call per request, no blocking if optional provider down, no fake success.
- `hasAvailableProvider()` for quick check.

## Disabled / Missing Key

- `OMNIROUTE_ENABLED=false` → never called (not in `fallbackOrder`).
- `OMNIROUTE_ENABLED=true` + `OMNIROUTE_API_KEY=` → `isAvailable() false` → `CONFIG_ERROR` non-retryable → immediate fallback, never fake success.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| All providers fallback to SVG | `AI_PROVIDER` + `*_ENABLED` + `*_API_KEY` correct? Check logs `All providers failed` |
| OmniRoute `401` | `OMNIROUTE_API_KEY` correct, `baseUrl` reachable `curl http://localhost:20128/v1/models` |
| Timeout | Increase `*_TIMEOUT_MS`, check `retryable` in logs |
| Credit not refunded | Check `AiCreditLedger` `reason=ai_generate_refund`, `UserAiAccounts` |

## Adding Future Provider

1. Create `gemini.provider.js` extends `BaseAIProvider`, implement `generateImage` + `isAvailable` reading `GEMINI_*` env.
2. Register in `provider.config.js` `getConfig` + `isProviderAvailable` + `getFallbackOrder` priority.
3. Add to `index.js` `createProviders`.
4. No change to `routes/ai-design.js` business flow.

## Image Compatibility Note

OmniRoute `POST /v1/images/generations` is OpenAI-compatible (docs `API_REFERENCE.md: Image Generation`): `model: "openai/gpt-image-2"`, `prompt`, `size: "1024x1024"` → `data[0].b64_json` or `data[0].url`. Verified via `https://raw.githubusercontent.com/.../API_REFERENCE.md`. Status **SUPPORTED** for BlankUp. If OmniRoute returns `url` instead of `b64_json`, adapter fetches URL to base64.

## Real Connectivity

- `http://localhost:20128/v1/models` currently **NOT VERIFIED** (no local OmniRoute). Architecture complete, integration ready; set `OMNIROUTE_API_KEY` later.
