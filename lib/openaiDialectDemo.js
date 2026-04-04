const OpenAI = require('openai');

const BUILTIN_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse'];
const BUILTIN_VOICE_SET = new Set(BUILTIN_VOICES);
const DEFAULT_ELEVENLABS_VOICE_ID = 'CuaAIFbkzX2kaNH5EtHZ';
const DEFAULT_ELEVENLABS_VOICE_LABEL = 'ElevenLabs-Skånska';
const DEFAULT_ELEVENLABS_JJ_VOICE_ID = 'Z2ic84BAXoRvhU0mvJIa';
const DEFAULT_ELEVENLABS_JJ_VOICE_LABEL = 'JJ-Skånska';
const DEFAULT_ELEVENLABS_MODEL_ID = 'eleven_turbo_v2_5';
const DEFAULT_TEXT_MODEL = 'gpt-5.4-mini';
const DEFAULT_SPEECH_SPEED = 0.76;
const MIN_CONTENT_PRESERVATION_RATIO = 0.88;

const DEFAULT_TTS_INSTRUCTIONS =
  'Speak natural Swedish with an unmistakable Skanska rhythm and melody. Do not sound like neutral rikssvenska. Keep it playful, warm, clearly southern, and intelligible. If the input uses non-standard spellings or contractions, honor them as written instead of normalizing back to standard Swedish.';
const DEFAULT_TARGET_DIALECT = 'Skanska';
const FOREIGN_DIALECT_HINTS = [
  'göteborg',
  'gothenburg',
  'stockholm',
  'stockholmsk',
  'norrländ',
  'småländ',
  'värmländ',
  'gotländ',
  'rikssvensk',
];

const STRENGTH_GUIDANCE = {
  subtle: 'Apply a light southern colour. Keep the wording close to the original utterance.',
  clear: 'Make it distinctly Skanska while keeping it natural, idiomatic, and conversational.',
  theatrical:
    'Lean into a vivid, unmistakable Skanska demo voice. It should feel fun, exaggerated, and still understandable.',
};

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeStrength(value) {
  return Object.prototype.hasOwnProperty.call(STRENGTH_GUIDANCE, value) ? value : 'clear';
}

function getConfiguredVoice(requestedVoice) {
  const voice = typeof requestedVoice === 'string' ? requestedVoice.trim() : '';
  return voice || process.env.DIALECTLAB_TTS_VOICE || 'sage';
}

function getTargetDialect() {
  return process.env.DIALECTLAB_TARGET_DIALECT || DEFAULT_TARGET_DIALECT;
}

function getAudioBackend() {
  if (process.env.DIALECTLAB_AUDIO_BACKEND) {
    return process.env.DIALECTLAB_AUDIO_BACKEND;
  }

  return process.env.ELEVENLABS_API_KEY ? 'elevenlabs_tts' : 'openai_tts';
}

function getElevenLabsVoices() {
  const voices = [
    {
      id: process.env.ELEVENLABS_VOICE_ID || DEFAULT_ELEVENLABS_VOICE_ID,
      label: process.env.ELEVENLABS_VOICE_LABEL || DEFAULT_ELEVENLABS_VOICE_LABEL,
    },
    {
      id: process.env.ELEVENLABS_JJ_VOICE_ID || DEFAULT_ELEVENLABS_JJ_VOICE_ID,
      label: process.env.ELEVENLABS_JJ_VOICE_LABEL || DEFAULT_ELEVENLABS_JJ_VOICE_LABEL,
    },
  ];

  return voices.filter((voice, index, allVoices) => voice.id && allVoices.findIndex(({ id }) => id === voice.id) === index);
}

function resolveElevenLabsVoice(requestedVoice) {
  const voices = getElevenLabsVoices();
  const requested = typeof requestedVoice === 'string' ? requestedVoice.trim() : '';

  if (!requested) {
    return voices[0];
  }

  return voices.find(({ id }) => id === requested) || voices[0];
}

function getElevenLabsModelId() {
  return process.env.ELEVENLABS_MODEL_ID || DEFAULT_ELEVENLABS_MODEL_ID;
}

function getTextModel() {
  return process.env.DIALECTLAB_TEXT_MODEL || DEFAULT_TEXT_MODEL;
}

function getSpeechSpeed(value = process.env.DIALECTLAB_SPEECH_SPEED) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_SPEECH_SPEED;
  }

  return Math.min(Math.max(parsed, 0.7), 1.2);
}

