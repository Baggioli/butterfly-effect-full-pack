# P0-23 consent gate — smoke evidence (Asia/Shanghai)

Generated: 2026-10-25 22:26:21 CST
Tip: feat/projection-engine `4d678ce` (cache-bust `v=1.4-p0-23-consent-b`)
A2: DGX embed+restart; Mac `:18888` → SSH tunnel `:18887` → DGX via `/tmp/a2-host-proxy.py`

## Acceptance (product)

| # | Criterion | 127.0.0.1:18888 | Tailscale 100.65.242.127:18888 |
|---|-----------|-----------------|-------------------------------|
| 1 | Main btn disabled before check | PASS | PASS |
| 2 | Enabled after check | PASS | PASS |
| 3 | Click leaves consent (no bounce) | PASS | PASS |
| 4 | Failure shows visible #sensitive-error | PASS (`同意提交失败(冒烟注入)`) | PASS |

Deploy markers (cache-bust + `__syncSensitive` + `X-Butterfly-Session` in served app.js): PASS both.

## Why browser desktop once PASS'd while real-device / Mac:18888 hung

Not cache-unbust and not missing embed alone (markers were already present when c3 hung).

**Root cause A — Mac host proxy duplicate session headers (c3 hang):**
Client dual-sends `Authorization: Bearer` + `X-Butterfly-Session` (WeChat/Basic-safe).
Old proxy extracted Bearer into `x-butterfly-session` **without removing** the client `X-Butterfly-Session` key → http.client sent **two** session headers → Node/undici treated as array → `bearerToken` rejected → `AUTH_REQUIRED` → stayed on consent.
Desktop without Basic often sent a single Authorization Bearer path that worked; Mac:18888 + Basic/httpCredentials + dual headers hit the bug.
**Fix:** `/tmp/a2-host-proxy.py` collapses to one `x-butterfly-session` (Bearer preferred, else client header).

**Root cause B — `#sensitive-error` wiped after fail (c4 false/empty):**
`__syncSensitive` cleared error whenever checkbox was on; `busyAI` finally called sync after API fail → message vanished.
**Fix:** `4d678ce` — sync only gates the button; clear error only on user checkbox change.

**Tailscale Playwright 502 red herring:** Mac system HTTP proxy `127.0.0.1:7890` does not bypass Tailscale `100.64/10`. Chrome via Playwright got 502; curl (no system proxy) got 200. Real phone WeChat has no Mac Clash proxy. Smoke uses `--no-proxy-server` to match device path.

**Mac:18888 vs DGX:18887:** intentional — Mac proxy rewrites Origin + injects Basic + session header to local tunnel of DGX A2. Not a version skew after this redeploy (both serve `v=1.4-p0-23-consent-b`, app.js md5 prefix `59aeb72a4d9c3c50`).

## Evidence dirs

- `/Users/lq/butterfly-handoff/p0-23-consent-smoke` — local Mac proxy entry
- `/Users/lq/butterfly-handoff/p0-23-consent-smoke-tailscale` — Tailscale entry (same proxy, device-like URL)

Screenshots: 01-home … 08-after-consent (+ 05 gated / 06 ungated / 07 fail visible / 08 left).
Reports: report.json, run.log, smoke.mjs, a2-host-proxy.py (fixed).

## Gate language

Smoke criteria 1–4 PASS on both entries above. Do **not** claim Micheal-ready / 【可测】 from this agent — parent owns that call.
