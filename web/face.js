/**
 * LIK Face Engine — LOOI Biomimetic Behavior Edition
 * Animated robot face with LOOI-style animations:
 *   - Squash & Stretch eyes (Disney-style)
 *   - Pupil dilation + inner highlight
 *   - Wake-up boot animation
 *   - Dance / wiggle animation
 *   - Head tilt / lean
 *   - Ambient floating particles
 *   - Eye glow pulse
 */

class RobotFace {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Expression state
        this.mood = 'happy';        // happy, curious, sleepy, excited, sad, shy, love
        this.targetMood = 'happy';
        this.moodTransition = 0;
        this.moodLockedUntil = 0;
        
        // Eye state
        this.eyeOpenL = 1;
        this.eyeOpenR = 1;
        this.pupilX = 0;       // -1 to 1
        this.pupilY = 0;       // -1 to 1
        this.targetPupilX = 0;
        this.targetPupilY = 0;
        
        // Blink system
        this.blinkTimer = 0;
        this.blinkInterval = 3000 + Math.random() * 4000;
        this.isBlinking = false;
        this.blinkPhase = 0;
        
        // Lively-mode upgrade states
        this.saccadeTimer = 0;
        this.saccadeOffsetX = 0;
        this.saccadeOffsetY = 0;
        this.targetSaccadeOffsetX = 0;
        this.targetSaccadeOffsetY = 0;
        
        this.glanceTimer = 0;
        this.isGlancingAway = false;
        this.glanceDuration = 0;
        this.glanceTargetX = 0;
        this.glanceTargetY = 0;
        
        this.isFluttering = false;
        this.flutterTimer = 0;
        
        // Breathing / idle animation
        this.breathPhase = 0;
        this.idleTimer = 0;
        this.idleLookTimer = 0;
        
        // Mouth
        this.mouthOpen = 0;    // 0 to 1
        this.mouthSmile = 0.5; // -1 (sad) to 1 (smile)
        
        // Blush
        this.blushOpacity = 0;
        
        // Bounce
        this.bounceY = 0;
        this.bounceVel = 0;
        
        // Speaking/Thinking animation states
        this.isSpeaking = false;
        this.speakingPhase = 0;
        this.speakingOffset = 0;
        this.thinkingTimer = 0;
        
        // ═══════ NEW: Squash & Stretch System ═══════
        this.squashX = 1.0;         // Horizontal multiplier (>1 = wider, <1 = squished)
        this.stretchY = 1.0;        // Vertical multiplier
        this.targetSquashX = 1.0;
        this.targetStretchY = 1.0;
        this.squashSpring = 0;      // Spring velocity for elastic bounce-back
        this.stretchSpring = 0;
        
        // ═══════ NEW: Pupil Dilation System ═══════
        this.pupilDilation = 0.35;      // 0-1 ratio of pupil to eye size
        this.targetPupilDilation = 0.35;
        this.highlightOffset = 0.3;     // Offset ratio for inner white highlight
        
        // ═══════ NEW: Boot Animation ═══════
        this.isBooting = true;
        this.bootPhase = 0;         // 0-1 progress of boot animation
        this.bootStarted = false;
        this.onBootComplete = null;
        
        // ═══════ NEW: Dance Animation ═══════
        this.isDancing = false;
        this.dancePhase = 0;
        this.danceTimer = 0;
        this.danceDuration = 3.5;   // seconds
        this.danceRotation = 0;
        this.danceOffsetX = 0;
        this.danceOffsetY = 0;
        
        // ═══════ NEW: Head Tilt / Lean ═══════
        this.headTilt = 0;          // radians, -0.06 to 0.06
        this.targetHeadTilt = 0;
        
        // ═══════ NEW: Floating Particles ═══════
        this.particles = [];
        this.particleTimer = 0;
        this._initParticles();
        
        // ═══════ NEW: Eye Glow Pulse ═══════
        this.glowIntensity = 0;
        this.glowPhase = 0;
        
        // Voice Command Feedback
        this.commandLabel = '';
        this.commandLabelExpiry = 0;
        
        // Detailed animation states
        this.sadTears = [];
        this.tearTimer = 0;
        this.sleepFlutterTimer = 0;
        this.eurekaFlashAlpha = 0;
        this.eurekaFlashRingSize = 0;
        this.curiousScanPhase = 0;
        this.dogMode = false;
        
        // ═══════ NEW MODE STATES ═══════
        
        // Karaoke Mode
        this.isKaraoke = false;
        this.karaokePhase = 0;
        this.karaokeBeatTimer = 0;
        this.karaokeMouthOpen = 0;
        
        // Sleep Mode
        this.isSleepMode = false;
        this.sleepStars = [];
        this.sleepPhase = 0;
        
        // Love Mode (enhanced)
        this.isLoveMode = false;
        this.loveHearts = [];
        this.lovePhase = 0;
        
        // Pong Game Mode
        this.isPongMode = false;
        this.pongBall = { x: 0.5, y: 0.5, vx: 0.4, vy: 0.3 };
        this.pongPaddleL = 0.5;
        this.pongPaddleR = 0.5;
        this.pongScoreL = 0;
        this.pongScoreR = 0;
        
        // RPS Game Mode
        this.isRPSMode = false;
        this.rpsPhase = 'idle'; // idle, countdown, show, detect, result, gameover
        this.rpsCountdown = 3;
        this.rpsCountdownTimer = 0;
        this.rpsPlayerChoice = null; // 'rock', 'paper', 'scissors'
        this.rpsCpuChoice = null;
        this.rpsResult = null; // 'win', 'lose', 'draw'
        this.rpsResultTimer = 0;
        this.rpsScorePlayer = 0;
        this.rpsScoreCpu = 0;
        this.rpsRound = 1;
        this.rpsMaxRounds = 5;
        this.rpsShowTimer = 0;
        this.rpsEmojis = { rock: '\u270A', paper: '\u270B', scissors: '\u270C\uFE0F' };
        
        // Color Theme Mode
        this.colorThemeIndex = 0;
        this.colorThemes = [
            { eyeColor: '#00a2ff', eyeShadow: '#0056ff', name: 'Ocean Blue' },
            { eyeColor: '#00b894', eyeShadow: '#00805e', name: 'Emerald Green' },
            { eyeColor: '#ff6b6b', eyeShadow: '#c23616', name: 'Ruby Red' },
            { eyeColor: '#fdcb6e', eyeShadow: '#e17055', name: 'Golden Sun' },
            { eyeColor: '#a29bfe', eyeShadow: '#6c5ce7', name: 'Violet Dream' },
            { eyeColor: '#fd79a8', eyeShadow: '#e84393', name: 'Pink Rose' },
            { eyeColor: '#00cec9', eyeShadow: '#0984e3', name: 'Cyan Wave' },
            { eyeColor: '#ff9f43', eyeShadow: '#ee5a24', name: 'Sunset Orange' },
        ];
        
        // Photo Mode
        this.isPhotoMode = false;
        this.photoFlashAlpha = 0;
        this.photoPosePhase = 0;
        
        // Story Mode
        this.isStoryMode = false;
        this.storyPhase = 0;
        this.storyMoodIndex = 0;
        this.storySequence = [
            { mood: 'happy', duration: 3, label: '😊 Once upon a time...' },
            { mood: 'curious', duration: 3, label: '🔍 Something caught my eye!' },
            { mood: 'surprised', duration: 2.5, label: '😲 What is THAT?!' },
            { mood: 'excited', duration: 3, label: '⚡ This is AMAZING!' },
            { mood: 'shy', duration: 2.5, label: '😳 Oh... hello there~' },
            { mood: 'love', duration: 3, label: '❤️ I think I\'m in love!' },
            { mood: 'sad', duration: 2.5, label: '😢 But then it was gone...' },
            { mood: 'thinking', duration: 2.5, label: '🤔 Wait a second...' },
            { mood: 'eureka', duration: 3, label: '💡 I know what to do!' },
            { mood: 'happy', duration: 3, label: '🎉 And they lived happily!' },
        ];
        
        // Pomodoro Mode
        this.isPomodoroMode = false;
        this.pomodoroPhase = 0;
        
        // DJ Mode
        this.isDJMode = false;
        this.djBars = new Array(16).fill(0);
        this.djPhase = 0;
        this.djAnalyser = null;
        this.djDataArray = null;
        
