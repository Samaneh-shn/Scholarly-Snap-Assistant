// server.js
const express = require('express');
const fs      = require('fs').promises;
const path    = require('path');
const fetch   = require('node-fetch');
const dotenv  = require('dotenv');
const ffmpeg  = require('fluent-ffmpeg');
const cors = require('cors');
const os      = require('os');

dotenv.config();

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const OPENAI_API_KEY     = process.env.OPENAI_API_KEY;
const app                = express();

// Enable CORS for all routes
app.use(cors());

// Parse raw audio & JSON
app.use(express.raw({ type: 'audio/*', limit: '50mb' }));
app.use(express.json());

// Friendly error mapper
const handleApiError = (resp, api) => {
  const msgs = {
    400: `Bad request to ${api}.`,
    401: `Authentication failed for ${api}.`,
    429: `Rate limit exceeded for ${api}.`,
    500: `Server error from ${api}.`,
    503: `${api} is temporarily unavailable.`
  };
  return msgs[resp.status] || `Unexpected error from ${api} (Status ${resp.status}).`;
};

// Convert arbitrary audio buffer to WAV PCM
const convertToWav = (inputBuffer, outputPath) =>
  new Promise((resolve, reject) => {
    const tmpIn = path.join(os.tmpdir(), `in-${Date.now()}.tmp`);
    fs.writeFile(tmpIn, inputBuffer)
      .then(() => {
        ffmpeg(tmpIn)
          .output(outputPath)
          .audioCodec('pcm_s16le')
          .format('wav')
          .on('end', () => fs.unlink(tmpIn).then(resolve))
          .on('error', err => fs.unlink(tmpIn).catch(() => {}).then(() => reject(err)))
          .run();
      })
      .catch(reject);
  });

// --- Upload audio & forward to AssemblyAI ---
app.post('/api/upload', async (req, res) => {
  try {
    const buffer = req.body;
    if (!buffer || !buffer.length) throw new Error('No audio data provided.');

    const wavPath = path.join(os.tmpdir(), `conv-${Date.now()}.wav`);
    await convertToWav(buffer, wavPath);
    const wavBuffer = await fs.readFile(wavPath);

    const aiResp = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY,
        'Content-Type':   'audio/wav'
      },
      body: wavBuffer
    });
    if (!aiResp.ok) throw new Error(handleApiError(aiResp, 'AssemblyAI'));
    const data = await aiResp.json();

    await fs.unlink(wavPath).catch(() => {});
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: `Upload failed: ${err.message}` });
  }
});

// --- Kick off transcription ---
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audio_url } = req.body;
    if (!audio_url || !audio_url.startsWith('https://')) {
      throw new Error('Invalid or missing audio_url.');
    }
    const aiResp = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY,
        'Content-Type':   'application/json'
      },
      body: JSON.stringify({ audio_url })
    });
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      throw new Error(`${handleApiError(aiResp, 'AssemblyAI')} ${txt}`);
    }
    const data = await aiResp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: `Transcription failed: ${err.message}` });
  }
});

// --- Poll transcription status ---
app.get('/api/transcript/:id', async (req, res) => {
  try {
    const aiResp = await fetch(`https://api.assemblyai.com/v2/transcript/${req.params.id}`, {
      headers: { 'Authorization': ASSEMBLYAI_API_KEY }
    });
    if (!aiResp.ok) throw new Error(handleApiError(aiResp, 'AssemblyAI'));
    const data = await aiResp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: `Transcription status failed: ${err.message}` });
  }
});

// --- Summarization with adjusted caps & explicit short‐style instructions ---
app.post('/api/summarize', async (req, res) => {
  try {
    const { text, summary_length } = req.body;
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid or missing transcript text.');
    }

    // Flat token caps per style
    const lengthCaps = {
      short:    100,   // ~1–2 sentences
      medium:   300,   // ~2–3 sentences
      detailed: 500    // ~3–5 sentences
    };
    const style = summary_length && lengthCaps[summary_length]
      ? summary_length
      : 'medium';

    // Reserve tokens for the prompts
    const promptOverhead = 20;
    const maxTokens      = lengthCaps[style] - promptOverhead;

    // Human‐friendly sentence labels
    const sentenceLabels = {
      short:    '1–2 sentences',
      medium:   '2–3 sentences',
      detailed: '3–5 sentences'
    };
    const sentenceCount = sentenceLabels[style];

    // For short style, explicitly require exactly two complete sentences
    const extraInstruction = style === 'short'
      ? 'Use exactly two complete sentences.'
      : '';

    // Build prompts
    const systemPrompt = `
You are a friendly academic assistant.
${extraInstruction}
Summarize the content of the provided audio transcript (e.g. a lecture or meeting)
in ${sentenceCount}, focusing on the key academic points.
Ensure you finish each sentence in full and do not cut off mid-sentence.
    `.trim();

    const userPrompt = `
Here is the transcript of an audio recording:

${text}

Please summarize its key points.
    `.trim();

    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        model:       'gpt-3.5-turbo',
        messages:    [
          { role: 'system', content: systemPrompt },
          { role:  'user', content: userPrompt }
        ],
        max_tokens:  maxTokens,
        temperature: 0.7
      })
    });

    if (!aiResp.ok) throw new Error(handleApiError(aiResp, 'OpenAI'));
    const aiJson = await aiResp.json();
    if (aiJson.error) throw new Error(aiJson.error.message);

    res.json({
      summary:         aiJson.choices[0].message.content.trim(),
      selected_length: style
    });
  } catch (err) {
    res.status(500).json({ error: `Summarization failed: ${err.message}` });
  }
});

// Serve static assets & root
app.use(express.static('.'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Start server
app.listen(8000, () => console.log('Server running on http://localhost:8000'));
