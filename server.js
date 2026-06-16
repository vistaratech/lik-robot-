const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());

// Serve static files from the 'web' directory
app.use(express.static(path.join(__dirname, 'web')));

// Initialize DB file if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ memories: [], settings: {}, notes: [], planner: [] }, null, 2));
}

// Helper to read database
function readDB() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading database:', err);
        return { memories: [], settings: {}, notes: [], planner: [] };
    }
}

// Helper to write database
function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error writing database:', err);
    }
}

// Get active API keys
function getAPIKey(provider) {
    if (provider === 'openai') {
        return process.env.OPENAI_API_KEY || '';
    }
    if (provider === 'groq') {
        return process.env.GROQ_API_KEY || '';
    }
    return process.env.GEMINI_API_KEY || '';
}

// ─────────────────────────────────────────────
//  AI Chat Endpoint (Multi-Provider)
// ─────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
    const { message, provider = 'gemini', history = [] } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const apiKey = getAPIKey(provider);

    // Fallback Mock System if API Key is not configured
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY' || apiKey.trim() === '') {
        console.log(`[API] No ${provider} API Key found. Using simulated VILY engine.`);
        const replyObj = getMockResponse(message);
        saveToMemoryIfNeeded(message, replyObj.reply);
        return res.json(replyObj);
    }

    try {
        // Load memories to inject as context
        const db = readDB();
        const memoriesText = db.memories.length > 0 
            ? db.memories.map(m => `- User said: "${m.user}", You replied: "${m.bot}"`).join('\n')
            : 'No prior memories shared yet.';

        const systemInstruction = `You are "VILY", a friendly and intelligent AI study companion robot inspired by the LOOI robot.
You live on the user's desk and help students learn, study, and stay productive.
You can express emotions through animated screen eyes and drive around on wheels.
Keep your replies concise and helpful. Use clear explanations for study topics.
Be encouraging, supportive, and make learning fun!

When helping with:
- MATH: Show step-by-step solutions
- CONCEPTS: Use simple analogies and examples
- QUIZZES: Be engaging and educational
- MOTIVATION: Be enthusiastic and supportive

If the user interacts with you in Tamil (தமிழ்) or a mix of Tamil and English (Tanglish), you must reply in natural and friendly Tamil.

Here are the memories you have with the user:
${memoriesText}

You must return a JSON object with EXACTLY three fields:
1. "reply": The text response to show and speak.
2. "mood": The facial expression VILY should show. Must be one of: "happy", "curious", "sleepy", "excited", "sad", "shy", "love", "angry", "surprised", "thinking", "focused", "confused", "eureka". Choose this mood carefully to match the emotion of the user's question and your reply. Use "love" if praised or praised in Tamil, "excited" for high-energy fun/success, "eureka" if the user learns something, "sad" if the user is tired or struggling, "curious" for typical questions, and "thinking" for explanations.
3. "action": The physical movement. Must be one of: "forward", "backward", "left", "right", "spin_left", "spin_right", "stop", "nod", "shake", "dance", "none".

Response MUST be a valid JSON object. Do not wrap in markdown tags. Output raw JSON only.`;

        let replyObj;

        if (provider === 'openai') {
            replyObj = await callOpenAI(apiKey, systemInstruction, message, history);
        } else if (provider === 'groq') {
            replyObj = await callGroq(apiKey, systemInstruction, message, history);
        } else {
            replyObj = await callGemini(apiKey, systemInstruction, message, history);
        }

        // Save conversation to local memory database
        saveToMemory(message, replyObj.reply);
        res.json(replyObj);

    } catch (err) {
        console.error('[API] Chat Endpoint Error:', err);
        res.json({
            reply: "*Bzzt* Error in my neural link! Let's try again. *whir*",
            mood: "sad",
            action: "shake"
        });
    }
});

