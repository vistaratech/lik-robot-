/**
 * VILY Face Engine
 * Animated robot face with expressions, blinking, and mood system
 * Inspired by LOOI's biomimetic face display
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
        
        // Colors (Replicating the real LOOI robot's giant cyan ovals and dark shadow)
        this.colors = {
            eyeColor: '#00f0ff',       // Glowing cyan
            eyeShadow: '#0022ff',      // Offset royal blue outline shadow
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
    
    // ─── Mood System ───
    
    setMood(mood, lockDuration = 0) {
        if (this.mood !== mood) {
            if (typeof soundEngine !== 'undefined') {
                soundEngine.playMoodSound(mood);
            }
        }
        this.targetMood = mood;
        this.moodTransition = 0;
        
        if (lockDuration > 0) {
            this.moodLockedUntil = Date.now() + lockDuration;
        }
        
        const moodConfigs = {
            happy:   { smile: 0.6, eyeOpen: 1.0, blush: 0, pupilY: 0 },
            curious: { smile: 0.2, eyeOpen: 1.2, blush: 0, pupilY: -0.1 },
            sleepy:  { smile: 0.1, eyeOpen: 0.35, blush: 0, pupilY: 0.2 },
            excited: { smile: 0.9, eyeOpen: 1.1, blush: 0.4, pupilY: 0 },
            sad:     { smile: -0.4, eyeOpen: 0.7, blush: 0, pupilY: 0.15 },
            shy:     { smile: 0.3, eyeOpen: 0.6, blush: 0.7, pupilY: 0.1 },
            love:    { smile: 0.7, eyeOpen: 0.85, blush: 0.6, pupilY: 0 },
            angry:   { smile: -0.3, eyeOpen: 0.8, blush: 0, pupilY: -0.05 },
            surprised: { smile: 0.1, eyeOpen: 1.3, blush: 0.2, pupilY: 0 },
            thinking: { smile: 0.2, eyeOpen: 0.85, blush: 0.15, pupilY: 0 },
            focused: { smile: 0.15, eyeOpen: 0.8, blush: 0, pupilY: 0.05 },
            confused: { smile: -0.1, eyeOpen: 0.9, blush: 0.1, pupilY: -0.05 },
            eureka: { smile: 0.95, eyeOpen: 1.25, blush: 0.45, pupilY: -0.1 }
        };
        
        const config = moodConfigs[mood] || moodConfigs.happy;
        this._targetSmile = config.smile;
        this._targetEyeOpen = config.eyeOpen;
        this._targetBlush = config.blush;
        this._targetPupilYBias = config.pupilY;
        
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
        
        // Random mood changes
        setInterval(() => {
            if (this.isSpeaking) return;
            if (Date.now() < this.moodLockedUntil) return;
            if (window.app && window.app.currentPage !== 'home') return;
            
            const moods = ['happy', 'curious', 'happy', 'excited', 'happy', 'love', 'happy', 'shy'];
            const rand = moods[Math.floor(Math.random() * moods.length)];
            this.setMood(rand);
        }, 8000 + Math.random() * 6000);
        
        // Occasional bounce
        setInterval(() => {
            if (this.mood === 'excited' || this.mood === 'happy') {
                this.bounceVel = -3;
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
    
    // ─── Update Logic ───
    
    update(dt) {
        // Smooth interpolation
        const lerp = (a, b, t) => a + (b - a) * Math.min(t, 1);
        const speed = dt * 4;
        
        // Thinking animation (rapid pupil scanning)
        if (this.mood === 'thinking') {
            this.thinkingTimer += dt;
            this.targetPupilX = Math.sin(this.thinkingTimer * 6) * 0.55;
            this.targetPupilY = Math.cos(this.thinkingTimer * 3) * 0.12;
        } else {
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
        this.eyeOpenL = lerp(this.eyeOpenL, this._targetEyeOpen || 1, speed);
        this.eyeOpenR = lerp(this.eyeOpenR, this._targetEyeOpen || 1, speed);
        this.blushOpacity = lerp(this.blushOpacity, this._targetBlush || 0, speed * 0.5);
        
        // Pupil tracking
        this.pupilX = lerp(this.pupilX, this.targetPupilX, speed * 1.5);
        this.pupilY = lerp(this.pupilY, this.targetPupilY + (this._targetPupilYBias || 0), speed * 1.5);
        
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
            }
        }
        
        // Bounce physics
        this.bounceVel += 12 * dt;  // gravity
        this.bounceY += this.bounceVel;
        if (this.bounceY >= 0) {
            this.bounceY = 0;
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
        const cx = this.cx;
        const cy = this.cy + breathOffset + this.bounceY * s;
        

        
        // Clear background with pure black to merge with the phone screen bezel
        ctx.fillStyle = this.colors.faceBase;
        ctx.fillRect(0, 0, this.w, this.h);
        
        // ── Eye parameters (scaled up to match LOOI's massive circles) ──
        const eyeSpacing = 82 * s;
        const eyeWidth = 65 * s;
        const eyeHeight = 65 * s;
        const eyeY = cy; // Center vertically on the screen
        
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
    }
    
    drawEye(x, y, w, h, openAmount, isRight) {
        const ctx = this.ctx;
        const s = this.scale;
        const clampedOpen = Math.max(0.02, Math.min(1.3, openAmount + (this.speakingOffset || 0)));
        const actualH = h * clampedOpen;
        
        // LOOI eyes shift their entire position to look around
        const lookX = this.pupilX * w * 0.45;
        const lookY = this.pupilY * h * 0.35;
        

        
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
                // Heart shape
                const size = w * 1.3;
                const cy = oy - size * 0.25;
                ctx.moveTo(ox, cy + size * 0.3);
                ctx.bezierCurveTo(ox - size * 0.5, cy - size * 0.55, ox - size * 1.1, cy + size * 0.2, ox, cy + size * 1.05);
                ctx.bezierCurveTo(ox + size * 1.1, cy + size * 0.2, ox + size * 0.5, cy - size * 0.55, ox, cy + size * 0.3);
                ctx.fill();
            } else {
                // Ellipse shape (standard LOOI eyes) with robust arc fallback for circles
                const radiusX = Math.max(0.1, w);
                const radiusY = Math.max(0.1, actualH);
                if (Math.abs(radiusX - radiusY) < 0.01) {
                    ctx.arc(ox, oy, radiusX, 0, Math.PI * 2);
                } else {
                    ctx.ellipse(ox, oy, radiusX, radiusY, 0, 0, Math.PI * 2);
                }
                ctx.fill();
                
                // Flat angled cover-ups for Angry and Sad expressions
                if (this.mood === 'angry') {
                    ctx.fillStyle = this.colors.faceBase;
                    ctx.beginPath();
                    if (isRight) {
                        ctx.moveTo(ox - w * 1.3, oy - actualH * 1.5);
                        ctx.lineTo(ox - w * 1.3, oy - actualH * 0.1);
                        ctx.lineTo(ox + w * 1.3, oy - actualH * 0.75);
                        ctx.lineTo(ox + w * 1.3, oy - actualH * 1.5);
                    } else {
                        ctx.moveTo(ox - w * 1.3, oy - actualH * 1.5);
                        ctx.lineTo(ox - w * 1.3, oy - actualH * 0.75);
                        ctx.lineTo(ox + w * 1.3, oy - actualH * 0.1);
                        ctx.lineTo(ox + w * 1.3, oy - actualH * 1.5);
                    }
                    ctx.closePath();
                    ctx.fill();
                } else if (this.mood === 'sad') {
                    ctx.fillStyle = this.colors.faceBase;
                    ctx.beginPath();
                    if (isRight) {
                        ctx.moveTo(ox - w * 1.3, oy - actualH * 1.5);
                        ctx.lineTo(ox - w * 1.3, oy - actualH * 0.7);
                        ctx.lineTo(ox + w * 1.3, oy - actualH * 0.15);
                        ctx.lineTo(ox + w * 1.3, oy - actualH * 1.5);
                    } else {
                        ctx.moveTo(ox - w * 1.3, oy - actualH * 1.5);
                        ctx.lineTo(ox - w * 1.3, oy - actualH * 0.15);
                        ctx.lineTo(ox + w * 1.3, oy - actualH * 0.7);
                        ctx.lineTo(ox + w * 1.3, oy - actualH * 1.5);
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
        drawSingleShape(x + lookX + shadowDX, y + lookY + shadowDY, this.colors.eyeShadow, true);
        
        // 2. Draw main cyan eye shape
        drawSingleShape(x + lookX, y + lookY, this.colors.eyeColor, false);
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
}
