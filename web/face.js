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
        
        // Colors (Replicating the real LOOI robot's giant yellow/gold ovals and deep orange shadow)
        this.colors = {
            eyeColor: '#ffd000',       // Glowing warm yellow
            eyeShadow: '#ff6600',      // Offset deep orange shadow
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
        
        // Restore head tilt transform
        if (Math.abs(totalRotation) > 0.001) {
            ctx.restore();
        }

        // Draw active command label
        if (this.commandLabel && Date.now() < this.commandLabelExpiry) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 208, 0, 0.95)'; // Signature gold/yellow
            ctx.font = `bold ${18 * s}px ${getComputedStyle(document.body).fontFamily || 'sans-serif'}`;
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(255, 102, 0, 0.6)';
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
        ctx.shadowColor = 'rgba(253, 203, 110, 0.8)'; // Yellow accent
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
}