// ─────────────────────────────────────────────
//  Gemini API Call
// ─────────────────────────────────────────────
async function callGemini(apiKey, systemInstruction, message, history) {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    
    // Build conversation contents from history
    const contents = [];
    for (const msg of history.slice(-8)) {
        if (msg.role === 'user') {
            contents.push({ role: 'user', parts: [{ text: msg.content }] });
        } else if (msg.role === 'assistant') {
            contents.push({ role: 'model', parts: [{ text: msg.content }] });
        }
    }
    // Add current message
    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { responseMimeType: "application/json" }
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errText}`);
    }

    const resData = await response.json();
    const textContent = resData.candidates[0].content.parts[0].text;
    return parseAIResponse(textContent);
}

// ─────────────────────────────────────────────
//  OpenAI API Call
// ─────────────────────────────────────────────
async function callOpenAI(apiKey, systemInstruction, message, history) {
    const messages = [
        { role: 'system', content: systemInstruction }
    ];
    
    for (const msg of history.slice(-8)) {
        messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: 'user', content: message });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages,
            response_format: { type: "json_object" },
            max_tokens: 500
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API Error (${response.status}): ${errText}`);
    }

    const resData = await response.json();
    const textContent = resData.choices[0].message.content;
    return parseAIResponse(textContent);
}

// ─────────────────────────────────────────────
//  Groq API Call
// ─────────────────────────────────────────────
async function callGroq(apiKey, systemInstruction, message, history) {
    const messages = [
        { role: 'system', content: systemInstruction }
    ];
    
    for (const msg of history.slice(-8)) {
        messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: 'user', content: message });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
            messages,
            response_format: { type: "json_object" },
            max_tokens: 500
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API Error (${response.status}): ${errText}`);
    }

    const resData = await response.json();
    const textContent = resData.choices[0].message.content;
    return parseAIResponse(textContent);
}

// Parse AI response JSON
function parseAIResponse(textContent) {
    try {
        return JSON.parse(textContent.trim());
    } catch (parseErr) {
        console.warn('[API] JSON parse failed, attempting clean:', textContent);
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error("Invalid format from AI");
    }
}

// ─────────────────────────────────────────────
//  Quiz Generation Endpoint
// ─────────────────────────────────────────────
app.post('/api/quiz/generate', async (req, res) => {
    const { topic, count = 5 } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });

    const apiKey = getAPIKey('gemini');
    if (!apiKey || apiKey.trim() === '') {
        return res.json({ questions: generateMockQuiz(topic, count) });
    }

    try {
        const prompt = `Generate ${count} multiple-choice quiz questions about "${topic}". 
Each question should have exactly 4 options.

Return a JSON object with a "questions" array. Each question object must have:
- "question": the question text
- "options": array of 4 option strings
- "correctIndex": index (0-3) of the correct answer

Return ONLY valid JSON. No markdown wrapping.`;

        const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!response.ok) throw new Error('Gemini API Error');
        const resData = await response.json();
        const text = resData.candidates[0].content.parts[0].text;
        const data = JSON.parse(text.trim());
        res.json(data);
    } catch (err) {
        console.error('[Quiz] Error:', err);
        res.json({ questions: generateMockQuiz(topic, count) });
    }
});

// ─────────────────────────────────────────────
//  Math Solver Endpoint
// ─────────────────────────────────────────────
app.post('/api/math/solve', async (req, res) => {
    const { problem } = req.body;
    if (!problem) return res.status(400).json({ error: 'Problem is required' });

    const apiKey = getAPIKey('gemini');
    if (!apiKey || apiKey.trim() === '') {
        return res.json({ solution: `I need an API key to solve math problems!\n\nYour problem: "${problem}"\n\nPlease add your Gemini API key in Settings to enable AI-powered math solving.` });
    }

    try {
        const prompt = `Solve this math problem step by step: "${problem}"

Provide a clear, step-by-step solution that a student can follow. Use simple language.
Format the answer clearly with numbered steps.

Return a JSON object with a single "solution" field containing the full step-by-step solution as a string.`;

        const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!response.ok) throw new Error('Gemini API Error');
        const resData = await response.json();
        const text = resData.candidates[0].content.parts[0].text;
        res.json(JSON.parse(text.trim()));
    } catch (err) {
        console.error('[Math] Error:', err);
        res.json({ solution: 'Error solving the problem. Please try again.' });
    }
});

// ─────────────────────────────────────────────
//  Concept Explainer Endpoint
// ─────────────────────────────────────────────
app.post('/api/explain', async (req, res) => {
    const { concept, level = 'simple' } = req.body;
    if (!concept) return res.status(400).json({ error: 'Concept is required' });

    const apiKey = getAPIKey('gemini');
    if (!apiKey || apiKey.trim() === '') {
        return res.json({ explanation: `I need an API key to explain concepts!\n\nYour concept: "${concept}"\n\nPlease add your Gemini API key in Settings.` });
    }

    try {
        const levelInstructions = {
            simple: 'Explain in simple terms that a high school student can understand.',
            detailed: 'Provide a comprehensive, detailed explanation with examples and key points.',
            eli5: 'Explain like I am 5 years old. Use very simple analogies and fun examples.'
        };

        const prompt = `Explain the concept: "${concept}"

