/**
 * ═══════════════════════════════════════════════
 *  VILY Game Center Engines
 *  Includes VILY Pong & Simon Says
 *  Integrated with Sound Engine & BLE Actions
 * ═══════════════════════════════════════════════
 */

// ─────────────────────────────────────────────
//  1. VILY Pong Game
// ─────────────────────────────────────────────
class VILYPongGame {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.onGameOver = options.onGameOver || null;
        this.onScore = options.onScore || null;
        
        // Game parameters
        this.isPlaying = false;
        this.gameMode = 'ai'; // 'ai' or 'pvp'
        this.p1Score = 0;
        this.p2Score = 0;
        this.maxScore = 5;
        
        // Dimensions (responsive)
        this.width = 400;
        this.height = 250;
        this.setupCanvas();
        
        // Paddles
        this.paddleW = 8;
        this.paddleH = 50;
        this.p1Y = this.height / 2 - this.paddleH / 2;
        this.p2Y = this.height / 2 - this.paddleH / 2;
        this.paddleSpeed = 4;
        
        // Ball
        this.ballSize = 6;
        this.resetBall();
        
        // Controls (touch/mouse)
        this.mouseY = this.height / 2;
        this.p2Keys = { up: false, down: false };
        
        this.bindEvents();
    }
    
    setupCanvas() {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }
    
    bindEvents() {
        // Track mouse/touch inside the canvas
        const handleMove = (clientY) => {
            const rect = this.canvas.getBoundingClientRect();
            const relativeY = clientY - rect.top;
            // Map relative Y to canvas units
            this.mouseY = (relativeY / rect.height) * this.height;
        };
        
        this.canvas.addEventListener('mousemove', (e) => handleMove(e.clientY));
        
        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                handleMove(e.touches[0].clientY);
                e.preventDefault();
            }
        }, { passive: false });
        
        // Keyboard controls for PVP mode
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') this.p2Keys.up = true;
            if (e.key === 'ArrowDown') this.p2Keys.down = true;
        });
        
        window.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowUp') this.p2Keys.up = false;
            if (e.key === 'ArrowDown') this.p2Keys.down = false;
        });
    }
    
    resetBall() {
        this.ballX = this.width / 2;
        this.ballY = this.height / 2;
        // Random starting angle, speed 3
        const angle = (Math.random() * 0.4 + 0.1) * (Math.random() > 0.5 ? 1 : -1) * Math.PI;
        const speed = 3.5;
        this.ballVX = Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1);
        this.ballVY = Math.sin(angle) * speed;
    }
    
    start(mode = 'ai') {
        this.gameMode = mode;
        this.p1Score = 0;
        this.p2Score = 0;
        this.isPlaying = true;
        this.resetBall();
        this.loop();
        
        if (typeof soundEngine !== 'undefined') {
            soundEngine.speak("Game start! Drive to win!");
        }
    }
    
    stop() {
        this.isPlaying = false;
    }
    
    loop() {
        if (!this.isPlaying) return;
        
        this.update();
        this.draw();
        
        requestAnimationFrame(() => this.loop());
    }
    
    update() {
        // 1. Move Player 1 Paddle (follows Mouse/Touch smoothly)
        const targetP1Y = this.mouseY - this.paddleH / 2;
        this.p1Y += (targetP1Y - this.p1Y) * 0.2;
        this.p1Y = Math.max(0, Math.min(this.height - this.paddleH, this.p1Y));
        
        // 2. Move Player 2 Paddle (AI or Keyboard)
        if (this.gameMode === 'ai') {
            // AI follows ball with a delay and speed limit
            const aiCenter = this.p2Y + this.paddleH / 2;
            const ballCenter = this.ballY;
            if (Math.abs(aiCenter - ballCenter) > 8) {
                if (aiCenter < ballCenter) {
                    this.p2Y += this.paddleSpeed * 0.8;
                } else {
                    this.p2Y -= this.paddleSpeed * 0.8;
                }
            }
        } else {
            // PVP keys
            if (this.p2Keys.up) this.p2Y -= this.paddleSpeed;
            if (this.p2Keys.down) this.p2Y += this.paddleSpeed;
        }
        this.p2Y = Math.max(0, Math.min(this.height - this.paddleH, this.p2Y));
        
        // 3. Move Ball
        this.ballX += this.ballVX;
        this.ballY += this.ballVY;
        
        // 4. Wall collisions (Top/Bottom)
        if (this.ballY <= 0 || this.ballY >= this.height - this.ballSize) {
            this.ballVY = -this.ballVY;
            if (typeof soundEngine !== 'undefined') {
                soundEngine.playBeep(330, 60, 'sine', 0.05); // Tick beep
            }
        }
        
        // 5. Paddle 1 collision (Left)
        if (this.ballVX < 0 && this.ballX <= this.paddleW + 10) {
            if (this.ballY + this.ballSize >= this.p1Y && this.ballY <= this.p1Y + this.paddleH) {
                // Bounce and speed up slightly
                this.ballVX = -this.ballVX * 1.05;
                // Add angle offset depending on where it hit paddle
                const relativeHit = (this.ballY + this.ballSize/2) - (this.p1Y + this.paddleH/2);
                this.ballVY += relativeHit * 0.08;
                
                if (typeof soundEngine !== 'undefined') {
                    soundEngine.playBeep(440, 100, 'sine', 0.08); // Good bounce
                }
                
                // Physical robot feedback (Green LED blink if connected)
                if (typeof ble !== 'undefined' && ble.connected) {
                    ble.setLED(0, 255, 0);
                    setTimeout(() => ble.ledOff(), 100);
                }
            }
        }
        
        // 6. Paddle 2 collision (Right)
        if (this.ballVX > 0 && this.ballX >= this.width - this.paddleW - 10 - this.ballSize) {
            if (this.ballY + this.ballSize >= this.p2Y && this.ballY <= this.p2Y + this.paddleH) {
                this.ballVX = -this.ballVX * 1.05;
                const relativeHit = (this.ballY + this.ballSize/2) - (this.p2Y + this.paddleH/2);
                this.ballVY += relativeHit * 0.08;
                
                if (typeof soundEngine !== 'undefined') {
                    soundEngine.playBeep(440, 100, 'sine', 0.08);
                }
            }
        }
        
        // 7. Scoring
        if (this.ballX < 0) {
            // Player 2 scores
            this.p2Score++;
            this.triggerScoreEvent('p2');
            this.checkWinner();
        } else if (this.ballX > this.width) {
            // Player 1 scores
            this.p1Score++;
            this.triggerScoreEvent('p1');
            this.checkWinner();
        }
    }
    
    triggerScoreEvent(scorer) {
        if (typeof soundEngine !== 'undefined') {
            if (scorer === 'p1') {
                soundEngine.playBeep(600, 150, 'sine', 0.1, 900); // High positive
            } else {
                soundEngine.playBeep(250, 250, 'sawtooth', 0.08, 150); // Low negative
            }
        }
        
        // Send BLE physical triggers to robot
        if (typeof ble !== 'undefined' && ble.connected) {
            if (scorer === 'p1') {
                ble.playAnimation(0x02); // NOD (robot is happy for you or acknowledges score)
                ble.setLED(0, 255, 0);   // Green
            } else {
                ble.playAnimation(0x01); // SHAKE (robot says oops or AI celebrates)
                ble.setLED(255, 0, 0);   // Red
            }
            setTimeout(() => ble.ledOff(), 500);
        }
        
        // Face mood trigger
        if (typeof app !== 'undefined' && app.face) {
            app.face.setMood(scorer === 'p1' ? 'excited' : 'sad');
            setTimeout(() => app.face.setMood('happy'), 2000);
        }
        
        if (this.onScore) this.onScore(this.p1Score, this.p2Score);
        this.resetBall();
    }
    
    checkWinner() {
        if (this.p1Score >= this.maxScore || this.p2Score >= this.maxScore) {
            this.isPlaying = false;
            const winner = this.p1Score >= this.maxScore ? 'Player 1' : (this.gameMode === 'ai' ? 'VILY' : 'Player 2');
            
            if (typeof soundEngine !== 'undefined') {
                if (winner === 'Player 1') {
                    soundEngine.speak("Congratulations! You won!");
                } else {
                    soundEngine.speak("Hooray! I won this round!");
                }
            }
            
            if (typeof ble !== 'undefined' && ble.connected) {
                if (winner === 'Player 1') {
                    ble.playAnimation(0x03); // DANCE (celebrating player)
                } else {
                    ble.playAnimation(0x04); // EXCITED (AI celebrates itself)
                }
            }
            
            if (this.onGameOver) this.onGameOver(winner);
        }
    }
    
    draw() {
        const ctx = this.ctx;
        
        // Clear background
        ctx.fillStyle = '#12122a';
        ctx.fillRect(0, 0, this.width, this.height);
        
        // Midfield net line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 8]);
        ctx.beginPath();
        ctx.moveTo(this.width / 2, 0);
        ctx.lineTo(this.width / 2, this.height);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw paddles (Neon glow)
        // Player 1 (Cyan)
        ctx.shadowColor = '#4facfe';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#4facfe';
        ctx.fillRect(10, this.p1Y, this.paddleW, this.paddleH);
        
        // Player 2 (Purple/Pink)
        ctx.shadowColor = '#f77fbe';
        ctx.fillStyle = this.gameMode === 'ai' ? '#7c5cfc' : '#f77fbe';
        ctx.fillRect(this.width - 10 - this.paddleW, this.p2Y, this.paddleW, this.paddleH);
        
        // Draw Ball (White/Cyan neon)
        ctx.shadowColor = '#00f2fe';
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.ballX + this.ballSize/2, this.ballY + this.ballSize/2, this.ballSize/2, 0, Math.PI * 2);
        ctx.fill();
        
        // Reset shadow
        ctx.shadowBlur = 0;
        
        // Draw Scores
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = 'bold 24px Quicksand, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.p1Score, this.width / 4, 35);
        ctx.fillText(this.p2Score, (this.width / 4) * 3, 35);
    }
}

