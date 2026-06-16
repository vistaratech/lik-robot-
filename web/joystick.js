/**
 * ═══════════════════════════════════════════════
 *  LIK Virtual Slider (Lever / Dial)
 *  Tactile canvas-based RC car sliders
 * ═══════════════════════════════════════════════
 */

class VirtualSlider {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.type = options.type || 'vertical'; // 'vertical' or 'horizontal'
        this.onMove = options.onMove || null;
        this.onRelease = options.onRelease || null;
        this.deadZone = options.deadZone || 0.08;
        
        this.active = false;
        this.touchId = null;
        this.value = 0; // -1 to 1
        this.displayValue = 0; // for LERP animation
        
        this.colors = {
            bg: 'rgba(255, 255, 255, 0.015)',
            border: 'rgba(255, 255, 255, 0.04)',
            groove: 'rgba(255, 255, 255, 0.08)',
            activeGroove: 'rgba(0, 240, 255, 0.25)',
            handleFill: 'rgba(0, 240, 255, 0.85)',
            handleBorder: 'rgba(0, 240, 255, 1)',
            handleInactive: 'rgba(255, 255, 255, 0.12)',
            text: 'rgba(255, 255, 255, 0.2)'
        };
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.bindEvents();
        this.animate();
    }
    
    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        this.w = rect.width;
        this.h = rect.height;
        this.cx = this.w / 2;
        this.cy = this.h / 2;
        
        if (this.type === 'vertical') {
            this.maxDistance = this.h * 0.38;
            this.handleRadius = this.w * 0.32;
        } else {
            this.maxDistance = this.w * 0.38;
            this.handleRadius = this.h * 0.32;
        }
        
        this.displayValue = 0;
    }
    
    bindEvents() {
        this.canvas.addEventListener('touchstart', (e) => this.handleStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleEnd(e), { passive: false });
        
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
        
        window.addEventListener('resize', () => this.setupCanvas());
    }
    
    handleStart(e) {
        e.preventDefault();
        if (this.active) return;
        const touch = e.changedTouches[0];
        this.touchId = touch.identifier;
        this.active = true;
        this.updatePosition(touch.clientX, touch.clientY);
    }
    
    handleMove(e) {
        e.preventDefault();
        if (!this.active) return;
        for (const touch of e.changedTouches) {
            if (touch.identifier === this.touchId) {
                this.updatePosition(touch.clientX, touch.clientY);
                break;
            }
        }
    }
    
    handleEnd(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            if (touch.identifier === this.touchId) {
                this.release();
                break;
            }
        }
    }
    
    handleMouseDown(e) {
        this.active = true;
        this.updatePosition(e.clientX, e.clientY);
    }
    
    handleMouseMove(e) {
        if (!this.active) return;
        this.updatePosition(e.clientX, e.clientY);
    }
    
    handleMouseUp(e) {
        if (!this.active) return;
        this.release();
    }
    
    updatePosition(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        let rawVal = 0;
        if (this.type === 'vertical') {
            const dy = y - this.cy;
            rawVal = -dy / this.maxDistance; // Up is positive
        } else {
            const dx = x - this.cx;
            rawVal = dx / this.maxDistance; // Right is positive
        }
        
        // Clamp between -1 and 1
        this.value = Math.max(-1, Math.min(1, rawVal));
        
        // Apply dead zone
        if (Math.abs(this.value) < this.deadZone) {
            this.value = 0;
        }
        
        this.displayValue = this.value;
        
        if (this.onMove) {
            this.onMove(this.value);
        }
    }
    
    release() {
        this.active = false;
        this.touchId = null;
        this.value = 0;
        
        if (this.onRelease) {
            this.onRelease();
        }
    }
    
    animate() {
        if (!this.active) {
            this.displayValue += (0 - this.displayValue) * 0.22;
        }
        
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
    
    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.w, this.h);
        
        // Outer panel box
        ctx.fillStyle = this.colors.bg;
        ctx.strokeStyle = this.colors.border;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(0, 0, this.w, this.h, 12);
        ctx.fill();
        ctx.stroke();
        
        // ── Groove Track ──
        ctx.strokeStyle = this.colors.groove;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (this.type === 'vertical') {
            ctx.moveTo(this.cx, this.cy - this.maxDistance);
            ctx.lineTo(this.cx, this.cy + this.maxDistance);
        } else {
            ctx.moveTo(this.cx - this.maxDistance, this.cy);
            ctx.lineTo(this.cx + this.maxDistance, this.cy);
        }
        ctx.stroke();
        
        // ── Calibration Ticks (Vertical Trigger Lever look) ──
        if (this.type === 'vertical') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1.5;
            for (let offset = -this.maxDistance; offset <= this.maxDistance; offset += this.maxDistance / 4) {
                ctx.beginPath();
                ctx.moveTo(this.cx - 15, this.cy + offset);
                ctx.lineTo(this.cx - 6, this.cy + offset);
                ctx.moveTo(this.cx + 6, this.cy + offset);
                ctx.lineTo(this.cx + 15, this.cy + offset);
                ctx.stroke();
            }
        }
        
        // ── Active Track Highlight ──
        if (Math.abs(this.displayValue) > 0.01) {
            ctx.strokeStyle = this.colors.activeGroove;
            ctx.lineWidth = 6;
            ctx.beginPath();
            if (this.type === 'vertical') {
                ctx.moveTo(this.cx, this.cy);
                ctx.lineTo(this.cx, this.cy - this.displayValue * this.maxDistance);
            } else {
                ctx.moveTo(this.cx, this.cy);
                ctx.lineTo(this.cx + this.displayValue * this.maxDistance, this.cy);
            }
            ctx.stroke();
        }
        
        // ── Handle Position ──
        let hx = this.cx;
        let hy = this.cy;
        if (this.type === 'vertical') {
            hy = this.cy - this.displayValue * this.maxDistance;
        } else {
            hx = this.cx + this.displayValue * this.maxDistance;
        }
        
        // Handle Glow
        if (this.active) {
            ctx.shadowColor = 'rgba(0, 240, 255, 0.6)';
            ctx.shadowBlur = 15;
        }
        
        // Draw Handle
        ctx.fillStyle = this.active ? this.colors.handleFill : this.colors.handleInactive;
        ctx.strokeStyle = this.active ? this.colors.handleBorder : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2.5;
        
        ctx.beginPath();
        if (this.type === 'vertical') {
            // Pill shape for vertical lever
            ctx.roundRect(hx - this.handleRadius, hy - 12, this.handleRadius * 2, 24, 6);
        } else {
            // Pill shape for horizontal lever
            ctx.roundRect(hx - 24, hy - this.handleRadius, 48, this.handleRadius * 2, 6);
        }
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
        ctx.stroke();
        
        // Central line indicator on handle
        ctx.strokeStyle = this.active ? '#ffffff' : 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (this.type === 'vertical') {
            ctx.moveTo(hx - this.handleRadius * 0.5, hy);
            ctx.lineTo(hx + this.handleRadius * 0.5, hy);
        } else {
            ctx.moveTo(hx, hy - this.handleRadius * 0.5);
            ctx.lineTo(hx, hy + this.handleRadius * 0.5);
        }
        ctx.stroke();
    }
}

