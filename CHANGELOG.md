# Changelog

All notable changes to Gormigskånsk are tracked here.

This changelog is reconstructed from the actual iteration history in this build thread, not just from commit messages.

## v3.1.2 - 2026-04-04

### JJ default tuning

- switched the default configured ElevenLabs voice to `JJ-Skånska`
- raised the default speech speed from `0.76` to `0.95`
- updated the client fallback state, env example, and README so the new defaults are reflected consistently

## v3.1.1 - 2026-04-04

### Label cleanup

- corrected the configured ElevenLabs voice labels to `ElevenLabs-Skånska` and `JJ-Skånska`
- bumped the public build id so the corrected labels are easy to verify live

## v3.1.0 - 2026-04-04

### Voice options and model defaults

- added a second configured ElevenLabs voice preset, `JJ-Skånska`, alongside the existing `ElevenLabs-Skånska` option
- fixed the ElevenLabs path so the selected configured voice is actually used for synthesis instead of always falling back to one voice id
- switched the default ElevenLabs model from `eleven_flash_v2_5` to `eleven_turbo_v2_5`
- updated docs and env examples for the new voice preset and model default

## v3.0.3 - 2026-04-03

### Selector and docs cleanup

- kept `/pl` as a supported localized route without showing `Polski` in the hero language selector
- tightened the visible language chips on mobile so the remaining buttons fit more cleanly
- documented Cloudflare as part of the real public deployment stack alongside Railway

## v3.0.2 - 2026-04-03

### Hotfix

- fixed the `Cannot access 'audioBlob' before initialization` client error in the submit flow
- bumped the public asset version so browsers fetch a fresh `app.js` after deploy
- set locale-rendered HTML pages to `Cache-Control: no-store` to reduce stale frontend issues after future deploys

## v3.0.1 - 2026-04-03

### Copy and footer cleanup

- added audio download for the generated Skånska output
- tightened the mobile layout so recording and output land earlier in the flow
- updated the hero copy to describe the product as a fun little voice lab for mobile and web
- moved the project tags out of the hero and into a proper footer
- added footer contact information for `joakim@jardenberg.com`
- added a more detailed visible version string using the app version plus build id
- normalized the output playback helper text away from playful dialect copy and back into plain language

## v3.0.0 - 2026-04-03

### Multilingual input

- removed the hard Swedish lock from transcription
- allowed source language auto-detection on the input side
- changed the rewrite step so non-Swedish speech can go straight to Swedish-with-Skånska output in one pass
- verified the flow with English input and Swedish/Skånska output
- updated the UI copy so the product clearly says any input language is welcome

### Localized routes

- added server-rendered locale bundles for Swedish, English, Spanish, Polish, and French
- introduced route-based language versions at `/`, `/en`, `/es`, `/pl`, and `/fr`
- localized page chrome, labels, button text, status text, and metadata per route
- added canonical and `hreflang` links for the locale pages
- moved page rendering out of the static `public/index.html` path and into server-rendered HTML

### Documentation

- updated README to describe multilingual input and locale URLs
- replaced the flat changelog narrative with versioned milestones

## v2.2.0 - 2026-04-03

### UX polish

- replaced the older hold-to-talk interaction with tap-to-start / tap-to-stop recording
- moved the recording block above settings so visitors can start immediately
- changed the landing copy from generic demo wording into public-facing Gormigskånsk branding
- simplified the Safari playback explanation and made it less technical
- updated labels such as `OUTPUT` to `SKÅNSKA`
- added cache-busting on static assets to flush stale UI text from Safari caches

### Progress and reliability

- added staged progress text during upload, transcription, rewrite, and TTS
- added a progress bar while the backend is working
- surfaced latency, timing, and length metadata in the UI
- fixed premature truncation by removing a concision bias in the rewrite prompt
- added a repair pass when rewritten output became suspiciously shorter than the source
- raised the upload cap from `10 MB` to `25 MB`

### Branding and deployment

- renamed the public-facing product from the internal `Dialektlab` label to `Gormigskånsk`
- added favicon and OG assets for sharing
- pushed the standalone repo to GitHub
- documented Railway deployment
- exposed the public custom domain through Cloudflare in front of the app
- deployed the public site at `https://gormigskansk.jardenberg.se`

## v2.0.0 - 2026-04-03

### Backend shift for speed and quality

- moved the default speech rendering path from OpenAI TTS to ElevenLabs
- connected the configured target voice `CuaAIFbkzX2kaNH5EtHZ`
- kept OpenAI for transcription and dialect rewrite control
- introduced separate readable output text and a more phonetic TTS script to push the accent harder
- corrected prompt drift so the accent strategy always targets Skånska rather than other Swedish dialects
- slowed the default voice speed to make the output feel less rushed and more Skånska
- benchmarked rewrite models and moved the text rewrite default to `gpt-5.4-mini`
- moved the default ElevenLabs renderer to `eleven_flash_v2_5` for better latency

## v1.0.0 - 2026-04-03

### Standalone MVP

- created a separate standalone repo after the first prototype accidentally landed in the unrelated `2026GPT` workspace
- built the first working Node + Express app with a plain browser frontend
- added browser microphone capture and upload
- added OpenAI transcription
- added a Skånska rewrite step
- added audio playback of the transformed result in the browser
- proved the core architecture worked end-to-end on iPhone-friendly web tech

## v0.1.0 - 2026-04-03

### Prehistory

- started from the broader idea of live dialect conversion in mobile Safari
- narrowed the concept from `Göteborgska in -> Skånska out` to the more practical `Swedish in -> Skånska out`
- decided early to prefer a backend streaming pipeline over trying to run everything locally in the browser
- explicitly targeted one speaker, demo quality, and fun over perfect zero-latency live dubbing