// ─────────────────────────────────────────────
//  2. Simon Says Memory Game
// ─────────────────────────────────────────────
class SimonSaysGame {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.onGameOver = options.onGameOver || null;
        this.onLevelUp = options.onLevelUp || null;
        
        // State
        this.sequence = [];
        this.userSequence = [];
        this.level = 0;
        this.isPlayingSequence = false;
        this.acceptInput = false;
        
        // Color mapping
        this.colors = ['red', 'green', 'blue', 'yellow'];
        this.colorData = {
            red:    { name: 'Red',    hex: '#ff6b6b', freq: 261, bleRGB: [255, 0, 0] },
            green:  { name: 'Green',  hex: '#43e97b', freq: 329, bleRGB: [0, 255, 0] },
            blue:   { name: 'Blue',   hex: '#4facfe', freq: 392, bleRGB: [0, 0, 255] },
            yellow: { name: 'Yellow', hex: '#ffe066', freq: 440, bleRGB: [255, 255, 0] }
        };
        
        this.setupUI();
    }
    
    setupUI() {
        this.container.innerHTML = `
            <div class="simon-game-wrap">
                <div class="simon-score-bar">LEVEL <span id="simon-level-val">1</span></div>
                <div class="simon-board">
                    <button class="simon-pad red" data-color="red"></button>
                    <button class="simon-pad green" data-color="green"></button>
                    <button class="simon-pad blue" data-color="blue"></button>
                    <button class="simon-pad yellow" data-color="yellow"></button>
                    <div class="simon-center-logo">
                        <span>VILY</span>
                        <div class="simon-center-light" id="simon-center-light"></div>
                    </div>
                </div>
                <div class="simon-help-msg" id="simon-status-msg">Click start to play!</div>
            </div>
        `;
        
        // Add click listeners to pads
        this.container.querySelectorAll('.simon-pad').forEach(pad => {
            pad.addEventListener('click', () => {
                const color = pad.dataset.color;
                this.handlePadClick(color);
            });
        });
    }
    
    start() {
        this.sequence = [];
        this.level = 0;
        this.acceptInput = false;
        this.nextLevel();
    }
    
    stop() {
        this.acceptInput = false;
        this.isPlayingSequence = false;
    }
    
    nextLevel() {
        this.level++;
        const levelVal = document.getElementById('simon-level-val');
        if (levelVal) levelVal.textContent = this.level;
        
        this.userSequence = [];
        
        // Add random color to sequence
        const randomColor = this.colors[Math.floor(Math.random() * this.colors.length)];
        this.sequence.push(randomColor);
        
        this.playSequence();
        
        if (this.onLevelUp) this.onLevelUp(this.level);
    }
    
    async playSequence() {
        this.isPlayingSequence = true;
        this.acceptInput = false;
        this.updateStatusMsg("Watch VILY...");
        
        // Change robot face to curious
        if (typeof app !== 'undefined' && app.face) {
            app.face.setMood('curious');
        }
        
        // Delay before playing sequence
        await this.delay(800);
        
        for (const color of this.sequence) {
            if (!this.isPlayingSequence) return;
            await this.flashColor(color);
            await this.delay(300); // Gap between flashes
        }
        
        this.isPlayingSequence = false;
        this.acceptInput = true;
        this.updateStatusMsg("Your Turn!");
        
        if (typeof app !== 'undefined' && app.face) {
            app.face.setMood('happy');
        }
    }
    
    async flashColor(color) {
        const pad = this.container.querySelector(`.simon-pad.${color}`);
        const centerLight = document.getElementById('simon-center-light');
        const data = this.colorData[color];
        
        if (pad) pad.classList.add('active');
        if (centerLight) {
            centerLight.style.background = data.hex;
            centerLight.style.boxShadow = `0 0 15px ${data.hex}`;
        }
        
        // Play beep tone
        if (typeof soundEngine !== 'undefined') {
            soundEngine.playBeep(data.freq, 300, 'sine', 0.12);
        }
        
        // Flash robot's physical RGB LED via BLE
        if (typeof ble !== 'undefined' && ble.connected) {
            ble.setLED(...data.bleRGB);
        }
        
        await this.delay(400);
        
        if (pad) pad.classList.remove('active');
        if (centerLight) {
            centerLight.style.background = 'transparent';
            centerLight.style.boxShadow = 'none';
        }
        
        // Turn off robot's physical LED
        if (typeof ble !== 'undefined' && ble.connected) {
            ble.ledOff();
        }
    }
    
    handlePadClick(color) {
        if (!this.acceptInput || this.isPlayingSequence) return;
        
        const data = this.colorData[color];
        
        // Animate clicked pad local UI
        const pad = this.container.querySelector(`.simon-pad.${color}`);
        if (pad) {
            pad.classList.add('active');
            setTimeout(() => pad.classList.remove('active'), 150);
        }
        
        // Beep local audio
        if (typeof soundEngine !== 'undefined') {
            soundEngine.playBeep(data.freq, 150, 'sine', 0.12);
        }
        
        // Flash physical LED
        if (typeof ble !== 'undefined' && ble.connected) {
            ble.setLED(...data.bleRGB);
            setTimeout(() => ble.ledOff(), 150);
        }
        
        // Push and verify
        this.userSequence.push(color);
        const currentIndex = this.userSequence.length - 1;
        
        if (this.userSequence[currentIndex] !== this.sequence[currentIndex]) {
            // FAILED!
            this.handleFail();
            return;
        }
        
        if (this.userSequence.length === this.sequence.length) {
            // Completed sequence!
            this.handleSuccess();
        }
    }
    
    async handleSuccess() {
        this.acceptInput = false;
        this.updateStatusMsg("Correct!");
        
        // Robot feedback
        if (typeof ble !== 'undefined' && ble.connected) {
            // Flash green twice quickly
            ble.setLED(0, 255, 0);
            await this.delay(100);
            ble.ledOff();
            await this.delay(100);
            ble.setLED(0, 255, 0);
            await this.delay(100);
            ble.ledOff();
            
            // Nod physical robot
            ble.playAnimation(0x02);
        }
        
        if (typeof app !== 'undefined' && app.face) {
            app.face.setMood('excited');
        }
        
        await this.delay(1000);
        this.nextLevel();
    }
    
    async handleFail() {
        this.acceptInput = false;
        this.updateStatusMsg("Incorrect!");
        
        if (typeof soundEngine !== 'undefined') {
            // Low buzzer fail sound
            soundEngine.playBeep(130, 600, 'sawtooth', 0.15);
            setTimeout(() => soundEngine.speak("Oh no! Game over!"), 800);
        }
        
        // Robot sad reaction
        if (typeof ble !== 'undefined' && ble.connected) {
            ble.setLED(255, 0, 0);   // Red
            ble.playAnimation(0x01); // SHAKE head
            await this.delay(600);
            ble.ledOff();
        }
        
        if (typeof app !== 'undefined' && app.face) {
            app.face.setMood('sad');
        }
        
        if (this.onGameOver) {
            this.onGameOver(this.level - 1);
        }
    }
    
    updateStatusMsg(text) {
        const el = document.getElementById('simon-status-msg');
        if (el) el.textContent = text;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