function getElevenLabsVoiceSettings(requestedSpeed) {
  const settings = {};

  if (process.env.ELEVENLABS_STABILITY) {
    settings.stability = Number(process.env.ELEVENLABS_STABILITY);
  }
  if (process.env.ELEVENLABS_SIMILARITY_BOOST) {
    settings.similarity_boost = Number(process.env.ELEVENLABS_SIMILARITY_BOOST);
  }
  if (process.env.ELEVENLABS_STYLE) {
    settings.style = Number(process.env.ELEVENLABS_STYLE);
  }
  settings.speed = getSpeechSpeed(requestedSpeed ?? process.env.ELEVENLABS_SPEED);
  if (process.env.ELEVENLABS_USE_SPEAKER_BOOST) {
    settings.use_speaker_boost = process.env.ELEVENLABS_USE_SPEAKER_BOOST === 'true';
  }

  return Object.keys(settings).length > 0 ? settings : null;
}

function getOpenAIClient() {
  const apiKey = process.env.DIALECTLAB_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw createHttpError(
      503,
      'Dialektlab is not configured yet. Set OPENAI_API_KEY or DIALECTLAB_OPENAI_API_KEY.',
    );
  }

  return new OpenAI({ apiKey });
}

function parseRewritePayload(outputText, fallbackTranscript) {
  try {
    const normalized = outputText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    const parsed = JSON.parse(normalized);
    const candidate = Array.isArray(parsed) ? parsed[0] : parsed;
    const displayText = candidate.display_text?.trim();
    const ttsText = candidate.tts_text?.trim();
    const accentStrategy = candidate.accent_strategy?.trim();

    if (!displayText || !ttsText) {
      throw new Error('Missing display_text or tts_text');
    }

    return {
      displayText,
      ttsText,
      accentStrategy: accentStrategy || null,
    };
  } catch (_error) {
    return {
      displayText: fallbackTranscript,
      ttsText: fallbackTranscript,
      accentStrategy: null,
    };
  }
}

function sanitizeAccentStrategy(accentStrategy) {
  const fallback =
    'Använder skånsk rytm, sydsvensk melodi och tydliga vokaldrag för att hålla outputen klart söderut.';

  if (!accentStrategy) {
    return fallback;
  }

  const normalized = accentStrategy.toLowerCase();
  if (FOREIGN_DIALECT_HINTS.some((hint) => normalized.includes(hint))) {
    return fallback;
  }

  return accentStrategy;
}

function getContentLength(text) {
  return String(text || '').replace(/\s+/g, '').length;
}

function rewriteLooksCompressed(sourceText, rewrittenText) {
  const sourceLength = getContentLength(sourceText);
  if (sourceLength < 220) {
    return false;
  }

  return getContentLength(rewrittenText) < sourceLength * MIN_CONTENT_PRESERVATION_RATIO;
}

async function transcribeSpeech(openai, audioFile) {
  const upload = await OpenAI.toFile(audioFile.buffer, audioFile.originalname || 'speech.webm', {
    type: audioFile.mimetype || 'audio/webm',
  });

  const configuredInputLanguage = process.env.DIALECTLAB_INPUT_LANGUAGE?.trim();
  const transcription = await openai.audio.transcriptions.create({
    file: upload,
    model: process.env.DIALECTLAB_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
    ...(configuredInputLanguage ? { language: configuredInputLanguage } : {}),
  });

  return {
    text: transcription.text?.trim() || '',
    language: transcription.language || configuredInputLanguage || null,
  };
}