/**
 * ═══════════════════════════════════════════════
 *  LIK Steering Wheel Control (Axial RC Style)
 *  Rotatable canvas-based steering wheel control
 * ═══════════════════════════════════════════════
 */
class SteeringWheel {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.onMove = options.onMove || null;
        this.onRelease = options.onRelease || null;
        this.maxRotation = options.maxRotation || 2.09; // ~120 degrees
        
        this.active = false;
        this.touchId = null;
        this.value = 0; // -1 to 1 (left negative, right positive)
        this.displayValue = 0; // for LERP animation
        
        this.wheelAngle = 0;
        this.startAngle = 0;
        this.startWheelAngle = 0;
        
        this.colors = {
            bg: 'rgba(255, 255, 255, 0.015)',
            border: 'rgba(255, 255, 255, 0.04)',
            glow: 'rgba(0, 240, 255, 0.6)'
        };
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.bindEvents();
        this.animate();
    }
    
    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        this.w = rect.width;
        this.h = rect.height;
        this.cx = this.w / 2;
        this.cy = this.h / 2;
        
        this.displayValue = 0;
        this.wheelAngle = 0;
    }
    
    bindEvents() {
        this.canvas.addEventListener('touchstart', (e) => this.handleStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleEnd(e), { passive: false });
        
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
        
        window.addEventListener('resize', () => this.setupCanvas());
    }
    
    handleStart(e) {
        e.preventDefault();
        if (this.active) return;
        const touch = e.changedTouches[0];
        this.touchId = touch.identifier;
        this.active = true;
        
        const rect = this.canvas.getBoundingClientRect();
        const tx = touch.clientX - rect.left;
        const ty = touch.clientY - rect.top;
        
        this.startAngle = Math.atan2(ty - this.cy, tx - this.cx);
        this.startWheelAngle = this.wheelAngle;
    }
    
    handleMove(e) {
        e.preventDefault();
        if (!this.active) return;
        for (const touch of e.changedTouches) {
            if (touch.identifier === this.touchId) {
                this.updateRotation(touch.clientX, touch.clientY);
                break;
            }
        }
    }
    
    handleEnd(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            if (touch.identifier === this.touchId) {
                this.release();
                break;
            }
        }
    }
    
    handleMouseDown(e) {
        this.active = true;
        const rect = this.canvas.getBoundingClientRect();
        const tx = e.clientX - rect.left;
        const ty = e.clientY - rect.top;
        
        this.startAngle = Math.atan2(ty - this.cy, tx - this.cx);
        this.startWheelAngle = this.wheelAngle;
    }
    
    handleMouseMove(e) {
        if (!this.active) return;
        this.updateRotation(e.clientX, e.clientY);
    }
    
    handleMouseUp(e) {
        if (!this.active) return;
        this.release();
    }
    
    updateRotation(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const tx = clientX - rect.left;
        const ty = clientY - rect.top;
        
        const currentAngle = Math.atan2(ty - this.cy, tx - this.cx);
        let delta = currentAngle - this.startAngle;
        
        if (delta < -Math.PI) delta += 2 * Math.PI;
        if (delta > Math.PI) delta -= 2 * Math.PI;
        
        this.wheelAngle = this.startWheelAngle + delta;
        this.wheelAngle = Math.max(-this.maxRotation, Math.min(this.maxRotation, this.wheelAngle));
        
        this.value = this.wheelAngle / this.maxRotation;
        this.displayValue = this.value;
        
        if (this.onMove) {
            this.onMove(this.value);
        }
    }
    
    release() {
        this.active = false;
        this.touchId = null;
        this.value = 0;
        
        if (this.onRelease) {
            this.onRelease();
        }
    }
    
    animate() {
        if (!this.active) {
            this.displayValue += (0 - this.displayValue) * 0.22;
            this.wheelAngle = this.displayValue * this.maxRotation;
        }
        
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
    
    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.w, this.h);
        
        // Outer panel box
        ctx.fillStyle = this.colors.bg;
        ctx.strokeStyle = this.colors.border;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(0, 0, this.w, this.h, 12);
        ctx.fill();
        ctx.stroke();
        
        // Save state for rotation
        ctx.save();
        ctx.translate(this.cx, this.cy);
        
        const currentRotation = this.displayValue * this.maxRotation;
        ctx.rotate(currentRotation);
        
        // Outer Rim Glow
        if (this.active) {
            ctx.shadowColor = this.colors.glow;
            ctx.shadowBlur = 15;
        }
        
        // Outer Rim
        const rimRadius = this.w * 0.40;
        ctx.strokeStyle = this.active ? 'rgba(0, 240, 255, 0.85)' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(0, 0, rimRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset
        
        // Left & Right Grips (thicker arcs)
        ctx.strokeStyle = this.active ? 'rgba(0, 240, 255, 1)' : 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(0, 0, rimRadius, Math.PI * 0.85, Math.PI * 1.15);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(0, 0, rimRadius, -Math.PI * 0.15, Math.PI * 0.15);
        ctx.stroke();
        
        // Top Center Marker
        ctx.fillStyle = this.active ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.rect(-5, -rimRadius - 7, 10, 14);
        ctx.fill();
        
        // Spokes (3-spoke design)
        ctx.strokeStyle = this.active ? 'rgba(0, 240, 255, 0.5)' : 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 6;
        
        // Left
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-rimRadius + 5, 0);
        ctx.stroke();
        
        // Right
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(rimRadius - 5, 0);
        ctx.stroke();
        
        // Bottom
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, rimRadius - 5);
        ctx.stroke();
        
        // Center Hub
        const hubRadius = this.w * 0.15;
        ctx.fillStyle = this.active ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)';
        ctx.strokeStyle = this.active ? 'rgba(0, 240, 255, 0.7)' : 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, hubRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // V logo in the center hub
        ctx.strokeStyle = this.active ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-5, -3);
        ctx.lineTo(0, 3);
        ctx.lineTo(5, -3);
        ctx.stroke();
        
        ctx.restore();
        
        // Surround HUD details (static)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, this.w * 0.47, 0, Math.PI * 2);
        ctx.stroke();
        
        // Tick marks around the wheel housing
        ctx.strokeStyle = this.active ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1.5;
        const tickCount = 16;
        for (let i = 0; i < tickCount; i++) {
            const angle = (i / tickCount) * Math.PI * 2;
            if (angle > Math.PI * 0.35 && angle < Math.PI * 0.65) continue; 
            
            const x1 = this.cx + Math.cos(angle) * (this.w * 0.44);
            const y1 = this.cy + Math.sin(angle) * (this.w * 0.44);
            const x2 = this.cx + Math.cos(angle) * (this.w * 0.47);
            const y2 = this.cy + Math.sin(angle) * (this.w * 0.47);
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }
}