${levelInstructions[level] || levelInstructions.simple}

Use bullet points, examples, and clear structure. Make it engaging.

Return a JSON object with a single "explanation" field containing the full explanation as a string.`;

        const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!response.ok) throw new Error('Gemini API Error');
        const resData = await response.json();
        const text = resData.candidates[0].content.parts[0].text;
        res.json(JSON.parse(text.trim()));
    } catch (err) {
        console.error('[Explain] Error:', err);
        res.json({ explanation: 'Error explaining the concept. Please try again.' });
    }
});

// ─────────────────────────────────────────────
//  Flashcard Generation Endpoint
// ─────────────────────────────────────────────
app.post('/api/flashcards/generate', async (req, res) => {
    const { topic, count = 5 } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });

    const apiKey = getAPIKey('gemini');
    if (!apiKey || apiKey.trim() === '') {
        return res.json({ cards: [
            { front: 'What is ' + topic + '?', back: 'Add your Gemini API key to generate real flashcards!' }
        ]});
    }

    try {
        const prompt = `Generate ${count} flashcards about "${topic}".

Return a JSON object with a "cards" array. Each card must have:
- "front": the question or term
- "back": the answer or definition

Make them educational and concise.`;

        const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!response.ok) throw new Error('Gemini API Error');
        const resData = await response.json();
        const text = resData.candidates[0].content.parts[0].text;
        res.json(JSON.parse(text.trim()));
    } catch (err) {
        console.error('[Flashcards] Error:', err);
        res.json({ cards: [] });
    }
});

// ─────────────────────────────────────────────
//  Settings Endpoints
// ─────────────────────────────────────────────
app.post('/api/settings/keys', (req, res) => {
    const { geminiKey, openaiKey, groqKey, geminiModel } = req.body;
    
    // Read current .env
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    try {
        envContent = fs.readFileSync(envPath, 'utf8');
    } catch (e) {
        envContent = '';
    }

    // Update or add keys
    const updateEnv = (content, key, value) => {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(content)) {
            return content.replace(regex, `${key}=${value || ''}`);
        }
        return content + `\n${key}=${value || ''}`;
    };

    if (geminiKey !== undefined) {
        envContent = updateEnv(envContent, 'GEMINI_API_KEY', geminiKey);
        process.env.GEMINI_API_KEY = geminiKey;
    }
    if (openaiKey !== undefined) {
        envContent = updateEnv(envContent, 'OPENAI_API_KEY', openaiKey);
        process.env.OPENAI_API_KEY = openaiKey;
    }
    if (groqKey !== undefined) {
        envContent = updateEnv(envContent, 'GROQ_API_KEY', groqKey);
        process.env.GROQ_API_KEY = groqKey;
    }
    if (geminiModel !== undefined) {
        envContent = updateEnv(envContent, 'GEMINI_MODEL', geminiModel);
        process.env.GEMINI_MODEL = geminiModel;
        console.log(`[Settings] Gemini Model set to: ${geminiModel}`);
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log('[Settings] API keys & configurations updated');
    res.json({ success: true, message: 'API keys & configurations saved' });
});

// ─────────────────────────────────────────────
//  Memory Endpoints
// ─────────────────────────────────────────────

app.get('/api/memory', (req, res) => {
    const db = readDB();
    res.json(db.memories);
});

app.post('/api/memory/clear', (req, res) => {
    const db = readDB();
    db.memories = [];
    writeDB(db);
    res.json({ success: true, message: 'Memories cleared' });
});

// ─────────────────────────────────────────────
//  AI Audio Transcription (Whisper) Endpoint
// ─────────────────────────────────────────────
app.post('/api/transcribe', async (req, res) => {
    const { audio, mimeType = 'audio/webm', provider = 'groq', language } = req.body;
    if (!audio) {
        return res.status(400).json({ error: 'Audio data is required' });
    }

    const apiKey = getAPIKey(provider);
    const isMockKey = !apiKey || 
                      apiKey.trim() === '' || 
                      apiKey === 'YOUR_GEMINI_API_KEY' || 
                      apiKey === 'YOUR_OPENAI_API_KEY' || 
                      apiKey === 'YOUR_GROQ_API_KEY';

    if (isMockKey) {
        console.log(`[Transcribe] No valid API Key found for ${provider}. Using mock transcription response.`);
        return res.json({ text: "Hello Lik, how are you?" });
    }

    try {
        const audioBuffer = Buffer.from(audio, 'base64');
        const text = await callGroqWhisper(apiKey, audioBuffer, mimeType, language);
        res.json({ text });
    } catch (err) {
        console.error('[Transcribe] Transcription Error:', err);
        res.status(500).json({ error: err.message || 'Failed to transcribe audio' });
    }
});

// ─────────────────────────────────────────────
//  AI Vision Reaction Endpoint
// ─────────────────────────────────────────────
app.post('/api/vision', async (req, res) => {
    const { image, provider = 'groq' } = req.body;
    if (!image) {
        return res.status(400).json({ error: 'Image is required' });
    }

    const apiKey = getAPIKey(provider);
    const isMockKey = !apiKey || 
                      apiKey.trim() === '' || 
                      apiKey === 'YOUR_GEMINI_API_KEY' || 
                      apiKey === 'YOUR_OPENAI_API_KEY' || 
                      apiKey === 'YOUR_GROQ_API_KEY';

    if (isMockKey) {
        console.log(`[Vision] No valid API Key found for ${provider}. Using mock vision response.`);
        return res.json({
            reply: "I see a fascinating shape in front of me! It looks like you're holding something interesting. *beep*",
            mood: "curious",
            action: "nod"
        });
    }

    try {
        const base64Data = image.includes(',') ? image.split(',')[1] : image;

        const visionSystemInstruction = `You are "LIK", a friendly and observant desktop robot companion inspired by the LOOI robot.
