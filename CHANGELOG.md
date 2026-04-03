# Changelog

All notable changes to this project are tracked here.

This changelog is reconstructed from the actual build history in this thread, not only from commit messages.

## 2026-04-03

### Concept and scope

- started as an experiment around transforming spoken Swedish into Skånska output in a browser on iPhone
- narrowed the goal from Göteborgska to the broader and more practical `Swedish in, Skånska out`
- chose a backend streaming pipeline rather than trying to run everything locally in Safari
- explicitly targeted one-speaker, demo-quality, push-button UX rather than true zero-latency live dubbing

### Repo setup

- initially prototyped in the `2026GPT` workspace by mistake
- removed that work from the unrelated repo
- created a separate standalone repo at `dialektlab`
- pushed the standalone project to `jardenberg/dialectlab`

### First MVP

- built a standalone Node + Express app with a plain browser frontend
- added push-to-talk browser recording
- added an upload API for audio input
- added OpenAI transcription
- added a rewrite step that turns Swedish into more Skånska-flavoured text
- added TTS playback in the browser

### OpenAI-only phase

- first version used OpenAI for transcription, rewrite, and TTS
- proved that the architecture worked technically
- exposed the main limitation: wording changed somewhat, but the accent shift was weak

### ElevenLabs integration

- connected ElevenLabs as the default TTS backend
- used the configured target voice `CuaAIFbkzX2kaNH5EtHZ`
- kept OpenAI for transcription and dialect rewrite
- moved the default TTS path away from OpenAI and into ElevenLabs for better voice character

### Skånska steering

- corrected backend prompting so the target dialect was explicitly Skånska
- added protection against bad `accentStrategy` text that mentioned Göteborgska or other dialects
- separated readable UI text from a more phonetic TTS script to push the output voice harder

### Speed and pacing

- lowered the default voice speed to make the output feel slower and more Skånska
- removed the earlier idea of local ffmpeg pitch/tempo post-processing
- stayed inside native provider controls instead
- later switched the default ElevenLabs model to `eleven_flash_v2_5` to improve latency

### Long-recording fixes

- found that the rewrite prompt was explicitly encouraging concise output
- removed that compression bias
- added protection against over-shortened rewrites by comparing output length to source length
- added a repair pass when rewritten content became suspiciously shorter than the transcript
- increased the upload size cap from `10 MB` to `25 MB`
- added basic timing and size metadata to help debug duration mismatches

### Recording UX

- replaced the fragile hold-to-talk interaction with tap-to-start / tap-to-stop recording
- improved first-run microphone permission flow by making recording start from a simple tap
- removed the older `pointerleave`-driven stop behaviour that could end recordings early
- moved the recording block above the settings so people can start immediately

### Feedback and progress

- added staged processing feedback while the backend is working
- added a progress bar and status text during upload, transcription, rewrite, and voice generation
- surfaced timing breakdowns in the UI so it is clearer where time is being spent

### Model tuning

- benchmarked rewrite latency and quality across candidate OpenAI models
- moved the rewrite default to `gpt-5.4-mini`
- kept `gpt-4o-mini-transcribe` as the transcription default
- kept ElevenLabs Flash as the default speech renderer for the public demo

### Branding and deployment

- shifted public branding from the generic internal name `Dialektlab` to `Gormigskånsk`
- updated headline and metadata to match the public pun and domain
- added favicon and social sharing assets
- generated `public/og-card.png` from the source artwork in `public/og-card.svg`
- deployed the app to Railway
- published the public site at `https://gormigskansk.jardenberg.se`

### Documentation

- documented Railway deployment and environment configuration
- clarified which env vars matter for the ElevenLabs path and which are only fallback settings
- updated the README to reflect the current public product, not just the original lab prototype
