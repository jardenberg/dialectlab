# Gormigskånsk

Public demo: [gormigskansk.jardenberg.se](https://gormigskansk.jardenberg.se)

This repo contains the standalone browser app behind Gormigskånsk: a small iPhone-friendly demo that takes spoken Swedish, rewrites it into a more Skånska-flavoured version, and returns audio in a Skånska target voice.

The repo name stayed `dialektlab`, but the public-facing product and branding are now `Gormigskånsk`.

This project is intentionally separate from `2026GPT`.

## What It Does

- records speech in the browser
- transcribes the audio with OpenAI
- rewrites the utterance into a Skånska-oriented version while trying to preserve meaning and length
- renders the result with ElevenLabs using the configured target voice
- plays the audio back in the browser

## Current UX

- tap once to start recording
- tap again to stop
- first interaction may trigger the browser microphone permission dialog
- recording is placed first in the UI so people can start immediately
- processing feedback is shown with staged status text and a progress bar

## Stack

- Node + Express
- plain browser frontend in `public/`
- OpenAI for transcription and dialect rewrite
- ElevenLabs for the default TTS path
- Railway for deployment

## Default Model Setup

Current defaults bias for latency while keeping decent rewrite quality:

```env
DIALECTLAB_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
DIALECTLAB_TEXT_MODEL=gpt-5.4-mini
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
DIALECTLAB_SPEECH_SPEED=0.76
```

Notes:

- `gpt-4o-mini-transcribe` handles speech-to-text
- `gpt-5.4-mini` is the current default rewrite model
- `eleven_flash_v2_5` is the default TTS model for lower latency
- if you prefer slightly higher TTS fidelity and can tolerate more delay, switch `ELEVENLABS_MODEL_ID` to `eleven_multilingual_v2`

## Run Locally

1. Copy `.env.example` to `.env`
2. Set at least:

```env
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
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
ELEVENLABS_MODEL_ID=eleven_flash_v2_5

DIALECTLAB_AUDIO_BACKEND=elevenlabs_tts
DIALECTLAB_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
DIALECTLAB_TEXT_MODEL=gpt-5.4-mini
DIALECTLAB_SPEECH_SPEED=0.76
DIALECTLAB_TARGET_DIALECT=Skanska
DIALECTLAB_IP_MAX=12
```

Notes:

- `DIALECTLAB_OPENAI_API_KEY` is optional and only overrides `OPENAI_API_KEY`
- `DIALECTLAB_AUDIO_BACKEND=elevenlabs_tts` is optional but makes the intent explicit
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
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
DIALECTLAB_AUDIO_BACKEND=elevenlabs_tts
DIALECTLAB_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
DIALECTLAB_TEXT_MODEL=gpt-5.4-mini
DIALECTLAB_SPEECH_SPEED=0.76
DIALECTLAB_TARGET_DIALECT=Skanska
DIALECTLAB_IP_MAX=12
```

## Branding Assets

- favicon: `public/favicon.svg`
- social preview source: `public/og-card.svg`
- social preview PNG: `public/og-card.png`

The public site metadata is configured in `public/index.html`.

## Files

- `server.js`: Express server and API routes
- `lib/openaiDialectDemo.js`: OpenAI + ElevenLabs pipeline
- `public/index.html`: page shell and metadata
- `public/app.js`: tap-to-start/tap-to-stop browser logic
- `public/styles.css`: styling
- `CHANGELOG.md`: project history

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the build history from this project thread.