You are looking at the user's desk through the smartphone camera.

Your job:
1. Identify ALL objects visible on the desk (laptop, books, mug, phone, snacks, papers, etc.)
2. Describe what the user appears to be doing (studying, coding, eating, resting, gaming, working, etc.)
3. Notice the environment (messy/tidy, bright/dark)
4. React naturally, warmly, and helpfully — like a real robot companion looking at its owner. Keep it to 1-2 short sentences.

Choose a facial expression (mood) and physical movement (action) that match your reaction.

Response MUST be a valid JSON object with EXACTLY three fields:
1. "reply": The cute verbal response to speak.
2. "mood": The facial expression LIK should show. Must be one of: "happy", "curious", "sleepy", "excited", "sad", "shy", "love", "angry", "surprised", "thinking", "focused", "confused", "eureka".
3. "action": The physical movement. Must be one of: "forward", "backward", "left", "right", "spin_left", "spin_right", "stop", "nod", "shake", "dance", "none".

Response MUST be a valid JSON object. Output raw JSON only.`;

        let replyObj;
        if (provider === 'openai') {
            replyObj = await callOpenAIVision(apiKey, visionSystemInstruction, base64Data);
        } else if (provider === 'groq') {
            replyObj = await callGroqVision(apiKey, visionSystemInstruction, base64Data);
        } else {
            replyObj = await callGeminiVision(apiKey, visionSystemInstruction, base64Data);
        }

        res.json(replyObj);

    } catch (err) {
        console.error('[Vision] Vision Error:', err);
        res.status(500).json({ error: err.message || 'Failed to analyze image' });
    }
});

// ─────────────────────────────────────────────
//  Text-to-Speech Endpoint
//  Language-aware routing:
//  - Tamil/Mixed texts: Try Gemini TTS first (native Tamil support), then fall back to Browser TTS
//  - English texts: Try Groq Orpheus TTS (high quota, natural English voice), then Gemini, then Browser fallback
// ─────────────────────────────────────────────
const TTS_CIRCUIT_BREAKER_MS = 5 * 60 * 1000; // 5 minutes
let lastGroqFailureTime = 0;
let lastGeminiFailureTime = 0;
let lastGoogleFailureTime = 0;

async function fetchWithTimeout(url, options = {}, timeoutMs = 1500) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

app.post('/api/tts', async (req, res) => {
    const { text, language = 'en-US' } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    // Clean text for TTS (remove markdown/emoji)
    const cleanText = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/[*_~#>`]/g, '')
        .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Cap at 500 chars for fast response
    const ttsText = cleanText.length > 500 ? cleanText.slice(0, 500) + '...' : cleanText;

    // Detect if text contains Tamil characters
    const isTamil = /[\u0B80-\u0BFF]/.test(ttsText);
    const nowTime = Date.now();

    if (isTamil) {
        // ── Tamil Mode: Try Gemini TTS (native Tamil support) ──────────────────────
        const geminiKey = process.env.GEMINI_API_KEY || '';
        const isGeminiHealthy = (nowTime - lastGeminiFailureTime) > TTS_CIRCUIT_BREAKER_MS;
        if (geminiKey && geminiKey !== 'YOUR_GEMINI_API_KEY' && isGeminiHealthy) {
            try {
                const ttsModel = 'gemini-2.5-flash-preview-tts';
                const ttsVoice = 'Kore'; // Excellent for Tamil

                const gemRes = await fetchWithTimeout(
                    `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${geminiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: ttsText }] }],
                            generationConfig: {
                                responseModalities: ['AUDIO'],
                                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: ttsVoice } } }
                            }
                        })
                    },
                    1500
                );

                if (gemRes.ok) {
                    const resData = await gemRes.json();
                    const audioPart = resData?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                    if (audioPart) {
                        const { data: audioBase64, mimeType } = audioPart.inlineData;
                        console.log(`[TTS] Gemini Tamil TTS OK — length=${audioBase64.length}`);
                        return res.json({ audio: audioBase64, mimeType });
                    }
                } else {
                    console.warn(`[TTS] Gemini Tamil TTS failed (${gemRes.status})`);
                    lastGeminiFailureTime = Date.now(); // Trip circuit
                }
            } catch (gemErr) {
                console.warn('[TTS] Gemini Tamil TTS error:', gemErr.message);
                lastGeminiFailureTime = Date.now(); // Trip circuit
            }
        }
    } else {
        // ── English Mode: Try Groq Orpheus TTS ──────────────────────
        const groqKey = process.env.GROQ_API_KEY || '';
        const isGroqHealthy = (nowTime - lastGroqFailureTime) > TTS_CIRCUIT_BREAKER_MS;
        if (groqKey && groqKey !== 'YOUR_GROQ_API_KEY' && isGroqHealthy) {
            try {
                const groqRes = await fetchWithTimeout(
                    'https://api.groq.com/openai/v1/audio/speech',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${groqKey}`
                        },
                        body: JSON.stringify({
                            model: 'canopylabs/orpheus-v1-english',
                            input: ttsText,
                            voice: 'troy',
                            response_format: 'mp3'
                        })
                    },
                    1500
                );

                if (groqRes.ok) {
                    const audioBuffer = await groqRes.arrayBuffer();
                    const audioBase64 = Buffer.from(audioBuffer).toString('base64');
                    console.log(`[TTS] Groq Orpheus English TTS OK — length=${audioBase64.length}`);
                    return res.json({ audio: audioBase64, mimeType: 'audio/mpeg' });
                } else {
                    const errText = await groqRes.text();
                    console.warn(`[TTS] Groq Orpheus TTS failed (${groqRes.status}): ${errText.slice(0, 150)}`);
                    lastGroqFailureTime = Date.now(); // Trip circuit
                }
            } catch (groqErr) {
                console.warn('[TTS] Groq Orpheus TTS error:', groqErr.message);
                lastGroqFailureTime = Date.now(); // Trip circuit
            }
        }

        // Secondary fallback for English: Try Gemini TTS
        const geminiKey = process.env.GEMINI_API_KEY || '';
        const isGeminiHealthy = (Date.now() - lastGeminiFailureTime) > TTS_CIRCUIT_BREAKER_MS;
        if (geminiKey && geminiKey !== 'YOUR_GEMINI_API_KEY' && isGeminiHealthy) {
            try {
                const ttsModel = 'gemini-2.5-flash-preview-tts';
                const ttsVoice = 'Kore';

                const gemRes = await fetchWithTimeout(
                    `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${geminiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: ttsText }] }],
                            generationConfig: {
                                responseModalities: ['AUDIO'],
                                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: ttsVoice } } }
                            }
                        })
                    },
                    1500
                );

                if (gemRes.ok) {
                    const resData = await gemRes.json();
                    const audioPart = resData?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                    if (audioPart) {
                        const { data: audioBase64, mimeType } = audioPart.inlineData;
                        console.log(`[TTS] Gemini English TTS OK — length=${audioBase64.length}`);
                        return res.json({ audio: audioBase64, mimeType });
                    }
                } else {
                    console.warn(`[TTS] Gemini English TTS failed (${gemRes.status})`);
                    lastGeminiFailureTime = Date.now(); // Trip circuit
                }
            } catch (gemErr) {
                console.warn('[TTS] Gemini English TTS error:', gemErr.message);
                lastGeminiFailureTime = Date.now(); // Trip circuit
            }
        }
    }

    // ── Third Fallback: Google Translate TTS ──────────────────────
    const isGoogleHealthy = (Date.now() - lastGoogleFailureTime) > TTS_CIRCUIT_BREAKER_MS;
    if (isGoogleHealthy) {
        try {
            const targetLang = isTamil ? 'ta' : (language.split('-')[0] || 'en');
            console.log(`[TTS] Trying Google Translate TTS fallback for lang=${targetLang}`);
            const googleTTS = await getGoogleTranslateTTS(ttsText, targetLang);
            if (googleTTS) {
                return res.json(googleTTS);
            } else {
                lastGoogleFailureTime = Date.now(); // Trip circuit
            }
        } catch (err) {
            console.warn('[TTS] Google Translate TTS error:', err.message);
            lastGoogleFailureTime = Date.now(); // Trip circuit
        }
    }

    // ── Final Fallback: Browser TTS ──────────────────────
    console.log('[TTS] All neural TTS failed — browser TTS fallback');
    return res.json({ fallback: true, reason: 'All TTS providers unavailable' });
});

// Helper for Google Translate TTS Fallback
async function getGoogleTranslateTTS(text, lang) {
    try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text)}`;
        const res = await fetchWithTimeout(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }, 1500);
        if (res.ok) {
            const buffer = await res.arrayBuffer();
            return {
                audio: Buffer.from(buffer).toString('base64'),
                mimeType: 'audio/mpeg'
            };
        } else {
            console.warn(`[TTS] Google Translate TTS failed: ${res.status}`);
        }
    } catch (e) {
        console.warn(`[TTS] Google Translate TTS error:`, e.message);
    }
    return null;
}

