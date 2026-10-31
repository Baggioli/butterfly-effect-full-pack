# P0-25 + P0-26 Mac :18888 smoke evidence

**Tip:** `523173c` on `feat/projection-engine`  
**Entry:** `http://127.0.0.1:18888/?demo=1` (Mac a2-host-proxy → DGX A2 `:18887`)  
**Also:** Tailscale `http://100.65.242.127:18888/?demo=1` / Wi‑Fi `http://192.168.1.12:18888/?demo=1`  
**Cache:** `app.js?v=1.4-p0-25-26-demo` / `projection.js?v=pj-p0-25-26`  
**Time (Asia/Shanghai):** 2026-10-25 ~22:58 CST

## Acceptance

| Gate | Result | Evidence |
|------|--------|----------|
| P0-25 demo「部分完成较多」→ actual line | **PASS** (API) | `demo-behind.json`: lines=['plan', 'actual'], source=synthetic, HTTP 200 without session |
| P0-25 no login dead-end | **PASS** (asset) | `latest` still AUTH_REQUIRED; `projection.js` contains `data-action="login"` CTA + demo bar when `?demo=1` |
| P0-26 readable story body | **PASS** (API payload used by UI) | summary_len=180, long_len=2424, paragraphs=32; UI opens `<details class="pj-story-long" open>` in demo |
| P0-26 path visible | **PASS** | nodes=6, milestones=6, plan+actual chart data present |

## What changed
1. `/api/projection/demo/actual` runs **before** auth wall (synthetic profile when logged out; Origin still checked).
2. AUTH_REQUIRED UI shows **去登录** (`data-action="login"`) + demo hint under `?demo=1`.
3. Demo page places story + chart before node list; long-form story **open by default**.

## Files
- `smoke-summary.json` — machine-readable pass flags
- `demo-behind.json` — full demo/actual response (story+lines)
- `latest.json` — AUTH_REQUIRED without session
- `index.html` / `app.js` / `projection.js` — served assets

## Gate claim
**Not claiming 【可测】 / Micheal-ready.** Product must re-check screenshots on real device. API+asset smoke on Mac `:18888` passes P0-25 preferred path and P0-26 content presence.

## Note
DGX `ss` at smoke time showed `:18887` + `:8791` only — **`:8787` prod not listening**. Redeploy only killed A2 (`cwd=butterfly-effect-a2` / `DGX_APP_PORT=18887`). Flag for ops if prod should be up.
