# Dialektlab

A standalone browser demo for:

- recording spoken Swedish in the browser
- transcribing it with OpenAI
- rewriting it into playful Skanska-flavoured Swedish
- generating audio back from the rewritten line

This repo is intentionally separate from `2026GPT`.

## Stack

- Node + Express
- plain browser frontend in `public/`
- OpenAI for transcription, text rewrite, and TTS

## Run

1. Copy `.env.example` to `.env`
2. Set `OPENAI_API_KEY` or `DIALECTLAB_OPENAI_API_KEY`
3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

5. Open [http://localhost:8787](http://localhost:8787)

## Backend selection

Dialektlab now supports two audio rendering paths:

- `openai_tts`: OpenAI transcription + rewrite + OpenAI TTS
- `elevenlabs_tts`: OpenAI transcription + rewrite + ElevenLabs TTS

Selection rules:

- if `DIALECTLAB_AUDIO_BACKEND` is set, that wins
- otherwise, if `ELEVENLABS_API_KEY` exists, Dialektlab uses `elevenlabs_tts`
- otherwise, it falls back to `openai_tts`

For ElevenLabs, set:

```env
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

If you leave `ELEVENLABS_VOICE_ID` empty in this local repo, the current demo falls back to the Skanska voice you selected for this experiment.

## Tempo

Dialektlab now uses the voice provider's native speed control instead of local post-processing. For the current ElevenLabs path, this means one direct setting:

- `DIALECTLAB_SPEECH_SPEED`: lower values make the output slower

```env
DIALECTLAB_SPEECH_SPEED=0.76
```

## iPhone notes

Microphone access in mobile Safari generally requires a secure context. That means:

- `http://localhost` works on the same device
- a deployed HTTPS URL works
- a tunnel such as Cloudflare Tunnel or ngrok works

Plain local-network `http://192.168.x.x:8787` may not allow microphone capture on iPhone.

## Deploy on Railway

The app is already shaped correctly for Railway:

- it binds to `0.0.0.0`
- it respects Railway's `PORT`
- it exposes `GET /health`

Recommended deployment flow:

1. Push this repo to GitHub
2. In Railway, create a new service from `jardenberg/dialectlab`
3. Let Railway detect the Node service automatically
4. Set these variables in Railway:

```env
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
DIALECTLAB_SPEECH_SPEED=0.76
```

Optional:

```env
DIALECTLAB_AUDIO_BACKEND=elevenlabs_tts
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

The default start command is already `npm start`, and the healthcheck path should be `/health`.

## Current limitation

OpenAI-only output is still weak for a convincing regional dialect. ElevenLabs helps much more when you already have a strongly accented target voice, but this is still not the same-speaker illusion. That remains a later step.

## Files

- `server.js`: Express server and API route
- `lib/openaiDialectDemo.js`: OpenAI pipeline
- `public/index.html`: demo UI
- `public/app.js`: push-to-talk browser logic
- `public/styles.css`: styling