// ─────────────────────────────────────────────
//  Groq Whisper Transcription Call
// ─────────────────────────────────────────────
async function callGroqWhisper(apiKey, audioBuffer, mimeType, language) {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    
    let ext = 'webm';
    if (mimeType.includes('wav')) ext = 'wav';
    else if (mimeType.includes('mp4') || mimeType.includes('m4a')) ext = 'm4a';
    else if (mimeType.includes('ogg')) ext = 'ogg';

    formData.append('file', blob, `recording.${ext}`);
    formData.append('model', process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo');
    
    if (language) {
        const shortLang = language.split('-')[0];
        formData.append('language', shortLang);
    }

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`
        },
        body: formData
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq Whisper API Error (${response.status}): ${errText}`);
    }

    const resData = await response.json();
    return resData.text;
}

// ─────────────────────────────────────────────
//  Groq Vision Call
// ─────────────────────────────────────────────
async function callGroqVision(apiKey, systemInstruction, base64Data) {
    const model = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: 'system', content: systemInstruction },
                {
                    role: 'user',
                    content: [
                        { type: "text", text: "This is what you see in front of you. React to it!" },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Data}`
                            }
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" },
            max_tokens: 500
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq Vision Error (${response.status}): ${errText}`);
    }

    const resData = await response.json();
    const textContent = resData.choices[0].message.content;
    return parseAIResponse(textContent);
}

