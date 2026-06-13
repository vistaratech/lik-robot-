/**
 * ═══════════════════════════════════════════════
 *  VILY Sound Engine
 *  Procedural Audio Synthesis & Text-to-Speech (TTS)
 *  Synthesizes cute robot sound effects in real-time
 * ═══════════════════════════════════════════════
 */

class RobotSoundEngine {
    constructor() {
        this.ctx = null;
        this.soundEnabled = true;
        this.ttsEnabled = true;
        this.voice = null;
        this.activeUtterance = null;
        
        // Try to pre-load voices
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
        
        // Find a suitable voice: prefer Google US English, Microsoft Zira, or any cute sounding voice
        const preferred = ['google us english', 'microsoft zira', 'en-us', 'en-gb'];
        for (const pref of preferred) {
            const v = voices.find(voice => voice.name.toLowerCase().includes(pref) || voice.lang.toLowerCase().includes(pref));
            if (v) {
                this.voice = v;
                break;
            }
        }
        if (!this.voice && voices.length > 0) {
            this.voice = voices[0];
        }
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

        // Volume envelope (prevent clicking by ramping)
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
        
        console.log(`[Sound] Playing mood sound: ${mood}`);
        
        switch (mood) {
            case 'happy':
                // Two happy rising beeps
                this.playBeep(600, 100, 'sine', 0.1, 800);
                setTimeout(() => this.playBeep(800, 150, 'sine', 0.1, 1100), 120);
                break;
                
            case 'excited':
                // High rapid chirps
                this.playBeep(900, 80, 'sine', 0.12, 1300);
                setTimeout(() => this.playBeep(1100, 80, 'sine', 0.12, 1600), 90);
                setTimeout(() => this.playBeep(1400, 120, 'sine', 0.12, 2000), 180);
                break;
                
            case 'curious':
                // Rising question chime
                this.playBeep(500, 120, 'sine', 0.08);
                setTimeout(() => this.playBeep(650, 250, 'sine', 0.08, 900), 140);
                break;
                
            case 'love':
                // Soft warm chimes
                this.playBeep(440, 180, 'triangle', 0.15, 520);
                setTimeout(() => this.playBeep(554, 250, 'triangle', 0.15, 659), 200);
                break;
                
            case 'shy':
                // Quiet sliding whine
                this.playBeep(800, 200, 'sine', 0.05, 600);
                setTimeout(() => this.playBeep(600, 300, 'sine', 0.04, 400), 220);
                break;
                
            case 'sleepy':
                // Long breathing tone
                this.playBeep(260, 600, 'sine', 0.06);
                setTimeout(() => this.playBeep(220, 800, 'sine', 0.03), 700);
                break;
                
            case 'sad':
                // Slow falling pitch moan
                this.playBeep(350, 400, 'sine', 0.1, 180);
                break;
                
            case 'angry':
                // Low growl
                this.playBeep(120, 250, 'sawtooth', 0.15, 80);
                setTimeout(() => this.playBeep(100, 300, 'sawtooth', 0.12, 60), 200);
                break;
                
            case 'surprised':
                // Quick double high gasp
                this.playBeep(1000, 60, 'sine', 0.15);
                setTimeout(() => this.playBeep(1200, 150, 'sine', 0.15, 800), 70);
                break;
                
            case 'focused':
                // Calm, focused digital hum / activation chime
                this.playBeep(350, 120, 'sine', 0.08, 480);
                setTimeout(() => this.playBeep(480, 400, 'sine', 0.06), 140);
                break;
                
            case 'confused':
                // Quirky wobbling double-beep ("huh?")
                this.playBeep(450, 130, 'triangle', 0.1, 320);
                setTimeout(() => this.playBeep(320, 220, 'triangle', 0.08, 550), 150);
                break;
                
            case 'eureka':
                // Happy rising light arpeggio chime (A major/C major arpeggio)
                this.playBeep(523.25, 80, 'sine', 0.12, 659.25);
                setTimeout(() => this.playBeep(659.25, 80, 'sine', 0.12, 783.99), 90);
                setTimeout(() => this.playBeep(783.99, 180, 'sine', 0.12, 1046.5), 180);
                break;
        }
    }

    /**
     * Text-To-Speech (TTS) voice synthesizer
     */
    speak(text, onEndCallback) {
        if (!this.ttsEnabled || !('speechSynthesis' in window)) {
            console.log(`[Sound] Voice is disabled or not supported. Text: ${text}`);
            if (onEndCallback) onEndCallback();
            return;
        }

        // Clean up previous active utterance callbacks before cancelling to prevent premature onend triggers
        if (this.activeUtterance) {
            this.activeUtterance.onend = null;
            this.activeUtterance.onerror = null;
            this.activeUtterance = null;
        }

        // Cancel previous speech and temporarily stop any active recording to prevent feedback loop
        if (window.app && window.app.speechRecog && window.app.isRecording) {
            try {
                window.app.speechRecog.stop();
            } catch(e) {}
        }
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        this.activeUtterance = utterance;
        
        // Auto-detect Tamil characters to use Tamil voice / language
        const isTamil = /[\u0B80-\u0BFF]/.test(text);
        if (isTamil) {
            utterance.lang = 'ta-IN';
            // Find a Tamil voice if available
            if (window.speechSynthesis) {
                const voices = window.speechSynthesis.getVoices();
                const taVoice = voices.find(v => v.lang.startsWith('ta'));
                if (taVoice) utterance.voice = taVoice;
            }
        } else {
            const storedLang = localStorage.getItem('vily-voice-lang') || 'en-US';
            utterance.lang = storedLang;
            if (this.voice && this.voice.lang.startsWith(storedLang.split('-')[0])) {
                utterance.voice = this.voice;
            } else if (window.speechSynthesis) {
                const voices = window.speechSynthesis.getVoices();
                const matchedVoice = voices.find(v => v.lang.startsWith(storedLang.split('-')[0]));
                if (matchedVoice) utterance.voice = matchedVoice;
            }
        }
        
        // Robotize the voice slightly by increasing rate and pitch
        utterance.pitch = 1.35; // slightly high
        utterance.rate = 1.05;  // slightly fast
        utterance.volume = 1.0;

        utterance.onstart = () => {
            if (window.app && window.app.face) {
                window.app.face.setSpeaking(true);
            }
        };
        
        const stopSpeaking = () => {
            if (this.activeUtterance === utterance) {
                this.activeUtterance = null;
            }
            if (window.app && window.app.face) {
                window.app.face.setSpeaking(false);
            }
            if (onEndCallback) {
                onEndCallback();
            }
        };
        
        utterance.onend = stopSpeaking;
        utterance.onerror = stopSpeaking;

        window.speechSynthesis.speak(utterance);
    }
}

const soundEngine = new RobotSoundEngine();