async function rewriteToSkanska(openai, transcript, strength, sourceLanguage) {
  const targetDialect = getTargetDialect();
  const sharedInstructions = [
    `You create two Swedish outputs for a playful ${targetDialect} voice demo.`,
    'The source text may already be Swedish, or it may be another language.',
    'Preserve meaning, tense, names, emotional tone, and intent.',
    'Always produce the output in Swedish.',
    `If the source text is not Swedish, translate the meaning into Swedish and shape it directly into ${targetDialect} in the same response.`,
    'Do not leave any output in the original source language.',
    'Do not summarize, compress, or omit content.',
    'Keep the same overall sequence of ideas as the source.',
    'For longer source material, keep roughly the same amount of spoken content as the source text.',
    `The rewrite may be slightly longer than the source if natural ${targetDialect} fillers or slower phrasing help the rhythm.`,
    'Return strict JSON only.',
    'Required JSON keys: display_text, tts_text, accent_strategy.',
    `display_text: readable Swedish for the UI, with clear ${targetDialect} flavour where natural.`,
    `tts_text: a more aggressive pronunciation script for TTS. It may use non-standard spellings, contractions, apostrophes, commas, ellipses, stretched vowels, and small natural filler words if that helps the engine sound more ${targetDialect}.`,
    'Do not use IPA.',
    `accent_strategy: one short Swedish note about the pronunciation choices. It must describe ${targetDialect} and must not mention any other dialect.`,
    STRENGTH_GUIDANCE[strength],
    `Use southern rhythm, melody, and clearly ${targetDialect} turns of phrase when natural, but keep the result understandable to a general Swedish speaker.`,
    `Never mention Göteborgska, göteborgsk, Stockholm, stockholmska, norrländska, or rikssvenska in accent_strategy. The target is always ${targetDialect}.`,
  ];

  const response = await openai.responses.create({
    model: getTextModel(),
    instructions: sharedInstructions.join(' '),
    input: transcript,
  });

  const rewritten = parseRewritePayload(response.output_text?.trim() || '', transcript);
  if (
    !rewriteLooksCompressed(transcript, rewritten.displayText) &&
    !rewriteLooksCompressed(transcript, rewritten.ttsText)
  ) {
    return rewritten;
  }

  const repairResponse = await openai.responses.create({
    model: getTextModel(),
    instructions: [
      ...sharedInstructions,
      'Your previous rewrite became too short.',
      'Rebuild it so every important detail from the source is still present.',
      'Keep the output near the original spoken length instead of shrinking it.',
      'If the source text was not Swedish, the rebuilt output must still be fully Swedish.',
      'It is acceptable to add a few natural filler words if that helps preserve the slower rhythm.',
    ].join(' '),
    input: [
      `DETECTED SOURCE LANGUAGE: ${sourceLanguage || 'unknown / auto-detected'}`,
      '',
      'SOURCE TEXT:',
      transcript,
      '',
      'PREVIOUS JSON OUTPUT:',
      JSON.stringify(rewritten),
    ].join('\n'),
  });

  const repaired = parseRewritePayload(repairResponse.output_text?.trim() || '', transcript);
  if (
    rewriteLooksCompressed(transcript, repaired.displayText) ||
    rewriteLooksCompressed(transcript, repaired.ttsText)
  ) {
    return rewritten;
  }

  return repaired;
}

async function synthesizeWithOpenAI(openai, text, voice, strength) {
  const response = await openai.audio.speech.create({
    model: process.env.DIALECTLAB_TTS_MODEL || 'gpt-4o-mini-tts',
    voice,
    input: text,
    response_format: 'mp3',
    instructions: [
      process.env.DIALECTLAB_TTS_INSTRUCTIONS || DEFAULT_TTS_INSTRUCTIONS,
      STRENGTH_GUIDANCE[strength],
      'Prefer the given pronunciation over standard spelling conventions.',
      'Use audible southern Swedish cadence, darker vowels, and a relaxed melodic fall at clause endings.',
    ].join(' '),
  });

  return Buffer.from(await response.arrayBuffer());
}