        // Colors (Replicating the real LOOI robot's giant yellow/gold ovals and deep orange shadow)
        this.colors = {
            eyeColor: '#00a2ff',       // Glowing warm blue
            eyeShadow: '#0056ff',      // Offset deep blue shadow
            cheek: '#f77fbe',
            faceBase: '#000000',       // Pure black background to merge with screen bezel
        };
        this.lastTime = Date.now();
        this.lastMouseMoveTime = 0;
        this.init();
    }
    
    init() {
        this.setupCanvas();
        window.addEventListener('resize', () => this.setupCanvas());
        this.setupMouseTracking();
        this.startIdleBehavior();
        this.animate();
        
        // Start boot animation after a brief delay
        setTimeout(() => {
            this.bootStarted = true;
        }, 300);
    }
    
    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        // Robust dimensions fallback if bounding rect is 0 due to initial style computation delay
        let w = rect.width || this.canvas.width || this.canvas.offsetWidth || 320;
        let h = rect.height || this.canvas.height || this.canvas.offsetHeight || 320;
        
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.ctx.scale(dpr, dpr);
        this.w = w;
        this.h = h;
        this.cx = this.w / 2;
        this.cy = this.h / 2;
        this.scale = Math.min(this.w, this.h * 1.35) / 320;
        
        console.log(`[Face] Canvas resized to ${this.w}x${this.h}, scale=${this.scale}`);
    }
    
    // ═══════ Particle System Init ═══════
    
    _initParticles() {
        this.particles = [];
        for (let i = 0; i < 10; i++) {
            this.particles.push(this._createParticle());
        }
    }
    
    _createParticle() {
        return {
            x: Math.random(),           // 0-1 normalized position
            y: 0.8 + Math.random() * 0.3, // Start near bottom
            vx: (Math.random() - 0.5) * 0.02,
            vy: -(0.03 + Math.random() * 0.04), // Float upward
            size: 1.5 + Math.random() * 2.5,
            alpha: 0.15 + Math.random() * 0.35,
            life: 0,
            maxLife: 3 + Math.random() * 4,  // seconds
            wobblePhase: Math.random() * Math.PI * 2,
            wobbleSpeed: 1 + Math.random() * 2,
        };
    }
    
    _getMoodParticleColor() {
        const moodColors = {
            happy: [255, 208, 0],
            excited: [255, 165, 0],
            love: [253, 121, 168],
            shy: [253, 121, 168],
            curious: [116, 185, 255],
            thinking: [162, 155, 254],
            focused: [0, 206, 201],
            sad: [116, 185, 255],
            angry: [255, 107, 107],
            surprised: [255, 224, 102],
            sleepy: [116, 185, 255],
            confused: [162, 155, 254],
            eureka: [253, 203, 110],
        };
        return moodColors[this.mood] || [255, 208, 0];
    }
    
    // ─── Mood System ───
    
    setMood(mood, lockDuration = 0, playSound = true, force = false) {
        // If recording or transcribing, lock face expression to only allow curious (listening) and thinking (processing)
        if (!force && window.app && (window.app.isRecording || window.app.isTranscribing)) {
            if (mood !== 'curious' && mood !== 'thinking') {
                console.log(`[Face] Mood transition to '${mood}' blocked during voice interaction.`);
                return;
            }
        }

        if (this.mood !== mood) {
            // Suppress playing mood sounds during voice interactions or continuous talk
            if (playSound && typeof soundEngine !== 'undefined') {
                if (window.app && (window.app.isRecording || window.app.isTranscribing || window.app.continuousTalk)) {
                    console.log(`[Face] Mood sound for '${mood}' suppressed during active voice/continuous interaction.`);
                } else {
                    soundEngine.playMoodSound(mood);
                }
            }
            
            // Reset detailed states on mood transition
            if (mood !== 'sad') this.sadTears = [];
            if (mood === 'eureka') {
                this.eurekaFlashAlpha = 1.0;
                this.eurekaFlashRingSize = 0;
            }
            
            // ═══════ NEW: Trigger squash on mood change ═══════
            this.targetSquashX = 1.15;
            this.targetStretchY = 0.85;
            this.squashSpring = 0;
            this.stretchSpring = 0;
            // Spring back after brief delay
            setTimeout(() => {
                this.targetSquashX = 1.0;
                this.targetStretchY = 1.0;
            }, 120);
        }
        this.targetMood = mood;
        this.moodTransition = 0;
        
        if (lockDuration > 0) {
            this.moodLockedUntil = Date.now() + lockDuration;
        }
        
        const moodConfigs = {
            happy:   { smile: 0.6, eyeOpen: 1.0, blush: 0, pupilY: 0, dilation: 0.35, tilt: 0 },
            curious: { smile: 0.2, eyeOpen: 1.2, blush: 0, pupilY: -0.1, dilation: 0.45, tilt: 0.04 },
            sleepy:  { smile: 0.1, eyeOpen: 0.35, blush: 0, pupilY: 0.2, dilation: 0.25, tilt: 0.03 },
            excited: { smile: 0.9, eyeOpen: 1.1, blush: 0.4, pupilY: 0, dilation: 0.5, tilt: 0 },
            sad:     { smile: -0.4, eyeOpen: 0.7, blush: 0, pupilY: 0.15, dilation: 0.3, tilt: -0.03 },
            shy:     { smile: 0.3, eyeOpen: 0.6, blush: 0.7, pupilY: 0.1, dilation: 0.3, tilt: 0.025 },
            love:    { smile: 0.7, eyeOpen: 0.85, blush: 0.6, pupilY: 0, dilation: 0.55, tilt: 0 },
            angry:   { smile: -0.3, eyeOpen: 0.8, blush: 0, pupilY: -0.05, dilation: 0.2, tilt: -0.02 },
            surprised: { smile: 0.1, eyeOpen: 1.3, blush: 0.2, pupilY: 0, dilation: 0.55, tilt: 0 },
            thinking: { smile: 0.2, eyeOpen: 0.85, blush: 0.15, pupilY: 0, dilation: 0.4, tilt: 0.035 },
            focused: { smile: 0.15, eyeOpen: 0.8, blush: 0, pupilY: 0.05, dilation: 0.22, tilt: 0 },
            confused: { smile: -0.1, eyeOpen: 0.9, blush: 0.1, pupilY: -0.05, dilation: 0.4, tilt: -0.05 },
            eureka: { smile: 0.95, eyeOpen: 1.25, blush: 0.45, pupilY: -0.1, dilation: 0.55, tilt: 0 }
        };
        
        const config = moodConfigs[mood] || moodConfigs.happy;
        this._targetSmile = config.smile;
        this._targetEyeOpen = config.eyeOpen;
        this._targetBlush = config.blush;
        this._targetPupilYBias = config.pupilY;
        this.targetPupilDilation = config.dilation;
        this.targetHeadTilt = config.tilt;
        
        this.mood = mood;
    }
    
    // ─── Idle Behavior ───
    
    startIdleBehavior() {
        // Random look-around
        setInterval(() => {
            if (Date.now() - this.lastMouseMoveTime < 4500) return; // Skip if user moved mouse recently
            if (Math.random() > 0.4) {
                this.targetPupilX = (Math.random() - 0.5) * 0.6;
                this.targetPupilY = (Math.random() - 0.5) * 0.3;
            } else {
                this.targetPupilX = 0;
                this.targetPupilY = 0;
            }
        }, 2500 + Math.random() * 2000);
        
        // Random mood changes (less frequent, and disabled during active interactions)
        setInterval(() => {
            if (this.isSpeaking) return;
            if (Date.now() < this.moodLockedUntil) return;
            if (window.app && window.app.currentPage !== 'home') return;
            
            // Do not allow random mood changes if active recording/listening or continuous conversation is in progress
            if (window.app) {
                if (window.app.isRecording || window.app.isTranscribing || window.app.continuousTalk) return;
                if (window.app.lastInteractionTime && (Date.now() - window.app.lastInteractionTime < 45000)) return;
            }
            
            const moods = ['happy', 'curious', 'happy', 'excited', 'happy', 'love', 'happy', 'shy'];
            const rand = moods[Math.floor(Math.random() * moods.length)];
            this.setMood(rand);
        }, 45000 + Math.random() * 30000);
        
        // Occasional bounce
        setInterval(() => {
            if (this.mood === 'excited' || this.mood === 'happy') {
                this.bounceVel = -3;
                // Add squash on bounce landing
                setTimeout(() => {
                    this.targetSquashX = 1.12;
                    this.targetStretchY = 0.88;
                    setTimeout(() => {
                        this.targetSquashX = 1.0;
                        this.targetStretchY = 1.0;
                    }, 100);
                }, 250);
            }
        }, 5000 + Math.random() * 4000);
        
        // Start with happy
        this.setMood('happy');
    }

    setupMouseTracking() {
        const onMove = (clientX, clientY) => {
            this.lastMouseMoveTime = Date.now();
            const rect = this.canvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            
            const mouseX = clientX - (rect.left + rect.width / 2);
            const mouseY = clientY - (rect.top + rect.height / 2);
            
            const maxRangeX = rect.width / 2;
            const maxRangeY = rect.height / 2;
            
            this.targetPupilX = Math.max(-0.65, Math.min(0.65, (mouseX / maxRangeX) * 0.95));
            this.targetPupilY = Math.max(-0.35, Math.min(0.35, (mouseY / maxRangeY) * 0.75));
        };

        window.addEventListener('mousemove', (e) => {
            if (document.getElementById('page-home')?.classList.contains('active')) {
                onMove(e.clientX, e.clientY);
            }
        });

        window.addEventListener('touchmove', (e) => {
            if (document.getElementById('page-home')?.classList.contains('active') && e.touches.length > 0) {
                onMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });
    }
    
    // ═══════ NEW: Boot Animation ═══════
    
    playBootAnimation() {
        this.isBooting = true;
        this.bootPhase = 0;
        this.bootStarted = true;
        this.eyeOpenL = 0;
        this.eyeOpenR = 0;
    }
    
    // ═══════ NEW: Dance Animation ═══════
    
    startDance(duration = 3.5) {
        if (this.isDancing) return;
        this.isDancing = true;
        this.dancePhase = 0;
        this.danceTimer = 0;
        this.danceDuration = duration;
        
        // Add CSS class for container-level effects
        const container = this.canvas.closest('.face-container') || this.canvas.parentElement;
        if (container) container.classList.add('dancing');
        
        console.log('[Face] 🕺 Dance animation started!');
    }
    
    stopDance() {
        this.isDancing = false;
        this.dancePhase = 0;
        this.danceRotation = 0;
        this.danceOffsetX = 0;
        this.danceOffsetY = 0;
        
        const container = this.canvas.closest('.face-container') || this.canvas.parentElement;
        if (container) container.classList.remove('dancing');
    }
    
    // ═══════ NEW: Nod Animation ═══════
    
    playNod() {
        let count = 0;
        const nodInterval = setInterval(() => {
            if (count >= 4) {
                clearInterval(nodInterval);
                this.targetHeadTilt = this._getCurrentMoodTilt();
                this.bounceVel = 0;
                return;
            }
            this.bounceVel = count % 2 === 0 ? -2.5 : 1.5;
            // Quick squash on each nod
            this.targetSquashX = 1.08;
            this.targetStretchY = 0.92;
            setTimeout(() => {
                this.targetSquashX = 1.0;
                this.targetStretchY = 1.0;
            }, 80);
            count++;
        }, 180);
    }
    
    // ═══════ NEW: Shake Animation ═══════
    
    playShake() {
        let count = 0;
        const shakeInterval = setInterval(() => {
            if (count >= 6) {
                clearInterval(shakeInterval);
                this.targetHeadTilt = this._getCurrentMoodTilt();
                return;
            }
            this.targetHeadTilt = count % 2 === 0 ? 0.06 : -0.06;
            count++;
        }, 120);
        
        setTimeout(() => {
            this.targetHeadTilt = this._getCurrentMoodTilt();
        }, 750);
    }
    
    // ═══════ NEW MODE METHODS ═══════
    
    // --- Karaoke Mode ---
    startKaraoke() {
        this.isKaraoke = true;
        this.karaokePhase = 0;
        this.karaokeBeatTimer = 0;
        this.isDancing = false;
    }
    stopKaraoke() {
        this.isKaraoke = false;
        this.karaokePhase = 0;
        this.karaokeMouthOpen = 0;
    }
    
    // --- Sleep Mode ---
    startSleepMode() {
        this.isSleepMode = true;
        this.sleepPhase = 0;
        this.sleepStars = [];
        for (let i = 0; i < 20; i++) {
            this.sleepStars.push({
                x: Math.random(),
                y: Math.random(),
                size: 1 + Math.random() * 3,
                twinklePhase: Math.random() * Math.PI * 2,
                twinkleSpeed: 1 + Math.random() * 2,
            });
        }
    }
    stopSleepMode() {
        this.isSleepMode = false;
        this.sleepStars = [];
    }
    
    // --- Love Mode (enhanced) ---
    startLoveMode() {
        this.isLoveMode = true;
        this.lovePhase = 0;
        this.loveHearts = [];
    }
    stopLoveMode() {
        this.isLoveMode = false;
        this.loveHearts = [];
    }
    
    // --- Pong Game ---
    startPong() {
        this.isPongMode = true;
        this.pongBall = { x: 0.5, y: 0.5, vx: 0.6, vy: 0.4 };
        this.pongPaddleL = 0.5;
        this.pongPaddleR = 0.5;
        this.pongScoreL = 0;
        this.pongScoreR = 0;
    }
    stopPong() {
        this.isPongMode = false;
    }
    
    // --- RPS Game ---
    startRPS() {
        this.isRPSMode = true;
        this.rpsPhase = 'countdown';
        this.rpsCountdown = 3;
        this.rpsCountdownTimer = 0;
        this.rpsPlayerChoice = null;
        this.rpsCpuChoice = null;
        this.rpsResult = null;
        this.rpsResultTimer = 0;
        this.rpsScorePlayer = 0;
        this.rpsScoreCpu = 0;
        this.rpsRound = 1;
        this.rpsShowTimer = 0;
        this._updateRPSScoreUI();
    }
    stopRPS() {
        this.isRPSMode = false;
        this.rpsPhase = 'idle';
    }
    _startRPSNextRound() {
        this.rpsPhase = 'countdown';
        this.rpsCountdown = 3;
        this.rpsCountdownTimer = 0;
        this.rpsPlayerChoice = null;
        this.rpsCpuChoice = null;
        this.rpsResult = null;
        this.rpsResultTimer = 0;
        this.rpsShowTimer = 0;
    }
    _rpsGetCpuChoice() {
        const choices = ['rock', 'paper', 'scissors'];
        return choices[Math.floor(Math.random() * 3)];
    }
    _rpsJudge(player, cpu) {
        if (player === cpu) return 'draw';
        if ((player === 'rock' && cpu === 'scissors') ||
            (player === 'paper' && cpu === 'rock') ||
            (player === 'scissors' && cpu === 'paper')) return 'win';
        return 'lose';
    }
    rpsSetPlayerChoice(choice) {
        if (this.rpsPhase !== 'detect') return;
        this.rpsPlayerChoice = choice;
        this.rpsCpuChoice = this._rpsGetCpuChoice();
        this.rpsResult = this._rpsJudge(choice, this.rpsCpuChoice);
        
        if (this.rpsResult === 'win') {
            this.rpsScorePlayer++;
            this.setMood('excited', 2000, false, true);
            if (window.app && window.app.connected && typeof ble !== 'undefined') {
                ble.playAnimation(0x04); // Excited
            }
        } else if (this.rpsResult === 'lose') {
            this.rpsScoreCpu++;
            this.setMood('sad', 2000, false, true);
            if (window.app && window.app.connected && typeof ble !== 'undefined') {
                ble.playAnimation(0x01); // Shake
            }
        } else {
            this.setMood('surprised', 2000, false, true);
        }
        
        this.rpsPhase = 'result';
        this.rpsResultTimer = 0;
        this._updateRPSScoreUI();
        this._updateRPSEmojiUI();
    }
    
    // --- Color Cycle ---
    cycleColor() {
        this.colorThemeIndex = (this.colorThemeIndex + 1) % this.colorThemes.length;
        const theme = this.colorThemes[this.colorThemeIndex];
        this.colors.eyeColor = theme.eyeColor;
        this.colors.eyeShadow = theme.eyeShadow;
        return theme.name;
    }
    
    // --- Photo Mode ---
    startPhotoMode() {
        this.isPhotoMode = true;
        this.photoPosePhase = 0;
        this.photoFlashAlpha = 0;
    }
    triggerPhotoFlash() {
        this.photoFlashAlpha = 1.0;
    }
    stopPhotoMode() {
        this.isPhotoMode = false;
        this.photoFlashAlpha = 0;
    }
    
    // --- Story Mode ---
    startStoryMode() {
        this.isStoryMode = true;
        this.storyPhase = 0;
        this.storyMoodIndex = 0;
        const first = this.storySequence[0];
        if (first) {
            this.setMood(first.mood, first.duration * 1000, true, true);
            this.showCommand(first.label, first.duration * 1000);
        }
    }
    stopStoryMode() {
        this.isStoryMode = false;
        this.storyPhase = 0;
        this.storyMoodIndex = 0;
    }
    
    // --- DJ Mode ---
    startDJMode(analyser, dataArray) {
        this.isDJMode = true;
        this.djPhase = 0;
        this.djAnalyser = analyser || null;
        this.djDataArray = dataArray || null;
        this.djBars = new Array(16).fill(0);
    }
    stopDJMode() {
        this.isDJMode = false;
        this.djAnalyser = null;
        this.djDataArray = null;
        this.djBars = new Array(16).fill(0);
    }
    
    _getCurrentMoodTilt() {
        const tilts = {
            happy: 0, curious: 0.04, sleepy: 0.03, excited: 0, sad: -0.03,
            shy: 0.025, love: 0, angry: -0.02, surprised: 0, thinking: 0.035,
            focused: 0, confused: -0.05, eureka: 0
        };
        return tilts[this.mood] || 0;
    }

    _updateTears(dt) {
        if (this.mood === 'sad') {
            this.tearTimer += dt;
            if (this.tearTimer > 1.2) {
                this.tearTimer = 0;
                const isRight = Math.random() > 0.5;
                const eyeSpacing = 82 * this.scale;
                const startX = this.cx + (isRight ? eyeSpacing : -eyeSpacing);
                const startY = this.cy + 10 * this.scale;
                this.sadTears.push({
                    x: startX + (Math.random() - 0.5) * 25 * this.scale,
                    y: startY,
                    vy: (60 + Math.random() * 40) * this.scale,
                    size: (2.0 + Math.random() * 2) * this.scale,
                    alpha: 0.85
                });
            }
        } else {
            this.tearTimer = 0;
        }
        
        for (let i = this.sadTears.length - 1; i >= 0; i--) {
            const t = this.sadTears[i];
            t.y += t.vy * dt;
            t.x += Math.sin(t.y / 15) * 0.5 * this.scale;
            const progress = (t.y - (this.cy + 10 * this.scale)) / (this.h - (this.cy + 10 * this.scale));
            t.alpha = Math.max(0, 0.85 * (1 - progress));
            if (t.y > this.h || t.alpha <= 0) {
                this.sadTears.splice(i, 1);
            }
        }
    }
    
    // ─── Update Logic ───
    
    update(dt) {
        // Smooth interpolation
        const lerp = (a, b, t) => a + (b - a) * Math.min(t, 1);
        const speed = dt * 4;
        
        // ═══════ Boot Animation Update ═══════
        if (this.isBooting && this.bootStarted) {
            this.bootPhase += dt * 0.55;  // ~1.8 seconds total
            
            if (this.bootPhase < 0.3) {
                // Phase 1: Eyes closed, slight vibration
                this.eyeOpenL = 0.02;
                this.eyeOpenR = 0.02;
                this.targetSquashX = 1.0 + Math.sin(this.bootPhase * 40) * 0.02;
            } else if (this.bootPhase < 0.6) {
                // Phase 2: Eyes slowly open with stretch
                const openProgress = (this.bootPhase - 0.3) / 0.3;
                const eased = openProgress * openProgress * (3 - 2 * openProgress); // smoothstep
                this.eyeOpenL = eased * 0.5;
                this.eyeOpenR = eased * 0.5;
                this.targetStretchY = 1.0 + eased * 0.2;
                this.targetSquashX = 1.0 - eased * 0.1;
            } else if (this.bootPhase < 0.8) {
                // Phase 3: Eyes wide open with overshoot, look around
                const lookProgress = (this.bootPhase - 0.6) / 0.2;
                this.eyeOpenL = 0.5 + lookProgress * 0.7;
                this.eyeOpenR = 0.5 + lookProgress * 0.7;
                this.targetPupilX = Math.sin(lookProgress * Math.PI * 2) * 0.5;
                this.targetStretchY = 1.2 - lookProgress * 0.2;
                this.targetSquashX = 0.9 + lookProgress * 0.1;
            } else if (this.bootPhase >= 1.0) {
                // Phase 4: Settle into happy
                this.isBooting = false;
                this.bootPhase = 0;
                this.targetSquashX = 1.0;
                this.targetStretchY = 1.0;
                this.targetPupilX = 0;
                this.targetPupilY = 0;
                this.setMood('happy', 2000);
                // Happy bounce on boot complete
                this.bounceVel = -4;
                console.log('[Face] ✨ Boot animation complete!');
                if (typeof this.onBootComplete === 'function') {
                    this.onBootComplete();
                }
            }
        }
        
        // ═══════ Dance Animation Update ═══════
        if (this.isDancing) {
            this.danceTimer += dt;
            this.dancePhase += dt * 8;  // Fast oscillation
            
            if (this.danceTimer < 1.5) {
                // Phase 1: Side-to-side body sway with high squash/stretch
                this.danceRotation = Math.sin(this.dancePhase * 0.8) * 0.08;
                this.danceOffsetX = Math.sin(this.dancePhase * 0.6) * 25 * this.scale;
                this.danceOffsetY = Math.abs(Math.sin(this.dancePhase * 1.2)) * -6 * this.scale;
                this.targetSquashX = 1.0 + Math.sin(this.dancePhase * 1.2) * 0.18;
                this.targetStretchY = 1.0 - Math.sin(this.dancePhase * 1.2) * 0.15;
                this.targetPupilX = Math.sin(this.dancePhase * 0.5) * 0.4;
                this.targetPupilY = 0;
            } else if (this.danceTimer < 3.0) {
                // Phase 2: Pupil dizzy spin & continuous head tilt
                const dizzyPhase = (this.danceTimer - 1.5) * Math.PI * 2.5; // spin rate
                this.danceRotation = Math.sin(this.danceTimer * 5) * 0.05;
                this.danceOffsetX = 0;
                this.danceOffsetY = -4 * this.scale;
                this.targetSquashX = 1.05;
                this.targetStretchY = 0.95;
                // Spin pupils in circle
                this.targetPupilX = Math.cos(dizzyPhase) * 0.65;
                this.targetPupilY = Math.sin(dizzyPhase) * 0.35;
                this.mood = 'excited';
            } else {
                // Phase 3: Wind-up squeeze -> High jump -> Land with spring
                const jumpProgress = (this.danceTimer - 3.0); // 0.0 to 1.0s
                if (jumpProgress < 0.35) {
                    // Squeeze down (wind up)
                    this.danceRotation = 0;
                    this.danceOffsetX = 0;
                    const squeezeRatio = jumpProgress / 0.35; // 0 to 1
                    this.targetSquashX = 1.0 + squeezeRatio * 0.3; // wider
                    this.targetStretchY = 1.0 - squeezeRatio * 0.45; // flatter
                    this.danceOffsetY = squeezeRatio * 15 * this.scale; // crouch
                    this.targetPupilX = 0;
                    this.targetPupilY = 0.2;
                } else if (jumpProgress < 0.7) {
                    // Jump high
                    const jumpRatio = (jumpProgress - 0.35) / 0.35; // 0 to 1
                    this.targetSquashX = 0.7; // narrow
                    this.targetStretchY = 1.35; // stretched
                    this.danceOffsetY = -45 * this.scale * Math.sin(jumpRatio * Math.PI); // jump path
                    this.targetPupilX = 0;
                    this.targetPupilY = -0.3;
                    this.mood = 'eureka';
                } else {
                    // Settle & recover
                    const landRatio = (jumpProgress - 0.7) / 0.3; // 0 to 1
                    this.targetSquashX = 1.0 + (1 - landRatio) * 0.2; // landing squish
                    this.targetStretchY = 1.0 - (1 - landRatio) * 0.15;
                    this.danceOffsetY = (1 - landRatio) * 8 * this.scale;
                }
            }
            
            // End dance after duration
            if (this.danceTimer >= this.danceDuration) {
                this.stopDance();
                this.setMood('happy', 1000);
            }
        }

        // Update sad tears
        this._updateTears(dt);

        // Sleepy mood detailed animations (flutters and breathing)
        if (this.mood === 'sleepy' && !this.isBooting && !this.isDancing) {
            // Slow, deep vertical stretch for breathing
            this.targetStretchY = 1.0 + Math.sin(this.breathPhase) * 0.08;
            this.targetSquashX = 1.0 - Math.sin(this.breathPhase) * 0.04;
            
            // Random rapid eyelid flutters
            this.sleepFlutterTimer += dt;
            if (this.sleepFlutterTimer > 4.0 + Math.random() * 3.5) {
                this.sleepFlutterTimer = 0;
                // Rapid blink flutter
                this.eyeOpenL = 0.03;
                this.eyeOpenR = 0.03;
            }
        }

        // Curious circular scanning
        if (this.mood === 'curious' && !this.isBooting && !this.isDancing) {
            this.curiousScanPhase += dt * 1.8;
            // Infinity loop (Figure-8) pupil path
            this.targetPupilX = Math.cos(this.curiousScanPhase) * 0.45;
            this.targetPupilY = Math.sin(this.curiousScanPhase * 2.0) * 0.18;
        }

        // Eureka bulb flash fade
        if (this.eurekaFlashAlpha > 0) {
            this.eurekaFlashAlpha -= dt * 1.8;
            this.eurekaFlashRingSize += dt * 450 * this.scale;
            if (this.eurekaFlashAlpha < 0) {
                this.eurekaFlashAlpha = 0;
            }
        }
        
        // ═══════ NEW MODE UPDATES ═══════
        
        // Karaoke Mode Update
        if (this.isKaraoke) {
            this.karaokePhase += dt * 10;
            this.karaokeBeatTimer += dt;
            // Rhythmic mouth movement
            this.karaokeMouthOpen = 0.3 + Math.abs(Math.sin(this.karaokePhase * 1.5)) * 0.5;
            this.mouthOpen = this.karaokeMouthOpen;
            // Body bounce to beat
            const beatInterval = 0.4;
            if (this.karaokeBeatTimer > beatInterval) {
                this.karaokeBeatTimer = 0;
                this.bounceVel = -2.5;
                this.targetSquashX = 1.08 + Math.sin(this.karaokePhase) * 0.06;
                this.targetStretchY = 0.92 - Math.sin(this.karaokePhase) * 0.04;
                setTimeout(() => {
                    this.targetSquashX = 1.0;
                    this.targetStretchY = 1.0;
                }, 150);
            }
            // Sway head
            this.targetHeadTilt = Math.sin(this.karaokePhase * 0.7) * 0.05;
            // Pupil dance
            this.targetPupilX = Math.sin(this.karaokePhase * 0.5) * 0.4;
            this.targetPupilY = Math.cos(this.karaokePhase * 0.3) * 0.15;
        }
        
        // Sleep Mode Update
        if (this.isSleepMode) {
            this.sleepPhase += dt;
            // Slowly close eyes
            const sleepProgress = Math.min(this.sleepPhase / 3.0, 1.0);
            this._targetEyeOpen = 0.35 - sleepProgress * 0.3;
            // Slow breathing
            this.targetStretchY = 1.0 + Math.sin(this.sleepPhase * 0.8) * 0.06;
            this.targetSquashX = 1.0 - Math.sin(this.sleepPhase * 0.8) * 0.03;
            // Very gentle sway
            this.targetHeadTilt = Math.sin(this.sleepPhase * 0.3) * 0.015;
            // Update star twinkle
            for (const star of this.sleepStars) {
                star.twinklePhase += dt * star.twinkleSpeed;
            }
        }
        
        // Love Mode Update (enhanced)
        if (this.isLoveMode) {
            this.lovePhase += dt;
            // Spawn floating hearts
            if (Math.random() < dt * 2.5) {
                this.loveHearts.push({
                    x: 0.3 + Math.random() * 0.4,
                    y: 0.9,
                    vy: -(0.15 + Math.random() * 0.12),
                    vx: (Math.random() - 0.5) * 0.06,
                    size: 8 + Math.random() * 14,
                    alpha: 0.8 + Math.random() * 0.2,
                    rotation: (Math.random() - 0.5) * 0.5,
                });
            }
            // Update hearts
            for (let i = this.loveHearts.length - 1; i >= 0; i--) {
                const h = this.loveHearts[i];
                h.y += h.vy * dt;
                h.x += h.vx * dt + Math.sin(h.y * 8) * 0.003;
                h.alpha -= dt * 0.25;
                if (h.alpha <= 0 || h.y < -0.1) {
                    this.loveHearts.splice(i, 1);
                }
            }
            // Heartbeat pulse
            this._targetBlush = 0.7;
        }
        
        // Pong Game Update
        if (this.isPongMode) {
            const ball = this.pongBall;
            const speed = 1.2;
            ball.x += ball.vx * dt * speed;
            ball.y += ball.vy * dt * speed;
            
            // Top/bottom wall bounce
            if (ball.y <= 0.05 || ball.y >= 0.95) {
                ball.vy = -ball.vy;
                ball.y = Math.max(0.05, Math.min(0.95, ball.y));
            }
            
            // CPU paddle AI (tracks ball with slight delay)
            this.pongPaddleR = lerp(this.pongPaddleR, ball.y, dt * 3.5);
            
            // Player paddle follows mouse/pupil Y
            this.pongPaddleL = lerp(this.pongPaddleL, 0.5 + this.pupilY * 0.4, dt * 8);
            
            // Left paddle hit
            if (ball.x <= 0.12 && ball.vx < 0) {
                if (Math.abs(ball.y - this.pongPaddleL) < 0.15) {
                    ball.vx = Math.abs(ball.vx) * 1.05;
                    ball.vy += (ball.y - this.pongPaddleL) * 1.5;
                    if (typeof soundEngine !== 'undefined') soundEngine.playMoodSound('pong_hit');
                } else {
                    // Score for CPU
                    this.pongScoreR++;
                    if (typeof soundEngine !== 'undefined') soundEngine.playMoodSound('pong_miss');
                    if (window.app && window.app.connected && typeof ble !== 'undefined') {
                        ble.playAnimation(0x01); // Disappointed Shake
                    }
                    ball.x = 0.5; ball.y = 0.5;
                    ball.vx = 0.6; ball.vy = (Math.random() - 0.5) * 0.6;
                    this._updatePongScoreUI();
                }
            }
            
            // Right paddle hit
            if (ball.x >= 0.88 && ball.vx > 0) {
                if (Math.abs(ball.y - this.pongPaddleR) < 0.15) {
                    ball.vx = -Math.abs(ball.vx) * 1.05;
                    ball.vy += (ball.y - this.pongPaddleR) * 1.5;
                    if (typeof soundEngine !== 'undefined') soundEngine.playMoodSound('pong_hit');
                } else {
                    // Score for Player
                    this.pongScoreL++;
                    if (typeof soundEngine !== 'undefined') soundEngine.playMoodSound('pong_score');
                    if (window.app && window.app.connected && typeof ble !== 'undefined') {
                        ble.playAnimation(0x04); // Excited Jump
                    }
                    ball.x = 0.5; ball.y = 0.5;
                    ball.vx = -0.6; ball.vy = (Math.random() - 0.5) * 0.6;
                    this._updatePongScoreUI();
                }
            }
            
            // Clamp velocity
            const maxV = 1.5;
        }
        
        // RPS Game Update
        if (this.isRPSMode) {
            if (this.rpsPhase === 'countdown') {
                this.rpsCountdownTimer += dt;
                if (this.rpsCountdownTimer >= 1.0) {
                    this.rpsCountdownTimer = 0;
                    this.rpsCountdown--;
                    if (this.rpsCountdown <= 0) {
                        this.rpsPhase = 'show';
                        this.rpsShowTimer = 0;
                    }
                }
            }
            else if (this.rpsPhase === 'show') {
                this.rpsShowTimer += dt;
                if (this.rpsShowTimer >= 1.5) {
                    this.rpsPhase = 'detect';
                    // app.js will call rpsSetPlayerChoice() when detection completes
                    // If no detection after 4 seconds, default to rock
                    this.rpsShowTimer = 0;
                }
            }
            else if (this.rpsPhase === 'detect') {
                this.rpsShowTimer += dt;
                if (this.rpsShowTimer >= 4.0 && !this.rpsPlayerChoice) {
                    // Timeout — default to rock
                    this.rpsSetPlayerChoice('rock');
                }
            }
            else if (this.rpsPhase === 'result') {
                this.rpsResultTimer += dt;
                if (this.rpsResultTimer >= 3.0) {
                    this.rpsRound++;
                    if (this.rpsRound > this.rpsMaxRounds) {
                        this.rpsPhase = 'gameover';
                        this.rpsResultTimer = 0;
                    } else {
                        this._startRPSNextRound();
                        this._updateRPSRoundUI();
                    }
                }
            }
            else if (this.rpsPhase === 'gameover') {
                this.rpsResultTimer += dt;
                // Let app.js handle full game over after 4 seconds
            }
            ball.vx = Math.max(-maxV, Math.min(maxV, ball.vx));
            ball.vy = Math.max(-maxV, Math.min(maxV, ball.vy));
            
            // Eyes track ball
            this.targetPupilX = (ball.x - 0.5) * 1.5;
            this.targetPupilY = (ball.y - 0.5) * 0.8;
        }
        
        // Photo Mode Update
        if (this.isPhotoMode) {
            this.photoPosePhase += dt;
            // Wide-eyed excited pose
            this._targetEyeOpen = 1.2;
            this._targetSmile = 0.8;
            this._targetBlush = 0.3;
            this.targetPupilX = Math.sin(this.photoPosePhase * 0.5) * 0.15;
        }
        // Photo flash fade
        if (this.photoFlashAlpha > 0) {
            this.photoFlashAlpha -= dt * 3.0;
            if (this.photoFlashAlpha < 0) this.photoFlashAlpha = 0;
        }
        
        // Story Mode Update
        if (this.isStoryMode) {
            this.storyPhase += dt;
            const seq = this.storySequence;
            let elapsed = 0;
            for (let i = 0; i < seq.length; i++) {
                if (this.storyPhase < elapsed + seq[i].duration) {
                    if (this.storyMoodIndex !== i) {
                        this.storyMoodIndex = i;
                        this.setMood(seq[i].mood, seq[i].duration * 1000, true, true);
                        this.showCommand(seq[i].label, seq[i].duration * 1000);
                        
                        // Send BLE animation feedback during story mood transitions
                        if (window.app && window.app.connected && typeof ble !== 'undefined') {
                            const moodAnims = {
                                happy: 0x02,     // nod
                                curious: 0x01,   // shake
                                surprised: 0x04, // excited
                                excited: 0x04,   // excited
                                shy: 0x05,       // shy
                                love: 0x04,      // excited/love
                                sad: 0x01,       // shake
                                thinking: 0x01,  // shake
                                eureka: 0x02,    // nod
                            };
                            const animId = moodAnims[seq[i].mood] || 0x02;
                            ble.playAnimation(animId);
                        }
                    }
                    break;
                }
                elapsed += seq[i].duration;
            }
            // End story when all sequences complete
            const totalDuration = seq.reduce((sum, s) => sum + s.duration, 0);
            if (this.storyPhase >= totalDuration) {
                this.stopStoryMode();
                this.setMood('happy', 3000);
            }
        }
        
        // DJ Mode Update
        if (this.isDJMode) {
            this.djPhase += dt;
            if (this.djAnalyser && this.djDataArray) {
                this.djAnalyser.getByteFrequencyData(this.djDataArray);
                const binSize = Math.floor(this.djDataArray.length / 16);
                for (let i = 0; i < 16; i++) {
                    let sum = 0;
                    for (let j = 0; j < binSize; j++) {
                        sum += this.djDataArray[i * binSize + j];
                    }
                    const target = (sum / binSize) / 255;
                    this.djBars[i] = lerp(this.djBars[i], target, dt * 15);
                }
            } else {
                // Simulated equalizer when no mic input
                for (let i = 0; i < 16; i++) {
                    const target = 0.2 + Math.abs(Math.sin(this.djPhase * 4 + i * 0.5)) * 0.6 
                                 + Math.abs(Math.sin(this.djPhase * 7 + i * 1.2)) * 0.2;
                    this.djBars[i] = lerp(this.djBars[i], target, dt * 12);
                }
            }
            // Bounce eyes to beat
            const avgLevel = this.djBars.reduce((a, b) => a + b, 0) / this.djBars.length;
            this.targetPupilDilation = 0.35 + avgLevel * 0.2;
            if (avgLevel > 0.5) {
                this.targetSquashX = 1.0 + (avgLevel - 0.5) * 0.2;
                this.targetStretchY = 1.0 - (avgLevel - 0.5) * 0.15;
            }
        }
        
        // Thinking animation (rapid pupil scanning)
        if (this.mood === 'thinking') {
            this.thinkingTimer += dt;
            this.targetPupilX = Math.sin(this.thinkingTimer * 6) * 0.55;
            this.targetPupilY = Math.cos(this.thinkingTimer * 3) * 0.12;
        } else if (this.mood !== 'curious' && !this.isDancing) {
            this.thinkingTimer = 0;
        }
        
        // Speaking animation (rapid vertical eye pulsing)
        if (this.isSpeaking) {
            this.speakingPhase += dt * 18;
            this.speakingOffset = Math.sin(this.speakingPhase) * 0.18;
        } else {
            this.speakingOffset = 0;
            this.speakingPhase = 0;
        }
        
        // Mood transition
        this.mouthSmile = lerp(this.mouthSmile, this._targetSmile || 0.5, speed);
        if (!this.isBooting) {
            this.eyeOpenL = lerp(this.eyeOpenL, this._targetEyeOpen || 1, speed);
            this.eyeOpenR = lerp(this.eyeOpenR, this._targetEyeOpen || 1, speed);
        }
        this.blushOpacity = lerp(this.blushOpacity, this._targetBlush || 0, speed * 0.5);
        
        // Eyelid flutter effect (micro-twitches)
        if (this.isFluttering) {
            this.flutterTimer -= dt;
            if (this.flutterTimer <= 0) {
                this.isFluttering = false;
            } else {
                const flutterAmt = 0.06 * Math.sin(Date.now() * 0.06);
                this.eyeOpenL = Math.max(0.02, this.eyeOpenL - Math.abs(flutterAmt));
                this.eyeOpenR = Math.max(0.02, this.eyeOpenR - Math.abs(flutterAmt));
            }
        }

        // Ambient glance-away system
        const canGlance = !this.isBooting && !this.isDancing && this.mood !== 'curious' && this.mood !== 'thinking' && !this.isSpeaking;
        if (canGlance) {
            if (this.isGlancingAway) {
                this.glanceDuration -= dt;
                if (this.glanceDuration <= 0) {
                    this.isGlancingAway = false;
                }
            } else {
                this.glanceTimer += dt;
                if (this.glanceTimer > 8.0 + Math.random() * 4.0) {
                    this.isGlancingAway = true;
                    this.glanceDuration = 0.5 + Math.random() * 0.4;
                    this.glanceTimer = 0;
                    this.glanceTargetX = Math.random() > 0.5 ? 0.75 : -0.75;
                    this.glanceTargetY = (Math.random() - 0.5) * 0.35;
                }
            }
        } else {
            this.isGlancingAway = false;
            this.glanceTimer = 0;
        }

        let actualTargetPupilX = this.targetPupilX;
        let actualTargetPupilY = this.targetPupilY;
        if (this.isGlancingAway) {
            actualTargetPupilX = this.glanceTargetX;
            actualTargetPupilY = this.glanceTargetY;
        }

        // Pupil tracking with ambient glance override
        this.pupilX = lerp(this.pupilX, actualTargetPupilX, speed * 1.8);
        this.pupilY = lerp(this.pupilY, actualTargetPupilY + (this._targetPupilYBias || 0), speed * 1.8);

        // Micro-saccades system
        this.saccadeTimer += dt;
        if (this.saccadeTimer > 1.5 + Math.random() * 1.5) {
            this.saccadeTimer = 0;
            this.targetSaccadeOffsetX = (Math.random() - 0.5) * 0.08;
            this.targetSaccadeOffsetY = (Math.random() - 0.5) * 0.06;
        }
        this.saccadeOffsetX = lerp(this.saccadeOffsetX, this.targetSaccadeOffsetX, dt * 25);
        this.saccadeOffsetY = lerp(this.saccadeOffsetY, this.targetSaccadeOffsetY, dt * 25);
        
        // ═══════ Squash & Stretch spring physics ═══════
        const springK = 18;   // Spring stiffness
        const springD = 0.65; // Damping
        
        const squashDiff = this.targetSquashX - this.squashX;
        this.squashSpring += squashDiff * springK * dt;
        this.squashSpring *= (1 - springD * dt * 10);
        this.squashX += this.squashSpring * dt;
        
        const stretchDiff = this.targetStretchY - this.stretchY;
        this.stretchSpring += stretchDiff * springK * dt;
        this.stretchSpring *= (1 - springD * dt * 10);
        this.stretchY += this.stretchSpring * dt;
        
        // ═══════ Pupil Dilation smooth lerp ═══════
        this.pupilDilation = lerp(this.pupilDilation, this.targetPupilDilation, speed * 0.8);
        
        // ═══════ Head Tilt smooth lerp ═══════
        this.headTilt = lerp(this.headTilt, this.targetHeadTilt, speed * 1.2);
        
        // ═══════ Eye Glow Pulse ═══════
        this.glowPhase += dt * 2.5;
        const baseGlow = 0.15;
        const pulseGlow = Math.sin(this.glowPhase) * 0.1;
        const speakingBoost = this.isSpeaking ? 0.2 : 0;
        const excitedBoost = (this.mood === 'excited' || this.mood === 'eureka') ? 0.15 : 0;
        this.glowIntensity = baseGlow + pulseGlow + speakingBoost + excitedBoost;
        
        // ═══════ Particle System Update ═══════
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.life += dt;
            p.x += p.vx * dt + Math.sin(p.life * p.wobbleSpeed + p.wobblePhase) * 0.002;
            p.y += p.vy * dt;
            
            // Fade in and out
            const lifeRatio = p.life / p.maxLife;
            if (lifeRatio < 0.1) {
                p.alpha = (lifeRatio / 0.1) * (0.15 + Math.random() * 0.2);
            } else if (lifeRatio > 0.7) {
                p.alpha *= (1 - (lifeRatio - 0.7) / 0.3);
            }
            
            // Respawn when dead or off screen
            if (p.life >= p.maxLife || p.y < -0.1 || p.x < -0.1 || p.x > 1.1) {
                this.particles[i] = this._createParticle();
            }
        }
        
        // Breathing
        this.breathPhase += dt * 1.2;
        const breathOffset = Math.sin(this.breathPhase) * 2 * this.scale;
        
        // Blink
        this.blinkTimer += dt * 1000;
        if (!this.isBlinking && this.blinkTimer >= this.blinkInterval) {
            this.isBlinking = true;
            this.blinkPhase = 0;
            this.blinkTimer = 0;
            this.blinkInterval = 2500 + Math.random() * 4000;
            
            // ═══════ NEW: Squash on blink ═══════
            this.targetSquashX = 1.1;
            this.targetStretchY = 0.9;
            setTimeout(() => {
                this.targetSquashX = 0.95;
                this.targetStretchY = 1.05;
                setTimeout(() => {
                    this.targetSquashX = 1.0;
                    this.targetStretchY = 1.0;
                }, 80);
            }, 60);
            
            // Double blink sometimes
            if (Math.random() > 0.7) {
                setTimeout(() => {
                    this.isBlinking = true;
                    this.blinkPhase = 0;
                }, 200);
            }
        }
        
        if (this.isBlinking) {
            this.blinkPhase += dt * 12;
            const blinkCurve = Math.sin(this.blinkPhase * Math.PI);
            const blinkAmount = Math.max(0, blinkCurve);
            this.eyeOpenL = Math.max(0.02, this.eyeOpenL * (1 - blinkAmount));
            this.eyeOpenR = Math.max(0.02, this.eyeOpenR * (1 - blinkAmount));
            
            if (this.blinkPhase >= 1) {
                this.isBlinking = false;
                // Trigger flutter 40% of the time after blink finishes
                if (Math.random() > 0.6) {
                    this.isFluttering = true;
                    this.flutterTimer = 0.3; // flutter for 300ms
                }
            }
        }
        
        // Bounce physics
        this.bounceVel += 12 * dt;  // gravity
        this.bounceY += this.bounceVel;
        if (this.bounceY >= 0) {
            this.bounceY = 0;
            if (Math.abs(this.bounceVel) > 1) {
                // ═══════ NEW: Landing squash ═══════
                this.targetSquashX = 1.1;
                this.targetStretchY = 0.9;
                setTimeout(() => {
                    this.targetSquashX = 1.0;
                    this.targetStretchY = 1.0;
                }, 80);
            }
            this.bounceVel = 0;
        }
        
        // Mouth (slight idle movement)
        if (this.mood === 'happy' || this.mood === 'excited') {
            this.mouthOpen = 0.1 + Math.sin(this.breathPhase * 0.5) * 0.05;
        } else {
            this.mouthOpen = lerp(this.mouthOpen, 0, speed);
        }
        
        return breathOffset;
    }
    
    // ─── Drawing ───
    
    draw(breathOffset) {
        const ctx = this.ctx;
        const s = this.scale;
        const cx = this.cx + (this.isDancing ? this.danceOffsetX : 0);
        const cy = this.cy + breathOffset + this.bounceY * s + (this.isDancing ? this.danceOffsetY : 0);
        
        // Clear background with pure black to merge with the phone screen bezel
        ctx.fillStyle = this.colors.faceBase;
        ctx.fillRect(0, 0, this.w, this.h);
        
        // ═══════ Draw floating particles (behind eyes) ═══════
        this._drawParticles(ctx);
        
        // ═══════ Apply head tilt + dance rotation ═══════
        const totalRotation = this.headTilt + (this.isDancing ? this.danceRotation : 0);
        if (Math.abs(totalRotation) > 0.001) {
            ctx.save();
            ctx.translate(this.cx, this.cy);
            ctx.rotate(totalRotation);
            ctx.translate(-this.cx, -this.cy);
        }
        
        // ── Eye parameters (scaled up to match LOOI's massive circles) ──
        const eyeSpacing = 82 * s;
        const eyeWidth = 65 * s;
        const eyeHeight = 65 * s;
        const eyeY = cy; // Center vertically on the screen
        
        // ═══════ Draw eye glow (behind eyes) ═══════
        if (this.glowIntensity > 0.01) {
            this._drawEyeGlow(cx - eyeSpacing, eyeY, eyeWidth * 1.8, this.glowIntensity);
            this._drawEyeGlow(cx + eyeSpacing, eyeY, eyeWidth * 1.8, this.glowIntensity);
        }
        
        // Left eye
        if (this.mood === 'confused') {
            this.drawEye(cx - eyeSpacing, eyeY, eyeWidth, eyeHeight, this.eyeOpenL * 0.7, false);
            this.drawEye(cx + eyeSpacing, eyeY, eyeWidth, eyeHeight, this.eyeOpenR * 1.15, true);
        } else {
            this.drawEye(cx - eyeSpacing, eyeY, eyeWidth, eyeHeight, this.eyeOpenL, false);
            this.drawEye(cx + eyeSpacing, eyeY, eyeWidth, eyeHeight, this.eyeOpenR, true);
        }
        
        // ── Cheek blush ──
        if (this.blushOpacity > 0.01) {
            this.drawBlush(cx - eyeSpacing - 10 * s, eyeY + 45 * s, 25 * s, this.blushOpacity);
            this.drawBlush(cx + eyeSpacing + 10 * s, eyeY + 45 * s, 25 * s, this.blushOpacity);
        }

        // ── Dog Mode Features ──
        if (this.dogMode) {
            this.drawDogFeatures(ctx, cx, eyeY, eyeSpacing, s);
        }
        
        // ── Expression extras (drawn directly on top of the black canvas) ──
        if (this.mood === 'love') {
            this.drawHearts(cx, cy, s);
        }
        if (this.mood === 'sleepy') {
            this.drawZzz(cx + 75 * s, cy - 60 * s, s);
        }
        if (this.mood === 'surprised') {
            this.drawExclamation(cx, cy - 80 * s, s);
        }
        if (this.mood === 'confused') {
            this.drawQuestionMarks(cx + 75 * s, cy - 60 * s, s);
        }
        if (this.mood === 'eureka') {
            this.drawLightbulb(cx, cy - 85 * s, s);
        }
        if (this.mood === 'focused') {
            this.drawFocusBrackets(cx, cy, eyeSpacing, eyeWidth, s);
        }
        
        // Draw sad tears on top of cheeks/eyes
        this._drawTears(ctx);
        
        // Draw Eureka bright flash ring
        this._drawEurekaFlash(ctx);
        
        // ═══════ NEW MODE DRAWS ═══════
        
        // Sleep Mode - Stars and Moon
        if (this.isSleepMode) {
            this._drawSleepOverlay(ctx);
        }
        
        // Love Mode - Floating Hearts
        if (this.isLoveMode) {
            this._drawLoveHearts(ctx);
        }
        
        // Pong Game
        if (this.isPongMode) {
            this._drawPong(ctx);
        }
        
        // RPS Game
        if (this.isRPSMode) {
            this._drawRPS(ctx);
        }
        
        // DJ Mode - Equalizer Bars
        if (this.isDJMode) {
            this._drawDJBars(ctx);
        }
        
        // Restore head tilt transform
        if (Math.abs(totalRotation) > 0.001) {
            ctx.restore();
        }

        // Photo flash overlay (full canvas, drawn after restore)
        if (this.photoFlashAlpha > 0) {
            ctx.save();
            ctx.fillStyle = `rgba(255, 255, 255, ${this.photoFlashAlpha})`;
            ctx.fillRect(0, 0, this.w, this.h);
            ctx.restore();
        }

        // Draw active command label
        if (this.commandLabel && Date.now() < this.commandLabelExpiry) {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 162, 255, 0.95)'; // Signature blue
            ctx.font = `bold ${18 * s}px ${getComputedStyle(document.body).fontFamily || 'sans-serif'}`;
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0, 86, 255, 0.6)';
            ctx.shadowBlur = 6 * s;
            ctx.fillText(this.commandLabel, cx, cy - 110 * s);
            ctx.restore();
        }
    }

    _drawTears(ctx) {
        ctx.save();
        for (const t of this.sadTears) {
            ctx.fillStyle = `rgba(116, 185, 255, ${t.alpha})`;
            ctx.beginPath();
            // Droplet shape
            ctx.moveTo(t.x, t.y - t.size);
            ctx.quadraticCurveTo(t.x - t.size, t.y, t.x, t.y + t.size * 1.5);
            ctx.quadraticCurveTo(t.x + t.size, t.y, t.x, t.y - t.size);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    _drawEurekaFlash(ctx) {
        if (this.eurekaFlashAlpha > 0) {
            ctx.save();
            ctx.strokeStyle = `rgba(253, 203, 110, ${this.eurekaFlashAlpha})`;
            ctx.lineWidth = 4 * this.scale;
            ctx.beginPath();
            ctx.arc(this.cx, this.cy, this.eurekaFlashRingSize, 0, Math.PI * 2);
            ctx.stroke();
            
            // Full screen flash fade
            ctx.fillStyle = `rgba(253, 203, 110, ${this.eurekaFlashAlpha * 0.15})`;
            ctx.fillRect(0, 0, this.w, this.h);
            ctx.restore();
        }
    }
    
    drawEye(x, y, w, h, openAmount, isRight) {
        const ctx = this.ctx;
        const s = this.scale;
        const clampedOpen = Math.max(0.02, Math.min(1.3, openAmount + (this.speakingOffset || 0)));
        const actualH = h * clampedOpen;
        
        // Love mood heartbeat scale pulse
        let heartbeatScale = 1.0;
        if (this.mood === 'love' && !this.isBooting) {
            const t = Date.now() / 1000;
            const pulse = (t * 2.0) % 1.0;
            if (pulse < 0.15) {
                heartbeatScale = 1.0 + Math.sin((pulse / 0.15) * Math.PI) * 0.12;
            } else if (pulse < 0.3) {
                heartbeatScale = 1.0 + Math.sin(((pulse - 0.15) / 0.15) * Math.PI) * 0.08;
            }
        }
        
        // Angry tremble jitter
        let jitterX = 0;
        if (this.mood === 'angry' && !this.isBooting) {
            jitterX = (Math.random() - 0.5) * 3.5 * s;
        }
        
        // ═══════ Apply squash & stretch ═══════
        const sqW = w * this.squashX * heartbeatScale;
        const sqH = actualH * this.stretchY * heartbeatScale;
        
        // LOOI eyes shift their entire position to look around
        const lookX = (this.pupilX + this.saccadeOffsetX) * w * 0.45;
        const lookY = (this.pupilY + this.saccadeOffsetY) * h * 0.35;
        
        const drawSingleShape = (ox, oy, fillStyle, isShadow) => {
            ctx.save();
            
            // Re-color hearts to red/pink
            let currentFill = fillStyle;
            if (this.mood === 'love') {
                currentFill = isShadow ? '#990022' : '#ff2a6d';
            }
            ctx.fillStyle = currentFill;
            
            ctx.beginPath();
            if (this.mood === 'love') {
                // Heart shape — apply squash/stretch to heart
                const size = sqW * 1.3;
                const cy = oy - size * 0.25;
                ctx.moveTo(ox, cy + size * 0.3);
                ctx.bezierCurveTo(ox - size * 0.5, cy - size * 0.55, ox - size * 1.1, cy + size * 0.2, ox, cy + size * 1.05 * this.stretchY);
                ctx.bezierCurveTo(ox + size * 1.1, cy + size * 0.2, ox + size * 0.5, cy - size * 0.55, ox, cy + size * 0.3);
                ctx.fill();
            } else {
                // Ellipse shape (standard LOOI eyes) with squash & stretch
                const radiusX = Math.max(0.1, sqW);
                const radiusY = Math.max(0.1, sqH);
                if (Math.abs(radiusX - radiusY) < 0.01) {
                    ctx.arc(ox, oy, radiusX, 0, Math.PI * 2);
                } else {
                    ctx.ellipse(ox, oy, radiusX, radiusY, 0, 0, Math.PI * 2);
                }
                ctx.fill();
                
                // ═══════ NEW: Pupil (inner dark circle) ═══════
                if (!isShadow && clampedOpen > 0.15) {
                    const pupilR = Math.min(radiusX, radiusY) * this.pupilDilation;
                    if (pupilR > 1) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
                        ctx.beginPath();
                        ctx.arc(ox + (this.pupilX + this.saccadeOffsetX) * radiusX * 0.15, oy + (this.pupilY + this.saccadeOffsetY) * radiusY * 0.1, pupilR, 0, Math.PI * 2);
                        ctx.fill();
                        
                        // ═══════ NEW: Inner highlight (white glint) ═══════
                        const hlX = ox - radiusX * 0.22 + (this.pupilX + this.saccadeOffsetX) * radiusX * 0.08;
                        const hlY = oy - radiusY * 0.25 + (this.pupilY + this.saccadeOffsetY) * radiusY * 0.05;
                        const hlR = pupilR * 0.35;
                        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * clampedOpen})`;
                        ctx.beginPath();
                        ctx.arc(hlX, hlY, Math.max(1, hlR), 0, Math.PI * 2);
                        ctx.fill();
                        
                        // Secondary smaller highlight
                        const hl2X = ox + radiusX * 0.15 + (this.pupilX + this.saccadeOffsetX) * radiusX * 0.05;
                        const hl2Y = oy + radiusY * 0.15 + (this.pupilY + this.saccadeOffsetY) * radiusY * 0.03;
                        const hl2R = pupilR * 0.15;
                        ctx.fillStyle = `rgba(255, 255, 255, ${0.4 * clampedOpen})`;
                        ctx.beginPath();
                        ctx.arc(hl2X, hl2Y, Math.max(0.5, hl2R), 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                
                // Flat angled cover-ups for Angry and Sad expressions
                if (this.mood === 'angry') {
                    ctx.fillStyle = this.colors.faceBase;
                    ctx.beginPath();
                    if (isRight) {
                        ctx.moveTo(ox - sqW * 1.3, oy - sqH * 1.5);
                        ctx.lineTo(ox - sqW * 1.3, oy - sqH * 0.1);
                        ctx.lineTo(ox + sqW * 1.3, oy - sqH * 0.75);
                        ctx.lineTo(ox + sqW * 1.3, oy - sqH * 1.5);
                    } else {
                        ctx.moveTo(ox - sqW * 1.3, oy - sqH * 1.5);
                        ctx.lineTo(ox - sqW * 1.3, oy - sqH * 0.75);
                        ctx.lineTo(ox + sqW * 1.3, oy - sqH * 0.1);
                        ctx.lineTo(ox + sqW * 1.3, oy - sqH * 1.5);
                    }
                    ctx.closePath();
                    ctx.fill();
                } else if (this.mood === 'sad') {
                    ctx.fillStyle = this.colors.faceBase;
                    ctx.beginPath();
                    if (isRight) {
                        ctx.moveTo(ox - sqW * 1.3, oy - sqH * 1.5);
                        ctx.lineTo(ox - sqW * 1.3, oy - sqH * 0.7);
                        ctx.lineTo(ox + sqW * 1.3, oy - sqH * 0.15);
                        ctx.lineTo(ox + sqW * 1.3, oy - sqH * 1.5);
                    } else {
                        ctx.moveTo(ox - sqW * 1.3, oy - sqH * 1.5);
                        ctx.lineTo(ox - sqW * 1.3, oy - sqH * 0.15);
                        ctx.lineTo(ox + sqW * 1.3, oy - sqH * 0.7);
                        ctx.lineTo(ox + sqW * 1.3, oy - sqH * 1.5);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
            }
            ctx.restore();
        };
        
        // 1. Draw 3D shadow (darker blue offset bottom-right)
        const shadowDX = 6 * s;
        const shadowDY = 8 * s;
        drawSingleShape(x + lookX + shadowDX + jitterX, y + lookY + shadowDY, this.colors.eyeShadow, true);
        
        // 2. Draw main cyan eye shape
        drawSingleShape(x + lookX + jitterX, y + lookY, this.colors.eyeColor, false);
    }
    
    // ═══════ NEW: Eye Glow Drawing ═══════
    
    _drawEyeGlow(x, y, radius, intensity) {
        const ctx = this.ctx;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        const color = this._getMoodParticleColor();
        grad.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${intensity * 0.35})`);
        grad.addColorStop(0.5, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${intensity * 0.1})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    
    // ═══════ NEW: Particle Drawing ═══════
    
    _drawParticles(ctx) {
        const color = this._getMoodParticleColor();
        
        for (const p of this.particles) {
            if (p.alpha < 0.01) continue;
            
            const px = p.x * this.w;
            const py = p.y * this.h;
            
            ctx.save();
            ctx.globalAlpha = p.alpha;
            
            // Soft glowing dot
            const grad = ctx.createRadialGradient(px, py, 0, px, py, p.size * this.scale);
            grad.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.8)`);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            
            const r = p.size * this.scale * 2;
            ctx.fillRect(px - r, py - r, r * 2, r * 2);
            ctx.restore();
        }
    }
    
    drawBlush(x, y, r, opacity) {
        const ctx = this.ctx;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(247, 127, 190, ${opacity * 0.35})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    
    drawHearts(cx, cy, s) {
        const ctx = this.ctx;
        const t = Date.now() / 1000;
        
        for (let i = 0; i < 3; i++) {
            const phase = t * 0.8 + i * 2.1;
            const progress = (phase % 3) / 3;
            const x = cx + 60 * s + Math.sin(phase * 1.5) * 15 * s;
            const y = cy - 20 * s - progress * 80 * s;
            const alpha = 1 - progress;
            const size = (6 + i * 2) * s;
            
            if (alpha <= 0) continue;
            
            ctx.save();
            ctx.globalAlpha = alpha * 0.6;
            ctx.font = `${size}px serif`;
            ctx.fillText('❤', x, y);
            ctx.restore();
        }
    }
    
    drawZzz(x, y, s) {
        const ctx = this.ctx;
        const t = Date.now() / 1000;
        
        ctx.save();
        ctx.font = `bold ${14 * s}px ${getComputedStyle(document.body).fontFamily}`;
        ctx.fillStyle = 'rgba(79, 172, 254, 0.4)';
        
        for (let i = 0; i < 3; i++) {
            const phase = (t * 0.5 + i * 0.8) % 3;
            const progress = phase / 3;
            const px = x + i * 12 * s + Math.sin(phase) * 5 * s;
            const py = y - progress * 40 * s;
            const alpha = 1 - progress;
            
            ctx.globalAlpha = alpha * 0.5;
            ctx.font = `bold ${(10 + i * 4) * s}px ${getComputedStyle(document.body).fontFamily}`;
            ctx.fillText('Z', px, py);
        }
        ctx.restore();
    }
    
    drawExclamation(x, y, s) {
        const ctx = this.ctx;
        const t = Date.now() / 1000;
        const bounce = Math.sin(t * 6) * 3 * s;
        
        ctx.save();
        ctx.font = `bold ${18 * s}px serif`;
        ctx.fillStyle = 'rgba(255, 224, 102, 0.7)';
        ctx.textAlign = 'center';
        ctx.fillText('!', x - 10 * s, y + bounce);
        ctx.fillText('!', x + 10 * s, y - bounce);
        ctx.restore();
    }

    drawQuestionMarks(x, y, s) {
        const ctx = this.ctx;
        const t = Date.now() / 1000;
        
        ctx.save();
        ctx.fillStyle = 'rgba(162, 155, 254, 0.7)'; // Light purple accent color
        ctx.textAlign = 'center';
        
        for (let i = 0; i < 2; i++) {
            const phase = (t * 0.6 + i * 1.2) % 2;
            const progress = phase / 2;
            const px = x + i * 14 * s + Math.sin(phase * 2) * 4 * s;
            const py = y - progress * 30 * s;
            const alpha = 1 - progress;
            
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${(12 + i * 4) * s}px ${getComputedStyle(document.body).fontFamily || 'sans-serif'}`;
            ctx.fillText('?', px, py);
        }
        ctx.restore();
    }

    drawLightbulb(x, y, s) {
        const ctx = this.ctx;
        const t = Date.now() / 1000;
        const bounce = Math.sin(t * 8) * 4 * s;
        const glow = 10 + Math.abs(Math.sin(t * 8)) * 8;
        
        ctx.save();
        // Draw glow
        ctx.shadowColor = 'rgba(0, 162, 255, 0.8)'; // Blue accent
        ctx.shadowBlur = glow * s;
        
        // Draw lightbulb emoji 💡
        ctx.font = `${28 * s}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💡', x, y + bounce);
        ctx.restore();
    }

    drawFocusBrackets(cx, cy, eyeSpacing, eyeWidth, s) {
        const ctx = this.ctx;
        const t = Date.now() / 1000;
        // Subtle pulsing bracket size
        const pulse = Math.sin(t * 4) * 3 * s;
        
        // Draw brackets around left eye
        this.drawSingleFocusBracket(cx - eyeSpacing, cy, eyeWidth + 12 * s + pulse, s);
        // Draw brackets around right eye
        this.drawSingleFocusBracket(cx + eyeSpacing, cy, eyeWidth + 12 * s + pulse, s);
    }
    
    drawSingleFocusBracket(x, y, size, s) {
        const ctx = this.ctx;
        const len = 10 * s;
        const r = size;
        
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 206, 201, 0.45)'; // Teal focus glow
        ctx.lineWidth = 2 * s;
        ctx.lineCap = 'round';
        
        // Top Left
        ctx.beginPath();
        ctx.moveTo(x - r + len, y - r);
        ctx.lineTo(x - r, y - r);
        ctx.lineTo(x - r, y - r + len);
        ctx.stroke();
        
        // Top Right
        ctx.beginPath();
        ctx.moveTo(x + r - len, y - r);
        ctx.lineTo(x + r, y - r);
        ctx.lineTo(x + r, y - r + len);
        ctx.stroke();
        
        // Bottom Left
        ctx.beginPath();
        ctx.moveTo(x - r + len, y + r);
        ctx.lineTo(x - r, y + r);
        ctx.lineTo(x - r, y + r - len);
        ctx.stroke();
        
        // Bottom Right
        ctx.beginPath();
        ctx.moveTo(x + r - len, y + r);
        ctx.lineTo(x + r, y + r);
        ctx.lineTo(x + r, y + r - len);
        ctx.stroke();
        
        ctx.restore();
    }
    
    // ─── Animation Loop ───
    
    animate() {
        const now = Date.now();
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;
        
        const breathOffset = this.update(dt);
        this.draw(breathOffset);
        
        requestAnimationFrame(() => this.animate());
    }
    
    // ─── Public API ───
    
    setSpeaking(isSpeaking) {
        this.isSpeaking = isSpeaking;
        if (!isSpeaking) {
            this.speakingPhase = 0;
            this.speakingOffset = 0;
        }
    }
    
    getMoodLabel() {
        const labels = {
            happy: 'Happy',
            curious: 'Curious',
            sleepy: 'Sleepy',
            excited: 'Excited',
            sad: 'Sad',
            shy: 'Shy',
            love: 'In Love',
            angry: 'Angry',
            surprised: 'Surprised',
            thinking: 'Thinking...',
            focused: 'Focused',
            confused: 'Confused',
            eureka: 'Eureka!'
        };
        return labels[this.mood] || 'Happy';
    }
    
    showCommand(text, duration = 3000) {
        this.commandLabel = text;
        this.commandLabelExpiry = Date.now() + duration;
    }

    drawDogFeatures(ctx, cx, eyeY, eyeSpacing, s) {
        ctx.save();
        
        // Use glowing blue theme colors
        ctx.fillStyle = this.colors.eyeColor;
        ctx.strokeStyle = this.colors.eyeShadow;
        ctx.lineWidth = 4 * s;
        ctx.shadowColor = 'rgba(0, 162, 255, 0.4)';
        ctx.shadowBlur = 10 * s;

        // 1. Draw Floppy Left Ear
        ctx.beginPath();
        const leftEarX = cx - eyeSpacing - 50 * s;
        const leftEarY = eyeY - 20 * s;
        ctx.moveTo(leftEarX, leftEarY);
        ctx.bezierCurveTo(leftEarX - 45 * s, leftEarY - 20 * s, leftEarX - 60 * s, leftEarY + 80 * s, leftEarX - 10 * s, leftEarY + 90 * s);
        ctx.bezierCurveTo(leftEarX + 20 * s, leftEarY + 95 * s, leftEarX + 10 * s, leftEarY + 20 * s, leftEarX, leftEarY);
        ctx.fill();
        ctx.stroke();

        // 2. Draw Floppy Right Ear
        ctx.beginPath();
        const rightEarX = cx + eyeSpacing + 50 * s;
        const rightEarY = eyeY - 20 * s;
        ctx.moveTo(rightEarX, rightEarY);
        ctx.bezierCurveTo(rightEarX + 45 * s, rightEarY - 20 * s, rightEarX + 60 * s, rightEarY + 80 * s, rightEarX + 10 * s, rightEarY + 90 * s);
        ctx.bezierCurveTo(rightEarX - 20 * s, rightEarY + 95 * s, rightEarX - 10 * s, rightEarY + 20 * s, rightEarX, rightEarY);
        ctx.fill();
        ctx.stroke();

        // 3. Draw Dog Nose / Snout (small rounded inverted triangle at bottom center)
        ctx.beginPath();
        const noseX = cx;
        const noseY = eyeY + 25 * s;
        ctx.moveTo(noseX, noseY);
        ctx.bezierCurveTo(noseX - 18 * s, noseY - 8 * s, noseX - 15 * s, noseY - 15 * s, noseX, noseY - 12 * s);
        ctx.bezierCurveTo(noseX + 15 * s, noseY - 15 * s, noseX + 18 * s, noseY - 8 * s, noseX, noseY);
        ctx.fillStyle = this.colors.eyeColor;
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
    }

    _drawSleepOverlay(ctx) {
        ctx.save();
        const s = this.scale;
        
        // Twinkling stars
        for (const star of this.sleepStars) {
            const alpha = 0.2 + Math.abs(Math.sin(star.twinklePhase)) * 0.6;
            ctx.fillStyle = `rgba(253, 203, 110, ${alpha})`; // Warm light yellow stars
            ctx.beginPath();
            const px = star.x * this.w;
            const py = star.y * this.h * 0.7; // Keep stars in top 70% of screen
            ctx.arc(px, py, star.size * s, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw cute crescent moon
        const mx = this.w - 50 * s;
        const my = 50 * s;
        ctx.fillStyle = 'rgba(253, 203, 110, 0.85)';
        ctx.shadowColor = 'rgba(253, 203, 110, 0.4)';
        ctx.shadowBlur = 10 * s;
        
        ctx.beginPath();
        ctx.arc(mx, my, 18 * s, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner cutout for crescent shape
        ctx.shadowBlur = 0;
        ctx.fillStyle = this.colors.faceBase;
        ctx.beginPath();
        ctx.arc(mx - 6 * s, my - 3 * s, 18 * s, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    _drawLoveHearts(ctx) {
        ctx.save();
        const s = this.scale;
        ctx.fillStyle = '#ff7675';
        ctx.textAlign = 'center';
        
        for (const h of this.loveHearts) {
            ctx.globalAlpha = h.alpha;
            ctx.save();
            ctx.translate(h.x * this.w, h.y * this.h);
            ctx.rotate(h.rotation);
            
            // Draw heart shape
            ctx.font = `${h.size * s}px serif`;
            ctx.fillText('❤️', 0, 0);
            ctx.restore();
        }
        ctx.restore();
    }

    _drawPong(ctx) {
        ctx.save();
        const s = this.scale;
        const ball = this.pongBall;
        
        // Field center dotted line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 2 * s;
        ctx.setLineDash([6 * s, 6 * s]);
        ctx.beginPath();
        ctx.moveTo(this.w / 2, 0);
        ctx.lineTo(this.w / 2, this.h);
        ctx.stroke();
        
        // Draw Left Paddle (Player)
        ctx.fillStyle = this.colors.eyeColor;
        ctx.shadowColor = this.colors.eyeShadow;
        ctx.shadowBlur = 8 * s;
        const paddleWidth = 8 * s;
        const paddleHeight = 46 * s;
        ctx.fillRect(
            15 * s, 
            (this.pongPaddleL * this.h) - (paddleHeight / 2), 
            paddleWidth, 
            paddleHeight
        );
        
        // Draw Right Paddle (CPU)
        ctx.fillRect(
            this.w - 15 * s - paddleWidth, 
            (this.pongPaddleR * this.h) - (paddleHeight / 2), 
            paddleWidth, 
            paddleHeight
        );
        
        // Draw Ball
        ctx.beginPath();
        ctx.arc(ball.x * this.w, ball.y * this.h, 6 * s, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    _updatePongScoreUI() {
        const scorePlayerEl = document.getElementById('pong-score-player');
        const scoreCpuEl = document.getElementById('pong-score-cpu');
        if (scorePlayerEl) scorePlayerEl.textContent = this.pongScoreL;
        if (scoreCpuEl) scoreCpuEl.textContent = this.pongScoreR;
    }

    _drawDJBars(ctx) {
        ctx.save();
        const s = this.scale;
        const barWidth = 6 * s;
        const maxBarHeight = 70 * s;
        const gap = 4 * s;
        const numBars = 10;
        
        ctx.fillStyle = this.colors.eyeColor;
        ctx.shadowColor = this.colors.eyeShadow;
        ctx.shadowBlur = 6 * s;
        
        // Draw symmetric equalizer bars on left and right sides
        for (let i = 0; i < numBars; i++) {
            const hRatio = this.djBars[i % this.djBars.length];
            const barH = hRatio * maxBarHeight;
            
            // Left Equalizer Group (bottom left)
            const lx = 20 * s + i * (barWidth + gap);
            const ly = this.h - 100 * s;
            ctx.fillRect(lx, ly - barH, barWidth, barH);
            
            // Right Equalizer Group (bottom right)
            const rx = this.w - 20 * s - (numBars - i) * (barWidth + gap);
            ctx.fillRect(rx, ly - barH, barWidth, barH);
        }
        ctx.restore();
    }

    // --- RPS Game Drawing ---
    _drawRPS(ctx) {
        ctx.save();
        const s = this.scale;
        const cx = this.w / 2;
        const cy = this.h / 2;
        
        // Semi-transparent backdrop
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(0, 0, this.w, this.h);
        
        if (this.rpsPhase === 'countdown') {
            // Large countdown number
            const num = this.rpsCountdown;
            const pulse = 1.0 + Math.sin(this.rpsCountdownTimer * Math.PI) * 0.15;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(pulse, pulse);
            ctx.font = `bold ${80 * s}px ${this.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = this.colors.eyeColor;
            ctx.shadowColor = this.colors.eyeShadow;
            ctx.shadowBlur = 20 * s;
            ctx.fillText(num.toString(), 0, 0);
            ctx.restore();
            
            // "Get Ready" label
            ctx.font = `600 ${16 * s}px ${this.fontFamily}`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 0;
            ctx.fillText('GET READY!', cx, cy + 60 * s);
            
            // Round indicator
            ctx.font = `500 ${12 * s}px ${this.fontFamily}`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillText(`Round ${this.rpsRound} of ${this.rpsMaxRounds}`, cx, cy + 82 * s);
        }
        else if (this.rpsPhase === 'show' || this.rpsPhase === 'detect') {
            // "SHOW YOUR HAND!" with pulsing animation
            const pulse = 1.0 + Math.sin(Date.now() * 0.008) * 0.08;
            ctx.save();
            ctx.translate(cx, cy - 20 * s);
            ctx.scale(pulse, pulse);
            ctx.font = `bold ${28 * s}px ${this.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffd93d';
            ctx.shadowColor = 'rgba(255, 217, 61, 0.5)';
            ctx.shadowBlur = 15 * s;
            ctx.fillText('SHOW YOUR HAND!', 0, 0);
            ctx.restore();
            
            // Scanning indicator
            if (this.rpsPhase === 'detect') {
                ctx.font = `500 ${14 * s}px ${this.fontFamily}`;
                ctx.fillStyle = 'rgba(0, 162, 255, 0.8)';
                ctx.shadowBlur = 0;
                ctx.textAlign = 'center';
                const dots = '.'.repeat(Math.floor(Date.now() / 400) % 4);
                ctx.fillText(`Detecting${dots}`, cx, cy + 30 * s);
            }
        }
        else if (this.rpsPhase === 'result') {
            // Show both choices and result
            const emojiSize = 60 * s;
            
            // Player choice (left)
            ctx.font = `${emojiSize}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 0;
            const playerEmoji = this.rpsPlayerChoice ? this.rpsEmojis[this.rpsPlayerChoice] : '\u2753';
            ctx.fillText(playerEmoji, cx - 80 * s, cy - 10 * s);
            
            // VS text
            ctx.font = `bold ${18 * s}px ${this.fontFamily}`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fillText('VS', cx, cy - 10 * s);
            
            // CPU choice (right)
            ctx.font = `${emojiSize}px serif`;
            const cpuEmoji = this.rpsCpuChoice ? this.rpsEmojis[this.rpsCpuChoice] : '\u2753';
            ctx.fillText(cpuEmoji, cx + 80 * s, cy - 10 * s);
            
            // Result text
            ctx.font = `bold ${24 * s}px ${this.fontFamily}`;
            ctx.textAlign = 'center';
            let resultText = '';
            let resultColor = '';
            if (this.rpsResult === 'win') {
                resultText = '\uD83C\uDF89 YOU WIN!';
                resultColor = '#00b894';
            } else if (this.rpsResult === 'lose') {
                resultText = '\uD83D\uDE22 YOU LOSE!';
                resultColor = '#ff6b6b';
            } else {
                resultText = '\uD83E\uDD1D DRAW!';
                resultColor = '#ffd93d';
            }
            ctx.fillStyle = resultColor;
            ctx.shadowColor = resultColor;
            ctx.shadowBlur = 12 * s;
            ctx.fillText(resultText, cx, cy + 50 * s);
            
            // Labels
            ctx.shadowBlur = 0;
            ctx.font = `500 ${11 * s}px ${this.fontFamily}`;
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText('YOU', cx - 80 * s, cy + 30 * s);
            ctx.fillText('LIK', cx + 80 * s, cy + 30 * s);
        }
        else if (this.rpsPhase === 'gameover') {
            // Final result
            let finalText = '';
            let finalColor = '';
            let finalEmoji = '';
            if (this.rpsScorePlayer > this.rpsScoreCpu) {
                finalText = 'YOU WIN THE GAME!';
                finalColor = '#00b894';
                finalEmoji = '\uD83C\uDFC6';
            } else if (this.rpsScorePlayer < this.rpsScoreCpu) {
                finalText = 'LIK WINS THE GAME!';
                finalColor = '#ff6b6b';
                finalEmoji = '\uD83E\uDD16';
            } else {
                finalText = "IT'S A TIE!";
                finalColor = '#ffd93d';
                finalEmoji = '\uD83E\uDD1D';
            }
            
            ctx.font = `${70 * s}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(finalEmoji, cx, cy - 30 * s);
            
            ctx.font = `bold ${22 * s}px ${this.fontFamily}`;
            ctx.fillStyle = finalColor;
            ctx.shadowColor = finalColor;
            ctx.shadowBlur = 15 * s;
            ctx.fillText(finalText, cx, cy + 30 * s);
            
            ctx.shadowBlur = 0;
            ctx.font = `600 ${16 * s}px ${this.fontFamily}`;
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillText(`${this.rpsScorePlayer} - ${this.rpsScoreCpu}`, cx, cy + 58 * s);
        }
        
        ctx.restore();
    }

    _updateRPSScoreUI() {
        const sp = document.getElementById('rps-score-player');
        const sc = document.getElementById('rps-score-cpu');
        if (sp) sp.textContent = this.rpsScorePlayer;
        if (sc) sc.textContent = this.rpsScoreCpu;
    }
    
    _updateRPSEmojiUI() {
        const pe = document.getElementById('rps-player-emoji');
        const ce = document.getElementById('rps-cpu-emoji');
        if (pe && this.rpsPlayerChoice) pe.textContent = this.rpsEmojis[this.rpsPlayerChoice];
        if (ce && this.rpsCpuChoice) ce.textContent = this.rpsEmojis[this.rpsCpuChoice];
    }
    
    _updateRPSRoundUI() {
        const rl = document.getElementById('rps-round-label');
        if (rl) rl.textContent = `Round ${this.rpsRound}/${this.rpsMaxRounds}`;
    }
}
