/**
 * ═══════════════════════════════════════════════
 *  LIK Sound Engine v3.0
 *  Neural TTS via Gemini API + Procedural SFX
 *  Falls back to enhanced browser TTS when no key
 * ═══════════════════════════════════════════════
 */

class RobotSoundEngine {
    constructor() {
        this.ctx = null;
        this.soundEnabled = true;
        this.ttsEnabled = true;
        this.voice = null;
        this.activeUtterance = null;
        this.ttsAudioSource = null;
        this._isSpeakingNeural = false;
        this._ttsInFlight = false;
        this._lastTTSCallTime = 0; // Timestamp of last TTS API call (rate limit guard)
        this.useBrowserTTSOnly = false;

        if ('speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = () => this.loadVoice();
            this.loadVoice();
        }
    }

    /**
     * Initialize AudioContext on first user interaction (required by browsers)
     */
    initContext() {
        if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
            console.log('[Sound] Web Audio Context initialized.');
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    loadVoice() {
        if (!('speechSynthesis' in window)) return;
        const voices = window.speechSynthesis.getVoices();
        // Prefer natural-sounding voices — Google US English is the best available in Chrome
        const preferred = ['google us english', 'microsoft zira', 'samantha', 'karen', 'en-us', 'en-gb'];
        for (const pref of preferred) {
            const v = voices.find(voice =>
                voice.name.toLowerCase().includes(pref) || voice.lang.toLowerCase().includes(pref)
            );
            if (v) { this.voice = v; break; }
        }
        if (!this.voice && voices.length > 0) this.voice = voices[0];
    }

    /**
     * Play a synthesized beep with parameters
     */
    playBeep(freq, durationMs, type = 'sine', volume = 0.1, slideToFreq = 0) {
        if (!this.soundEnabled) return;
        this.initContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const duration = durationMs / 1000;

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (slideToFreq > 0) {
            osc.frequency.exponentialRampToValueAtTime(slideToFreq, now + duration);
        }

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(volume, now + 0.02);
        gainNode.gain.setValueAtTime(volume, now + duration - 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    }

    /**
     * Synthesize robot beep sounds based on expression/mood
     */
    playMoodSound(mood) {
        if (!this.soundEnabled) return;
        switch (mood) {
            case 'happy':
                this.playBeep(600, 100, 'sine', 0.1, 800);
                setTimeout(() => this.playBeep(800, 150, 'sine', 0.1, 1100), 120);
                break;
            case 'excited':
                this.playBeep(900, 80, 'sine', 0.12, 1300);
                setTimeout(() => this.playBeep(1100, 80, 'sine', 0.12, 1600), 90);
                setTimeout(() => this.playBeep(1400, 120, 'sine', 0.12, 2000), 180);
                break;
            case 'curious':
                this.playBeep(500, 120, 'sine', 0.08);
                setTimeout(() => this.playBeep(650, 250, 'sine', 0.08, 900), 140);
                break;
            case 'love':
                this.playBeep(440, 180, 'triangle', 0.15, 520);
                setTimeout(() => this.playBeep(554, 250, 'triangle', 0.15, 659), 200);
                break;
            case 'shy':
                this.playBeep(800, 200, 'sine', 0.05, 600);
                setTimeout(() => this.playBeep(600, 300, 'sine', 0.04, 400), 220);
                break;
            case 'sleepy':
                this.playBeep(260, 600, 'sine', 0.06);
                setTimeout(() => this.playBeep(220, 800, 'sine', 0.03), 700);
                break;
            case 'sad':
                this.playBeep(350, 400, 'sine', 0.1, 180);
                break;
            case 'angry':
                this.playBeep(120, 250, 'sawtooth', 0.15, 80);
                setTimeout(() => this.playBeep(100, 300, 'sawtooth', 0.12, 60), 200);
                break;
            case 'surprised':
                this.playBeep(1000, 60, 'sine', 0.15);
                setTimeout(() => this.playBeep(1200, 150, 'sine', 0.15, 800), 70);
                break;
            case 'focused':
                this.playBeep(350, 120, 'sine', 0.08, 480);
                setTimeout(() => this.playBeep(480, 400, 'sine', 0.06), 140);
                break;
            case 'confused':
                this.playBeep(450, 130, 'triangle', 0.1, 320);
                setTimeout(() => this.playBeep(320, 220, 'triangle', 0.08, 550), 150);
                break;
            case 'eureka':
                this.playBeep(523.25, 80, 'sine', 0.12, 659.25);
                setTimeout(() => this.playBeep(659.25, 80, 'sine', 0.12, 783.99), 90);
                setTimeout(() => this.playBeep(783.99, 180, 'sine', 0.12, 1046.5), 180);
                break;
        }
    }

    /**
     * Stop any currently playing TTS audio (both neural and browser)
     */
    stopSpeaking() {
        // Stop neural TTS audio if playing
        if (this.ttsAudioSource) {
            try { this.ttsAudioSource.stop(); } catch (e) {}
            this.ttsAudioSource = null;
        }
        this._isSpeakingNeural = false;
        this._ttsInFlight = false;

        // Stop browser TTS
        if (this.activeUtterance) {
            this.activeUtterance.onend = null;
            this.activeUtterance.onerror = null;
            this.activeUtterance = null;
        }
        if ('speechSynthesis' in window) {
            try {
                window.speechSynthesis.resume();
                window.speechSynthesis.cancel();
            } catch (e) {}
        }

        // Notify face
        if (window.app && window.app.face) {
            window.app.face.setSpeaking(false);
        }
    }

    /**
     * Kick off the /api/tts fetch early (while the chat bubble is being rendered)
     * Returns a Promise that resolves to { audio, mimeType } or null on failure.
     */
    async prefetchTTS(text, lang = 'en-US') {
        if (this.useBrowserTTSOnly) {
            return null;
        }
        this._lastTTSCallTime = Date.now();

        try {
            const res = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, language: lang, voice: 'Kore' })
            });
            if (!res.ok) return null;
            const data = await res.json();
            if (data.fallback || !data.audio) return null;
            console.log('[Sound] TTS pre-fetched successfully');
            return data; // { audio: base64, mimeType }
        } catch (e) {
            console.warn('[Sound] TTS prefetch failed:', e.message);
            return null;
        }
    }

    /**
     * Play using a pre-fetched TTS result (from prefetchTTS), or fall back to speak()
     * This removes the extra round-trip delay between text appearing and voice starting.
     */
    async speakWithPrefetch(text, ttsPromise, onEndCallback) {
        if (this.useBrowserTTSOnly) {
            const lang = localStorage.getItem('lik-voice-lang') || 'en-US';
            this._speakBrowser(text, lang, onEndCallback);
            return;
        }
        // Guard: prevent double-speak if already playing
        if (this._ttsInFlight) {
            console.log('[Sound] Double-speak blocked (already in flight)');
            return;
        }
        this._ttsInFlight = true;

        this.stopSpeaking();
        this.initContext();
        this._lastTTSText = text;

        if (window.app && window.app.face) window.app.face.setSpeaking(true);

        const done = (cb) => {
            this._ttsInFlight = false;
            if (cb) cb();
        };

        try {
            const ttsData = ttsPromise ? await ttsPromise : null;

            if (ttsData && ttsData.audio) {
                // Pre-fetched audio is ready — play immediately with no extra delay
                await this._playNeuralAudio(ttsData.audio, ttsData.mimeType, () => done(onEndCallback));
            } else {
                // No pre-fetched audio: use browser TTS
                const lang = localStorage.getItem('lik-voice-lang') || 'en-US';
                this._ttsInFlight = false;
                this._speakBrowser(text, lang, onEndCallback);
            }
        } catch (e) {
            console.error('[Sound] speakWithPrefetch error:', e);
            this._ttsInFlight = false;
            const lang = localStorage.getItem('lik-voice-lang') || 'en-US';
            this._speakBrowser(text, lang, onEndCallback);
        }
    }

    /**
     * ─── MAIN SPEAK FUNCTION ───
     *
     * 1. Try the server /api/tts (Gemini Neural TTS)
     * 2. If key missing or fails, fall back to enhanced browser speechSynthesis
     * 3. Always fires onEndCallback when done
     */
    async speak(text, onEndCallback) {
        if (onEndCallback !== undefined && typeof onEndCallback !== 'function') {
            console.warn('[Sound] speak() called with invalid callback — ignoring');
            onEndCallback = undefined;
        }
        if (!this.ttsEnabled) {
            console.log('[Sound] TTS is disabled.');
            if (onEndCallback) onEndCallback();
            return;
        }

        // Cancel any previous speech
        this.stopSpeaking();
        // Ensure AudioContext is ready
        this.initContext();

        // Notify app that LIK is speaking (guard for recording restart)
        if (window.app && window.app.face) {
            window.app.app?.face?.setSpeaking(true);
            if (window.app.face) window.app.face.setSpeaking(true);
        }

        const voiceLang = localStorage.getItem('lik-voice-lang') || 'en-US';
        this._lastTTSText = text; // Save for fallback use

        if (this.useBrowserTTSOnly) {
            this._speakBrowser(text, voiceLang, onEndCallback);
            return;
        }

        try {
            // ── Step 1: Try Neural TTS via server ──
            const ttsRes = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, language: voiceLang, voice: 'Kore' })
            });

            if (ttsRes.ok) {
                const ttsData = await ttsRes.json();

                if (!ttsData.fallback && ttsData.audio) {
                    // ── Neural TTS: decode base64 audio and play via Web Audio ──
                    console.log('[Sound] Playing Gemini neural TTS audio');
                    await this._playNeuralAudio(ttsData.audio, ttsData.mimeType, onEndCallback);
                    return; // done — callback will fire from audio onended
                }
                // Server returned fallback flag — drop through to browser TTS
                console.log(`[Sound] Neural TTS fallback: ${ttsData.reason}`);
            } else {
                console.warn(`[Sound] /api/tts returned ${ttsRes.status}, using browser TTS`);
            }
        } catch (err) {
            console.warn('[Sound] Neural TTS fetch failed, using browser TTS:', err.message);
        }

        // ── Step 2: Enhanced Browser TTS fallback ──
        this._speakBrowser(text, voiceLang, onEndCallback);
    }

    /**
     * Build a WAV file from raw PCM L16 bytes so the browser can decode it.
     * Gemini TTS returns audio/L16;codec=pcm;rate=24000 — raw signed 16-bit mono PCM.
     */
    _buildWavFromPCM(pcmBytes, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);
        const dataSize = pcmBytes.length;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        const writeStr = (offset, str) => {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        };

        writeStr(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true);           // PCM chunk size
        view.setUint16(20, 1, true);            // PCM format
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        writeStr(36, 'data');
        view.setUint32(40, dataSize, true);

        // Copy raw PCM bytes
        new Uint8Array(buffer, 44).set(pcmBytes);
        return buffer;
    }

    /**
     * Play base64 PCM/WAV audio from the server via Web Audio API
     */
    async _playNeuralAudio(audioBase64, mimeType, onEndCallback) {
        if (!this.ctx) {
            console.warn('[Sound] No AudioContext, falling back to browser TTS');
            this._isSpeakingNeural = false;
            this._speakBrowserFallback(onEndCallback);
            return;
        }
        if (this.ctx.state === 'suspended') await this.ctx.resume();

        try {
            // Decode base64 → raw bytes
            const binaryStr = atob(audioBase64);
            const pcmBytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) pcmBytes[i] = binaryStr.charCodeAt(i);

            // Gemini TTS returns raw L16 PCM — wrap it in a WAV container
            let arrayBufferToDecide;
            const isRawPCM = mimeType && (mimeType.includes('L16') || mimeType.includes('pcm'));
            if (isRawPCM) {
                // Extract sample rate from mimeType e.g. "audio/L16;codec=pcm;rate=24000"
                const rateMatch = mimeType.match(/rate=(\d+)/);
                const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
                console.log(`[Sound] Wrapping raw PCM in WAV container (rate=${sampleRate})`);
                arrayBufferToDecide = this._buildWavFromPCM(pcmBytes, sampleRate);
            } else {
                arrayBufferToDecide = pcmBytes.buffer;
            }

            const audioBuffer = await this.ctx.decodeAudioData(arrayBufferToDecide);

            // Create source and play
            const source = this.ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.ctx.destination);

            this.ttsAudioSource = source;
            this._isSpeakingNeural = true;

            // Notify face speaking state
            if (window.app && window.app.face) window.app.face.setSpeaking(true);

            source.onended = () => {
                this.ttsAudioSource = null;
                this._isSpeakingNeural = false;
                if (window.app && window.app.face) window.app.face.setSpeaking(false);
                console.log('[Sound] Neural TTS playback complete');
                if (onEndCallback) onEndCallback();
            };

            source.start(0);

        } catch (err) {
            console.error('[Sound] Neural audio decode/play failed:', err);
            // IMPORTANT: Always reset speaking state so the mic guard is not permanently blocked
            this._isSpeakingNeural = false;
            this.ttsAudioSource = null;
            if (window.app && window.app.face) window.app.face.setSpeaking(false);
            // Fall back to browser TTS so conversation doesn't break
            const lang = localStorage.getItem('lik-voice-lang') || 'en-US';
            this._speakBrowser(this._lastTTSText || '', lang, onEndCallback);
        }
    }

    /**
     * Enhanced browser speechSynthesis fallback
     * Uses best available voice, tuned pitch/rate for a natural feel
     */
    _speakBrowser(text, lang, onEndCallback) {
        if (!('speechSynthesis' in window) || !text) {
            if (onEndCallback) onEndCallback();
            return;
        }

        // Clean text (remove markdown markers/emojis) to avoid odd pronunciation
        const cleanText = text
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/[*_~#>`]/g, '')
            .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleanText) {
            if (onEndCallback) onEndCallback();
            return;
        }

        // Stop any previous utterance and resume the engine to prevent Chrome lockups
        if ('speechSynthesis' in window) {
            try {
                window.speechSynthesis.resume();
                window.speechSynthesis.cancel();
            } catch (e) {}
        }

        // Helper to segment text by language transitions (Tamil vs non-Tamil)
        const segmentText = (str) => {
            const segments = [];
            let currentText = '';
            let currentIsTamil = null;

            for (let i = 0; i < str.length; i++) {
                const char = str[i];
                const isCharTamil = /[\u0B80-\u0BFF]/.test(char);
                // Delimiters (spaces, punctuation, numbers) are neutral and don't trigger transitions
                const isNeutral = /[\s0-9.,\/#!$%\^&\*;:{}=\-_`~()?"'’+\[\]\\]/.test(char);

                if (isNeutral) {
                    currentText += char;
                } else {
                    if (currentIsTamil === null) {
                        currentIsTamil = isCharTamil;
                        currentText += char;
                    } else if (currentIsTamil === isCharTamil) {
                        currentText += char;
                    } else {
                        if (currentText.trim()) {
                            segments.push({ text: currentText.trim(), isTamil: currentIsTamil });
                        }
                        currentText = char;
                        currentIsTamil = isCharTamil;
                    }
                }
            }
            if (currentText.trim()) {
                segments.push({ text: currentText.trim(), isTamil: !!currentIsTamil });
            }
            return segments;
        };

        const segments = segmentText(cleanText);
        if (segments.length === 0) {
            if (onEndCallback) onEndCallback();
            return;
        }

        let currentSegmentIndex = 0;

        const speakNext = () => {
            if (currentSegmentIndex >= segments.length) {
                this.activeUtterance = null;
                if (window.app && window.app.face) window.app.face.setSpeaking(false);
                if (onEndCallback) onEndCallback();
                return;
            }

            const segment = segments[currentSegmentIndex];
            currentSegmentIndex++;

            const utterance = new SpeechSynthesisUtterance(segment.text);
            this.activeUtterance = utterance;

            if (segment.isTamil) {
                utterance.lang = 'ta-IN';
                const taVoice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('ta'));
                if (taVoice) {
                    utterance.voice = taVoice;
                }
            } else {
                utterance.lang = lang || 'en-US';
                if (this.voice && this.voice.lang.startsWith((lang || 'en-US').split('-')[0])) {
                    utterance.voice = this.voice;
                } else {
                    const matched = window.speechSynthesis.getVoices()
                        .find(v => v.lang.startsWith((lang || 'en').split('-')[0]));
                    if (matched) utterance.voice = matched;
                }
            }

            // Tuned to sound more natural
            utterance.pitch = 1.1;
            utterance.rate = 1.0;
            utterance.volume = 1.0;

            utterance.onstart = () => {
                if (window.app && window.app.face) window.app.face.setSpeaking(true);
            };

            const done = () => {
                if (this.activeUtterance === utterance) {
                    this.activeUtterance = null;
                    speakNext();
                }
            };

            utterance.onend = done;
            utterance.onerror = (e) => {
                console.warn('[Sound] Browser TTS segment error:', e);
                done();
            };

            window.speechSynthesis.speak(utterance);
        };

        speakNext();
    }

    /**
     * Minimal fallback — just fires the callback (used when text is empty)
     */
    _speakBrowserFallback(onEndCallback) {
        if (window.app && window.app.face) window.app.face.setSpeaking(false);
        if (onEndCallback) onEndCallback();
    }
}

const soundEngine = new RobotSoundEngine();