async function synthesizeWithElevenLabs(text, speechSpeed, requestedVoice) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw createHttpError(503, 'ELEVENLABS_API_KEY is missing for the ElevenLabs audio backend.');
  }

  const voice = resolveElevenLabsVoice(requestedVoice);
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: getElevenLabsModelId(),
        language_code: 'sv',
        voice_settings: getElevenLabsVoiceSettings(speechSpeed),
        apply_text_normalization: 'off',
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw createHttpError(
      response.status,
      `ElevenLabs TTS failed with status ${response.status}: ${errorText.slice(0, 300)}`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

async function synthesizeSpeech(openai, text, voice, strength, speechSpeed) {
  const backend = getAudioBackend();

  if (backend === 'elevenlabs_tts') {
    return synthesizeWithElevenLabs(text, speechSpeed, voice);
  }

  return synthesizeWithOpenAI(openai, text, voice, strength);
}

async function transformSpeechToDialect(req) {
  if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
    throw createHttpError(400, 'Attach an audio file in the "audio" field.');
  }

  const startedAt = Date.now();
  const strength = normalizeStrength(req.body?.strength);
  const voice = getConfiguredVoice(req.body?.voice);
  const audioBackend = getAudioBackend();
  const speechSpeed = getSpeechSpeed(req.body?.speechSpeed);
  const clientRecordingMs = Number(req.body?.clientRecordingMs);
  const openai = getOpenAIClient();

  const transcriptionStartedAt = Date.now();
  const transcription = await transcribeSpeech(openai, req.file);
  const transcriptionMs = Date.now() - transcriptionStartedAt;
  const transcript = transcription.text;
  if (!transcript) {
    throw createHttpError(422, 'No speech was detected in the uploaded audio.');
  }

  const rewriteStartedAt = Date.now();
  const rewritten = await rewriteToSkanska(openai, transcript, strength, transcription.language);
  const rewriteMs = Date.now() - rewriteStartedAt;
  const synthesisStartedAt = Date.now();
  const resolvedElevenLabsVoice = audioBackend === 'elevenlabs_tts' ? resolveElevenLabsVoice(voice) : null;
  const synthesizedAudioBuffer = await synthesizeSpeech(
    openai,
    rewritten.ttsText,
    voice,
    strength,
    speechSpeed,
  );
  const ttsMs = Date.now() - synthesisStartedAt;
  const resolvedVoice = audioBackend === 'elevenlabs_tts' ? resolvedElevenLabsVoice.label : voice;
  const speakerMode =
    audioBackend === 'elevenlabs_tts' ? 'configured' : BUILTIN_VOICE_SET.has(voice) ? 'builtin' : 'configured';

  return {
    transcript,
    transformedText: rewritten.displayText,
    ttsText: rewritten.ttsText,
    outputAudioBase64: synthesizedAudioBuffer.toString('base64'),
    outputAudioMimeType: 'audio/mpeg',
    meta: {
      latencyMs: Date.now() - startedAt,
      requestedStrength: strength,
      targetDialect: process.env.DIALECTLAB_TARGET_DIALECT || 'Skanska',
      sourceLanguage: transcription.language,
      transcriptionModel: process.env.DIALECTLAB_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
      rewriteModel: getTextModel(),
      ttsModel:
        audioBackend === 'elevenlabs_tts'
          ? getElevenLabsModelId()
          : process.env.DIALECTLAB_TTS_MODEL || 'gpt-4o-mini-tts',
      voice: resolvedVoice,
      speakerMode,
      audioBackend,
      accentStrategy: sanitizeAccentStrategy(rewritten.accentStrategy),
      speechSpeed,
      timings: {
        transcribeMs: transcriptionMs,
        rewriteMs,
        ttsMs,
      },
      clientRecordingMs: Number.isFinite(clientRecordingMs) ? Math.max(clientRecordingMs, 0) : null,
      transcriptChars: transcript.length,
      transformedChars: rewritten.displayText.length,
      ttsChars: rewritten.ttsText.length,
      warnings:
        audioBackend === 'elevenlabs_tts'
          ? [
              'Audio is rendered by ElevenLabs using the selected Skanska voice. OpenAI is still used for transcription and rewrite control.',
              'This build now defaults to Eleven Turbo v2.5 for a stronger quality/speed balance. Switch ELEVENLABS_MODEL_ID if you want to compare providers or latency profiles.',
              'Input language can be auto-detected. Output is still always Swedish with Skanska colouring.',
            ]
          : speakerMode === 'builtin'
          ? [
              'Using a built-in OpenAI voice. This can shift wording and cadence, but strong dialect colour still benefits from a custom voice later.',
            ]
          : [],
    },
  };
}

function getPublicConfig() {
  const audioBackend = getAudioBackend();
  const elevenLabsVoices = getElevenLabsVoices();
  const defaultVoice = audioBackend === 'elevenlabs_tts' ? elevenLabsVoices[0]?.id : getConfiguredVoice('');

  return {
    appName: 'Dialektlab',
    targetDialect: getTargetDialect(),
    audioBackend,
    defaultVoice,
    availableVoices: audioBackend === 'elevenlabs_tts' ? elevenLabsVoices : BUILTIN_VOICES,
    speechSpeed: getSpeechSpeed(),
    defaults: {
      speechSpeed: DEFAULT_SPEECH_SPEED,
    },
    speakerMode:
      audioBackend === 'elevenlabs_tts'
        ? 'configured'
        : BUILTIN_VOICE_SET.has(defaultVoice)
          ? 'builtin'
          : 'configured',
    inputLanguage: process.env.DIALECTLAB_INPUT_LANGUAGE || 'auto',
  };
}

module.exports = {
  transformSpeechToDialect,
  getPublicConfig,
};