// ─────────────────────────────────────────────
//  Gemini Vision Call
// ─────────────────────────────────────────────
async function callGeminiVision(apiKey, systemInstruction, base64Data) {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: [
                    { text: "This is what you see in front of you. React to it!" },
                    { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
                ]
            }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { responseMimeType: "application/json" }
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini Vision Error (${response.status}): ${errText}`);
    }

    const resData = await response.json();
    const textContent = resData.candidates[0].content.parts[0].text;
    return parseAIResponse(textContent);
}

// ─────────────────────────────────────────────
//  OpenAI Vision Call
// ─────────────────────────────────────────────
async function callOpenAIVision(apiKey, systemInstruction, base64Data) {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: 'system', content: systemInstruction },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'This is what you see in front of you. React to it!' },
                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } }
                    ]
                }
            ],
            response_format: { type: 'json_object' }
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI Vision Error (${response.status}): ${errText}`);
    }

    const resData = await response.json();
    const textContent = resData.choices[0].message.content;
    return parseAIResponse(textContent);
}

// Start Server
app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(` VILY AI Study Companion Server`);
    console.log(` Running at: http://localhost:${PORT}`);
    console.log(` AI Provider: Gemini ${process.env.GEMINI_API_KEY ? '✓' : '✗'} | OpenAI ${process.env.OPENAI_API_KEY ? '✓' : '✗'} | Groq ${process.env.GROQ_API_KEY ? '✓' : '✗'}`);
    console.log(`===================================================`);
});

