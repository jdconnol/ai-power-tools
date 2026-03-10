# AI Power Tools — Compounding Memory

## What This Project Is

A single Chrome extension providing scroll-to-bottom, message queue, and conversation navigator for Gemini, ChatGPT, and Claude — with per-provider toggles in settings.

## Tech Stack

- Chrome Extension (Manifest V3)
- Vanilla JavaScript (no frameworks)
- CSS custom properties for per-provider theming

## Build & Run

1. Go to `chrome://extensions` and enable Developer mode
2. Click "Load unpacked" and select this directory
3. Open Gemini, ChatGPT, or Claude — features activate automatically
4. Right-click the extension icon → Options to toggle providers

## Architecture

- `providers.js` runs first, detects hostname, checks storage, fires `__aipt_ready__` event
- `icons.js`, `content.js`, `queue.js`, `navigator.js` wait for the ready event
- All scripts read config from `window.AIPowerTools.provider` (the `P` object)
- CSS custom properties set via `html[data-aipt-provider]` attribute

## Chrome Extension Rules

- **Always use Manifest V3.** Manifest V2 is deprecated.
- **Use `MutationObserver` for dynamic pages.** All three sites are SPAs.
- **Never inject UI until the target element is confirmed present.**
- **Trusted Types compliance.** Never use `innerHTML` — build all DOM with `document.createElement()` and `textContent`.
- **Content scripts share execution context.** Files listed in the manifest `js` array run in order and share the same global scope. Use `window.AIPowerTools` as the shared namespace.
- **Minimum permissions only.** Currently: `storage`.

## Verification Loop

After **every code change**, complete this loop before marking the task done:

1. Reload the extension at `chrome://extensions`
2. Hard refresh the target site tab
3. Check the console for errors
4. Confirm behavior in browser
5. Report observations

## Mistakes We've Already Made

<!-- Add entries here as they happen -->
