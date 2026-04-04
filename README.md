# Gör mig skånsk

Public demo: [gormigskansk.jardenberg.se](https://gormigskansk.jardenberg.se)

This repo contains the standalone browser app behind Gormigskånsk: a small iPhone-friendly demo that takes spoken input in any language, rewrites it into a more Skånska-flavoured Swedish version, and returns audio in a Skånska target voice.

The repo name stayed `dialektlab`, but the public-facing product and branding are now `Gormigskånsk`.

This project is intentionally separate from `2026GPT`.

## What It Does

- records speech in the browser
- transcribes the audio with OpenAI
- rewrites the utterance into a Skånska-oriented Swedish version while trying to preserve meaning and length
- renders the result with ElevenLabs using the configured target voice
- plays the audio back in the browser

## Current UX

- tap once to start recording
- tap again to stop
- first interaction may trigger the browser microphone permission dialog
- recording is placed first in the UI so people can start immediately
- processing feedback is shown with staged status text and a progress bar
- source speech can be auto-detected instead of being locked to Swedish
- localized landing pages are available at `/`, `/en`, `/es`, `/pl`, and `/fr`

## Localized URLs

- `https://gormigskansk.jardenberg.se/` for Swedish
- `https://gormigskansk.jardenberg.se/en` for English
- `https://gormigskansk.jardenberg.se/es` for Spanish
- `https://gormigskansk.jardenberg.se/pl` for Polish
- `https://gormigskansk.jardenberg.se/fr` for French

The chrome and metadata are localized per route. The voice pipeline stays the same: any supported spoken input is turned into Swedish with a Skånska flavour on output.

## Stack

- Node + Express
- plain browser frontend in `public/`
- OpenAI for transcription and dialect rewrite
- ElevenLabs for the default TTS path
- Cloudflare for the public custom domain, DNS, TLS, and edge delivery in front of the app
- Railway for deployment

## Default Model Setup

Current defaults bias for latency while keeping decent rewrite quality:

```env
DIALECTLAB_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
DIALECTLAB_TEXT_MODEL=gpt-5.4-mini
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5
DIALECTLAB_SPEECH_SPEED=0.76
```

Notes:

- `gpt-4o-mini-transcribe` handles speech-to-text
- `gpt-5.4-mini` is the current default rewrite model
- `eleven_turbo_v2_5` is now the default TTS model for the current quality/speed balance
- if you want to compare lower latency, switch `ELEVENLABS_MODEL_ID` to `eleven_flash_v2_5`
- if you prefer slightly higher TTS fidelity and can tolerate more delay, switch `ELEVENLABS_MODEL_ID` to `eleven_multilingual_v2`

## Run Locally

1. Copy `.env.example` to `.env`
2. Set at least:

```env
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ELEVENLABS_JJ_VOICE_ID=...
```

3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

5. Open [http://localhost:8787](http://localhost:8787)

## Environment Variables

Commonly useful variables:

```env
OPENAI_API_KEY=...
DIALECTLAB_OPENAI_API_KEY=
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ELEVENLABS_JJ_VOICE_ID=...
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5

DIALECTLAB_AUDIO_BACKEND=elevenlabs_tts
DIALECTLAB_INPUT_LANGUAGE=
DIALECTLAB_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
DIALECTLAB_TEXT_MODEL=gpt-5.4-mini
DIALECTLAB_SPEECH_SPEED=0.76
DIALECTLAB_TARGET_DIALECT=Skanska
DIALECTLAB_IP_MAX=12
```

Notes:

- `DIALECTLAB_OPENAI_API_KEY` is optional and only overrides `OPENAI_API_KEY`
- `DIALECTLAB_AUDIO_BACKEND=elevenlabs_tts` is optional but makes the intent explicit
- leave `DIALECTLAB_INPUT_LANGUAGE` empty for auto-detection; only set it if you want to force one source language
- `HOST` and `PORT` do not need to be set on Railway
- `DIALECTLAB_TTS_MODEL` and `DIALECTLAB_TTS_VOICE` only matter on the OpenAI TTS fallback path

## Backend Selection

Two audio rendering paths exist:

- `openai_tts`
- `elevenlabs_tts`

Selection rules:

- if `DIALECTLAB_AUDIO_BACKEND` is set, that wins
- otherwise, if `ELEVENLABS_API_KEY` exists, the app uses `elevenlabs_tts`
- otherwise, it falls back to `openai_tts`

## iPhone Notes

Microphone access in mobile Safari generally requires a secure context. That means:

- `http://localhost` works on the same device
- a deployed HTTPS URL works
- a tunnel also works

Plain local-network `http://192.168.x.x:8787` may not allow microphone capture on iPhone.

## Railway

The app is already shaped correctly for Railway:

- binds to `0.0.0.0`
- respects Railway `PORT`
- exposes `GET /health`

Recommended Railway variables:

```env
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=CuaAIFbkzX2kaNH5EtHZ
ELEVENLABS_JJ_VOICE_ID=Z2ic84BAXoRvhU0mvJIa
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5
DIALECTLAB_AUDIO_BACKEND=elevenlabs_tts
DIALECTLAB_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
DIALECTLAB_TEXT_MODEL=gpt-5.4-mini
DIALECTLAB_SPEECH_SPEED=0.76
DIALECTLAB_TARGET_DIALECT=Skanska
DIALECTLAB_IP_MAX=12
```

## Production Edge

The public deployment is not just Railway. In production, `gormigskansk.jardenberg.se` is exposed through Cloudflare in front of the Railway service. In practice that means:

- Cloudflare handles the public custom domain, DNS, TLS termination, and edge-facing delivery
- Railway runs the Node app itself
- the app still controls its own HTML freshness with `Cache-Control: no-store` on locale-rendered pages

## Branding Assets

- favicon: `public/favicon.svg`
- social preview source: `public/og-card.svg`
- social preview PNG: `public/og-card.png`

Page metadata, canonical URLs, and hreflang tags are rendered from `lib/locales.js` and `lib/renderPage.js`.

## Voice Presets

When ElevenLabs is active, the demo currently exposes two configured voice buttons:

- `ElevenLabs-Skånska`
- `JJ-Skånska`

The first uses `ELEVENLABS_VOICE_ID`. The second uses `ELEVENLABS_JJ_VOICE_ID`.

## Files

- `server.js`: Express server and API routes
- `lib/locales.js`: locale bundles, route mapping, metadata
- `lib/renderPage.js`: server-rendered HTML shell per locale
- `lib/openaiDialectDemo.js`: OpenAI + ElevenLabs pipeline
- `public/app.js`: tap-to-start/tap-to-stop browser logic
- `public/styles.css`: styling
- `CHANGELOG.md`: project history

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the build history from this project thread.