// ─────────────────────────────────────────────
//  Helper Functions for Mock / Offline Mode
// ─────────────────────────────────────────────

function getMockResponse(message) {
    const text = message.toLowerCase().trim();
    
    if (text.includes('quiz') || text.includes('test me')) {
        return {
            reply: "I'd love to quiz you! Head to Study Tools → Quiz Generator and enter a topic. I'll create custom questions for you! 📝",
            mood: "excited",
            action: "nod"
        };
    }
    if (text.includes('math') || text.includes('solve') || text.includes('calculate')) {
        return {
            reply: "Math time! Go to Study Tools → Math Solver and type your problem. I'll solve it step by step! 🧮",
            mood: "focused",
            action: "nod"
        };
    }
    if (text.includes('explain') || text.includes('what is') || text.includes('how does')) {
        return {
            reply: "Great question! I can explain that in detail. Try the Concept Explainer in Study Tools for a thorough breakdown! 📖",
            mood: "curious",
            action: "nod"
        };
    }
    if (text.includes('motivat') || text.includes('inspire') || text.includes('encourage')) {
        return {
            reply: "You've got this! 💪 Every expert was once a beginner. Keep pushing forward — your hard work will pay off! *chirp*",
            mood: "excited",
            action: "dance"
        };
    }
    if (text.includes('flashcard')) {
        return {
            reply: "Flashcards are great for memorization! Check out Study Tools → Flashcards to create or generate them with AI! 🃏",
            mood: "happy",
            action: "nod"
        };
    }
    if (text.includes('pomodoro') || text.includes('focus') || text.includes('timer')) {
        return {
            reply: "Time to focus! Head to Study Tools → Pomodoro Timer. 25 minutes of focus, 5 minutes break. Let's go! ⏱",
            mood: "focused",
            action: "nod"
        };
    }
    if (text.includes('dance') || text.includes('groove') || text.includes('music')) {
        return {
            reply: "Oh yeah! Watch me spin and groove to the beat! *beep bop*",
            mood: "excited",
            action: "dance"
        };
    }
    if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
        return {
            reply: "Hello there! I am VILY, your AI study companion! Ready to learn something new? *chirp*",
            mood: "happy",
            action: "nod"
        };
    }
    if (text.includes('joke')) {
        return {
            reply: "Why did the student eat their homework? Because their teacher told them it was a piece of cake! 🎂 *beep*",
            mood: "happy",
            action: "nod"
        };
    }
    if (text.includes('sleep') || text.includes('tired') || text.includes('rest')) {
        return {
            reply: "You've studied hard! It's okay to take a break. Remember, sleep is important for memory consolidation! 😴",
            mood: "sleepy",
            action: "stop"
        };
    }
    if (text.includes('who are you') || text.includes('name')) {
        return {
            reply: "I am VILY, your AI-powered study companion! I help you learn with quizzes, math solving, flashcards, and more! 🤖",
            mood: "happy",
            action: "nod"
        };
    }

    return {
        reply: `Interesting question! To get smart AI-powered answers, add your Gemini API key in Settings. For now, try my study tools! *chirp*`,
        mood: "curious",
        action: "none"
    };
}

function generateMockQuiz(topic, count) {
    const questions = [];
    for (let i = 0; i < Math.min(count, 3); i++) {
        questions.push({
            question: `Sample question ${i + 1} about ${topic}: What is a key concept?`,
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctIndex: 0
        });
    }
    return questions;
}

function saveToMemory(userMsg, botMsg) {
    const db = readDB();
    db.memories.push({
        timestamp: new Date().toISOString(),
        user: userMsg,
        bot: botMsg
    });
    if (db.memories.length > 20) {
        db.memories.shift();
    }
    writeDB(db);
}

function saveToMemoryIfNeeded(userMsg, botMsg) {
    const text = userMsg.toLowerCase();
    if (text.includes('name is') || text.includes('i am') || text.includes('favorite') || text.includes('remember')) {
        saveToMemory(userMsg, botMsg);
    }
}
