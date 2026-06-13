/**
 * VILY App — AI Study Companion Platform
 * Home (Face), AI Chat, Study Tools, RC Control, Settings
 */

class VilyApp {
    constructor() {
        this.currentPage = 'home';
        this.connected = false;
        this.maxSpeed = 75;
        this.batteryPercent = -1;
        this.face = null;
        this.rcThrottle = null;
        this.rcSteering = null;
        this.commandThrottleMs = 80;
        this.lastCommandTime = 0;
        this.throttleTimer = null;
        this.threeView = null;
        this.theme = 'dark';
        this.pongGame = null;
        this.simonGame = null;
        this.rcStream = null;
        this.headlightOn = false;
        this.studyTools = null;
        this.aiProvider = localStorage.getItem('vily-ai-provider') || 'gemini';
        this.conversationHistory = [];
        this.activeMic = 'chat';
        this.subtitleTimeout = null;
        this.continuousTalk = false;
        this.voiceLanguage = localStorage.getItem('vily-voice-lang') || 'en-US';
        
        this.init();
    }
    
    init() {
        this.setupTheme();
        this.setupNavigation();
        this.setupFace();
        this.setupViewToggles();
        this.setupBLE();
        this.setupRC();
        this.setupSettings();
        this.setupChat();
        this.setupGames();
        this.updateMoodLabel();
        
        // Initialize Study Tools
        this.studyTools = new StudyTools(this);
        
        // Initialize Lucide Icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Initialize AudioContext unlock on first click
        document.body.addEventListener('click', () => {
            if (typeof soundEngine !== 'undefined') {
                soundEngine.initContext();
            }
        }, { once: true });
        
        // Sync AI provider buttons on startup
        this.updateAIProvider(this.aiProvider);
        
        this.navigateTo('home');
    }
    
    // ─────────────────────────────────────
    //  Top Bar
    // ─────────────────────────────────────
    
    updateTopBar(title, subtitle) {
        const titleEl = document.getElementById('top-bar-title');
        const subtitleEl = document.getElementById('top-bar-subtitle');
        if (titleEl) titleEl.textContent = title || '';
        if (subtitleEl) subtitleEl.textContent = subtitle || '';
    }

    // ─────────────────────────────────────
    //  Navigation (Sidebar Dock)
    // ─────────────────────────────────────
    
    setupNavigation() {
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                if (page) {
                    this.navigateTo(page);
                }
            });
        });
    }
    
    navigateTo(pageId) {
        // Hide home page subtitle and deactivate talk mode when navigating away
        if (pageId !== 'home') {
            this.continuousTalk = false;
            if (this.isRecording && this.activeMic === 'home') {
                try { this.speechRecog.stop(); } catch(e) {}
            }
            const subtitleEl = document.getElementById('face-subtitle');
            if (subtitleEl) subtitleEl.classList.remove('show');
            if (this.subtitleTimeout) {
                clearTimeout(this.subtitleTimeout);
            }
        }

        // Clean up camera stream if leaving RC
        if (pageId !== 'rc' && this.rcStream) {
            this.rcStream.getTracks().forEach(track => track.stop());
            this.rcStream = null;
        }

        // Update pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(`page-${pageId}`);
        if (target) target.classList.add('active');
        
        // Update sidebar
        document.querySelectorAll('.sidebar-item').forEach(n => n.classList.remove('active'));
        const navItem = document.querySelector(`.sidebar-item[data-page="${pageId}"]`);
        if (navItem) navItem.classList.add('active');
        
        this.currentPage = pageId;
        
        // Update top bar titles
        const titles = {
            home: ['Home', 'VILY is ready'],
            chat: ['AI Chat', 'Ask me anything'],
            study: ['Study Tools', 'Your learning toolkit'],
            rc: ['Remote Control', 'Drive VILY'],
            settings: ['Settings', 'Configure VILY']
        };
        const [title, subtitle] = titles[pageId] || ['VILY', ''];
        this.updateTopBar(title, subtitle);

        // Close any open study subview when navigating away
        if (pageId !== 'study' && this.studyTools) {
            this.studyTools.closeSubview();
        }
        
        // Resize RC sliders when switching to RC
        if (pageId === 'rc') {
            // Slider dimensions are managed by CSS grid/flex now
        }

        // Setup view state when navigating home
        if (pageId === 'home') {
            const toggle3d = document.getElementById('toggle-3d-view');
            const is3d = toggle3d && toggle3d.classList.contains('on');
            const faceCanvas = document.getElementById('face-canvas');
            const threeContainer = document.getElementById('three-container');
            
            if (is3d) {
                faceCanvas.style.display = 'none';
                threeContainer.style.display = 'block';
                if (!this.threeView) {
                    this.threeView = new Robot3DView('three-container', 'face-canvas');
                    const bgVal = this.theme === 'light' ? 0xf5f6fa : 0x0a0a0f;
                    if (this.threeView.scene) {
                        this.threeView.scene.background.setHex(bgVal);
                        this.threeView.scene.fog.color.setHex(bgVal);
                    }
                }
            } else {
                threeContainer.style.display = 'none';
                faceCanvas.style.display = 'block';
                if (this.threeView) {
                    this.threeView.destroy();
                    this.threeView = null;
                }
                if (this.face) {
                    setTimeout(() => this.face.setupCanvas(), 50);
                }
            }
        }

        // Focus chat input when navigating to chat
        if (pageId === 'chat') {
            setTimeout(() => {
                const input = document.getElementById('chat-text-input');
                if (input) input.focus();
            }, 100);
        }
    }
    
    // ─────────────────────────────────────
    //  Face (Home Page)
    // ─────────────────────────────────────
    
    setupFace() {
        this.face = new RobotFace('face-canvas');
        
        // Update mood label periodically
        setInterval(() => this.updateMoodLabel(), 1000);
        
        // Double-tap face to toggle fullscreen face mode
        let lastTap = 0;
        document.getElementById('face-canvas').addEventListener('click', () => {
            const now = Date.now();
            if (now - lastTap < 300) {
                document.body.classList.toggle('fullscreen-face');
                setTimeout(() => {
                    if (this.face) {
                        this.face.setupCanvas();
                    }
                }, 100);
                const isFullscreen = document.body.classList.contains('fullscreen-face');
                this.showToast(isFullscreen ? "Fullscreen Face Active! Double-tap to exit" : "Exit Fullscreen Face");
            }
            lastTap = now;
        });

        // Hover/Touch to cycle mood on mood indicator
        const moodLabelWrap = document.querySelector('.mood-label');
        if (moodLabelWrap) {
            const cycleMood = () => {
                const moods = ['happy', 'excited', 'curious', 'love', 'shy', 'surprised', 'sleepy', 'angry', 'sad', 'thinking', 'focused'];
                const current = moods.indexOf(this.face.mood);
                const next = (current + 1) % moods.length;
                this.face.setMood(moods[next]);
                this.updateMoodLabel();
            };
            moodLabelWrap.addEventListener('mouseenter', cycleMood);
            moodLabelWrap.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                cycleMood();
            }, { passive: true });
        }

        // Collapsible home info bar toggle
        const infoBar = document.getElementById('home-info-bar');
        const infoToggle = document.getElementById('info-bar-toggle');
        if (infoBar && infoToggle) {
            infoToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                infoBar.classList.toggle('collapsed');
                infoBar.classList.toggle('expanded');
            });
        }
    }
    
    updateMoodLabel() {
        const label = document.getElementById('mood-label');
        const icon = document.getElementById('mood-icon');
        if (this.face) {
            const currentMood = this.face.mood;
            const moodText = this.face.getMoodLabel();
            if (label) label.textContent = moodText;
            
            if (icon && currentMood !== this.lastMood) {
                const moodIcons = {
                    happy: 'smile',
                    curious: 'help-circle',
                    sleepy: 'moon',
                    excited: 'sparkles',
                    sad: 'frown',
                    shy: 'eye-off',
                    love: 'heart',
                    angry: 'angry',
                    surprised: 'info',
                    thinking: 'brain',
                    focused: 'target'
                };
                const moodColors = {
                    happy: 'text-green',
                    curious: 'text-blue',
                    sleepy: 'text-teal',
                    excited: 'text-yellow',
                    sad: 'text-blue',
                    shy: 'text-purple',
                    love: 'text-pink',
                    angry: 'text-orange',
                    surprised: 'text-yellow',
                    thinking: 'text-purple',
                    focused: 'text-green'
                };
                
                icon.setAttribute('class', 'icon-sm');
                
                const targetIcon = moodIcons[currentMood] || 'smile';
                const targetColor = moodColors[currentMood] || 'text-green';
                
                icon.setAttribute('data-lucide', targetIcon);
                icon.classList.add(targetColor);
                
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
                this.lastMood = currentMood;
            }
        }
    }

    // ─────────────────────────────────────
    //  Theme Management
    // ─────────────────────────────────────
    
    setupTheme() {
        this.theme = localStorage.getItem('vily-theme') || 'dark';
        
        const headerBtn = document.getElementById('theme-toggle-btn');
        if (headerBtn) {
            headerBtn.addEventListener('click', () => this.toggleTheme());
        }
        
        this.applyTheme(this.theme);
    }
    
    applyTheme(theme) {
        const body = document.body;
        const headerBtn = document.getElementById('theme-toggle-btn');
        const toggleSwitch = document.getElementById('toggle-light-theme');
        
        if (theme === 'light') {
            body.classList.add('light-mode');
            if (headerBtn) {
                headerBtn.querySelector('.sun-icon').style.display = 'none';
                headerBtn.querySelector('.moon-icon').style.display = 'block';
            }
            if (toggleSwitch) toggleSwitch.classList.add('on');
        } else {
            body.classList.remove('light-mode');
            if (headerBtn) {
                headerBtn.querySelector('.sun-icon').style.display = 'block';
                headerBtn.querySelector('.moon-icon').style.display = 'none';
            }
            if (toggleSwitch) toggleSwitch.classList.remove('on');
        }
        
        this.theme = theme;
        localStorage.setItem('vily-theme', theme);
        
        // Update 3D Background if active
        if (this.threeView && this.threeView.scene) {
            const bgVal = theme === 'light' ? 0xf5f6fa : 0x0a0a0f;
            this.threeView.scene.background.setHex(bgVal);
            this.threeView.scene.fog.color.setHex(bgVal);
        }
    }
    
    toggleTheme() {
        const newTheme = this.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
        this.showToast(`Theme: ${newTheme === 'light' ? 'Light' : 'Dark'} Mode`);
    }

    // ─────────────────────────────────────
    //  2D/3D View Toggles
    // ─────────────────────────────────────
    
    setupViewToggles() {
        const btn2d = document.getElementById('btn-view-2d');
        const btn3d = document.getElementById('btn-view-3d');
        const toggle3d = document.getElementById('toggle-3d-view');
        const faceCanvas = document.getElementById('face-canvas');
        const threeContainer = document.getElementById('three-container');
        
        const switchTo3D = () => {
            if (btn2d) btn2d.classList.remove('active');
            if (btn3d) btn3d.classList.add('active');
            faceCanvas.style.display = 'none';
            threeContainer.style.display = 'block';
            if (!this.threeView) {
                this.threeView = new Robot3DView('three-container', 'face-canvas');
                const bgVal = this.theme === 'light' ? 0xf5f6fa : 0x0a0a0f;
                if (this.threeView.scene) {
                    this.threeView.scene.background.setHex(bgVal);
                    this.threeView.scene.fog.color.setHex(bgVal);
                }
            }
            if (toggle3d) toggle3d.classList.add('on');
        };

        const switchTo2D = () => {
            if (btn3d) btn3d.classList.remove('active');
            if (btn2d) btn2d.classList.add('active');
            threeContainer.style.display = 'none';
            faceCanvas.style.display = 'block';
            if (this.threeView) {
                this.threeView.destroy();
                this.threeView = null;
            }
            if (toggle3d) toggle3d.classList.remove('on');
            if (this.face) {
                setTimeout(() => this.face.setupCanvas(), 50);
            }
        };

        if (btn2d) btn2d.addEventListener('click', switchTo2D);
        if (btn3d) btn3d.addEventListener('click', switchTo3D);

        if (toggle3d) {
            toggle3d.addEventListener('click', () => {
                const is3d = toggle3d.classList.contains('on');
                if (is3d) {
                    switchTo2D();
                    this.showToast('Viewer: 2D Face Mode');
                } else {
                    switchTo3D();
                    this.showToast('Viewer: 3D Robot Mode');
                }
            });
        }

        // Home page AI Provider selection listeners
        document.querySelectorAll('[data-home-provider]').forEach(btn => {
            btn.addEventListener('click', () => {
                const provider = btn.dataset.homeProvider;
                if (provider) {
                    this.updateAIProvider(provider);
                    let displayName = 'Gemini';
                    if (provider === 'openai') displayName = 'OpenAI';
                    else if (provider === 'groq') displayName = 'Groq';
                    this.showToast(`AI Provider: ${displayName}`);
                }
            });
        });

        // Top bar AI Provider badge click cycles provider
        const badgeBtn = document.getElementById('ai-provider-badge');
        if (badgeBtn) {
            badgeBtn.addEventListener('click', () => {
                const providers = ['gemini', 'openai', 'groq'];
                const nextIndex = (providers.indexOf(this.aiProvider) + 1) % providers.length;
                const nextProvider = providers[nextIndex];
                
                this.updateAIProvider(nextProvider);
                
                let displayName = 'Gemini';
                if (nextProvider === 'openai') displayName = 'OpenAI';
                else if (nextProvider === 'groq') displayName = 'Groq';
                
                this.showToast(`AI Provider: ${displayName}`);
            });
        }
    }
    
    // ─────────────────────────────────────
    //  BLE Connection
    // ─────────────────────────────────────
    
    setupBLE() {
        ble.onConnect = (name) => {
            this.connected = true;
            this.updateConnectionUI(true);
            this.showToast(`🤖 Connected to ${name}!`);
            this.face.setMood('excited');
        };
        
        ble.onDisconnect = () => {
            this.connected = false;
            this.updateConnectionUI(false);
            this.batteryPercent = -1;
            this.updateBatteryUI(-1);
            this.showToast('Disconnected from VILY');
            this.face.setMood('sad');
        };
        
        ble.onBattery = (percent) => {
            this.batteryPercent = percent;
            this.updateBatteryUI(percent);
        };
        
        ble.onMotorStatus = () => {};
        ble.onLog = () => {};
        
        // Connect button in modal
        document.getElementById('modal-connect-btn').addEventListener('click', () => this.connectBLE());
        document.getElementById('modal-cancel-btn').addEventListener('click', () => this.hideConnectModal());
        
        // Connection tap on top bar
        document.getElementById('ble-status-tap').addEventListener('click', () => {
            if (this.connected) {
                this.disconnectBLE();
            } else {
                this.showConnectModal();
            }
        });
    }
    
    async connectBLE() {
        const btn = document.getElementById('modal-connect-btn');
        const ipInput = document.getElementById('wifi-ip-input');
        const ipAddress = ipInput ? ipInput.value.trim() : 'vily.local';
        
        if (!ipAddress) {
            this.showToast('Please enter an IP address or hostname');
            return;
        }
        
        localStorage.setItem('vily-ip-address', ipAddress);
        
        btn.classList.add('connecting');
        btn.innerHTML = '<i class="icon-pulse">📡</i> Connecting...';
        
        try {
            await ble.connect(ipAddress);
            this.hideConnectModal();
        } catch (err) {
            btn.classList.remove('connecting');
            btn.innerHTML = '<i data-lucide="wifi" style="display:inline-block; width:16px; height:16px; vertical-align:middle; margin-right:4px;"></i> Connect';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            this.showToast('Connection failed. Try again.');
        }
    }
    
    async disconnectBLE() {
        await ble.disconnect();
        this.showToast('Disconnected');
    }
    
    showConnectModal() {
        const modal = document.getElementById('connect-modal');
        modal.classList.add('show');
        
        // Pre-fill IP address from localStorage
        const ipInput = document.getElementById('wifi-ip-input');
        if (ipInput) {
            ipInput.value = localStorage.getItem('vily-ip-address') || 'vily.local';
        }
    }
    
    hideConnectModal() {
        document.getElementById('connect-modal').classList.remove('show');
        const btn = document.getElementById('modal-connect-btn');
        btn.classList.remove('connecting');
        btn.innerHTML = '<i data-lucide="wifi" style="display:inline-block; width:16px; height:16px; vertical-align:middle; margin-right:4px;"></i> Connect';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    updateConnectionUI(connected) {
        const dot = document.getElementById('ble-dot');
        const tapBtn = document.getElementById('ble-status-tap');
        if (connected) {
            if (dot) dot.classList.add('on');
            if (tapBtn) {
                tapBtn.style.color = '#00b894'; // var(--accent-green)
                tapBtn.style.filter = 'drop-shadow(0 0 8px rgba(0, 184, 148, 0.4))';
            }
        } else {
            if (dot) dot.classList.remove('on');
            if (tapBtn) {
                tapBtn.style.color = '';
                tapBtn.style.filter = '';
            }
        }
    }
    
    updateBatteryUI(percent) {
        const el = document.getElementById('battery-text');
        if (el) {
            el.textContent = percent >= 0 ? `${percent}%` : '--';
        }
        const el2 = document.getElementById('topbar-battery-text');
        if (el2) {
            if (percent >= 0) {
                el2.textContent = `${percent}%`;
                el2.style.display = 'inline';
            } else {
                el2.style.display = 'none';
            }
        }
    }
    
    // ─────────────────────────────────────
    //  Games (moved to Study Break)
    // ─────────────────────────────────────
    
    setupGames() {
        const pongModal = document.getElementById('pong-modal');
        const pongClose = document.getElementById('pong-close-btn');
        const pongStartAI = document.getElementById('pong-start-ai-btn');
        const pongStartPVP = document.getElementById('pong-start-pvp-btn');
        
        const simonModal = document.getElementById('simon-modal');
        const simonClose = document.getElementById('simon-close-btn');
        const simonStart = document.getElementById('simon-start-btn');

        if (pongClose) {
            pongClose.addEventListener('click', () => {
                pongModal.classList.remove('show');
                if (this.pongGame) {
                    this.pongGame.stop();
                    this.pongGame = null;
                }
            });
        }

        if (simonClose) {
            simonClose.addEventListener('click', () => {
                simonModal.classList.remove('show');
                if (this.simonGame) {
                    this.simonGame.stop();
                    this.simonGame = null;
                }
            });
        }

        if (pongStartAI) {
            pongStartAI.addEventListener('click', () => {
                document.getElementById('pong-start-screen').classList.add('hide');
                this.pongGame = new VILYPongGame('pong-canvas', {
                    onGameOver: (winner) => {
                        this.showToast(`${winner} wins!`);
                        setTimeout(() => {
                            document.getElementById('pong-start-screen').classList.remove('hide');
                        }, 2000);
                    }
                });
                this.pongGame.start('ai');
            });
        }

        if (pongStartPVP) {
            pongStartPVP.addEventListener('click', () => {
                document.getElementById('pong-start-screen').classList.add('hide');
                this.pongGame = new VILYPongGame('pong-canvas', {
                    onGameOver: (winner) => {
                        this.showToast(`${winner} wins!`);
                        setTimeout(() => {
                            document.getElementById('pong-start-screen').classList.remove('hide');
                        }, 2000);
                    }
                });
                this.pongGame.start('pvp');
            });
        }

        if (simonStart) {
            simonStart.addEventListener('click', () => {
                document.getElementById('simon-start-screen').classList.add('hide');
                if (this.simonGame) {
                    this.simonGame.start();
                }
            });
        }
    }

    handleGameLaunch(game) {
        const pongModal = document.getElementById('pong-modal');
        const simonModal = document.getElementById('simon-modal');

        if (game === 'VILY Pong') {
            if (pongModal) {
                pongModal.classList.add('show');
                document.getElementById('pong-start-screen').classList.remove('hide');
            }
        } else if (game === 'Simon Says') {
            if (simonModal) {
                simonModal.classList.add('show');
                document.getElementById('simon-start-screen').classList.remove('hide');
                this.simonGame = new SimonSaysGame('simon-container', {
                    onGameOver: (score) => {
                        this.showToast(`Game Over! Score: ${score}`);
                        setTimeout(() => {
                            document.getElementById('simon-start-screen').classList.remove('hide');
                        }, 1500);
                    }
                });
            }
        } else {
            this.showToast(`🎮 ${game} — Launching!`);
            this.face.setMood('excited');
            if (typeof soundEngine !== 'undefined') {
                soundEngine.speak(`Let's play ${game}!`);
            }
        }
    }
    
    // ─────────────────────────────────────
    //  RC (Remote Control) Page
    // ─────────────────────────────────────
    
    setupRC() {
        // Initialize speed from slider value (default is 30% of 255 = 77)
        this.maxSpeed = Math.round((30 / 100) * 255);

        // Speed Slider Control
        const speedSlider = document.getElementById('rc-speed-slider');
        const speedVal = document.getElementById('rc-speed-val');
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                const pct = parseInt(e.target.value);
                this.maxSpeed = Math.round((pct / 100) * 255);
                if (speedVal) speedVal.textContent = `${pct}%`;
            });
        }

        // Helper to bind D-pad actions (hold to drive, release to stop)
        const bindDpadAction = (btnId, direction) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;

            const startMove = (e) => {
                e.preventDefault();
                btn.classList.add('active');
                this.sendMotorCommand(direction, this.maxSpeed);
            };

            const stopMove = (e) => {
                e.preventDefault();
                btn.classList.remove('active');
                this.sendMotorCommand('center', 0);
            };

            btn.addEventListener('mousedown', startMove);
            btn.addEventListener('touchstart', startMove, { passive: false });
            
            btn.addEventListener('mouseup', stopMove);
            btn.addEventListener('mouseleave', stopMove);
            btn.addEventListener('touchend', stopMove);
        };

        // Bind directions
        bindDpadAction('rc-btn-up', 'forward');
        bindDpadAction('rc-btn-down', 'backward');
        bindDpadAction('rc-btn-left', 'left');
        bindDpadAction('rc-btn-right', 'right');

        // Stop button (explicit click stop)
        const stopBtn = document.getElementById('rc-btn-stop');
        if (stopBtn) {
            const handleStop = (e) => {
                e.preventDefault();
                stopBtn.classList.add('active');
                setTimeout(() => stopBtn.classList.remove('active'), 250);
                this.sendMotorCommand('center', 0);
                if (this.connected) {
                    ble.stop();
                    ble.stopAnimation();
                }
                this.showToast('⛔ EMERGENCY STOP');
            };
            stopBtn.addEventListener('mousedown', handleStop);
            stopBtn.addEventListener('touchstart', handleStop, { passive: false });
        }

        // Horn Button
        document.getElementById('rc-btn-horn')?.addEventListener('click', () => {
            const btn = document.getElementById('rc-btn-horn');
            btn.classList.add('active');
            setTimeout(() => btn.classList.remove('active'), 250);

            this.showToast('📢 Beep beep!');
            if (typeof soundEngine !== 'undefined') {
                soundEngine.playBeep(440, 300, 'sine', 0.2);
            }
            if (this.connected) ble.blinkLED(200, 3);
        });

        // Light Button
        document.getElementById('rc-btn-light')?.addEventListener('click', () => {
            if (this.connected) {
                const btn = document.getElementById('rc-btn-light');
                this.headlightOn = !this.headlightOn;
                if (this.headlightOn) {
                    ble.setLED(255, 255, 255);
                    btn.classList.add('active-yellow');
                    this.showToast('💡 Headlight ON');
                } else {
                    ble.ledOff();
                    btn.classList.remove('active-yellow');
                    this.showToast('💡 Headlight OFF');
                }
            } else {
                this.showConnectModal();
            }
        });
    }
    
    sendMotorCommand(direction, speed) {
        if (this.threeView) {
            this.threeView.setMovement(direction, speed);
        }

        if (!this.connected) return;
        
        const now = Date.now();
        const elapsed = now - this.lastCommandTime;
        
        const send = () => {
            this.lastCommandTime = Date.now();
            switch (direction) {
                case 'forward': case 'forward-left': case 'forward-right':
                    if (direction.includes('left')) ble.turnLeft(speed);
                    else if (direction.includes('right')) ble.turnRight(speed);
                    else ble.moveForward(speed);
                    break;
                case 'backward': case 'backward-left': case 'backward-right':
                    ble.moveBackward(speed);
                    break;
                case 'left': ble.spinLeft(speed); break;
                case 'right': ble.spinRight(speed); break;
                case 'center': ble.stop(); break;
            }
        };
        
        if (elapsed >= this.commandThrottleMs) {
            send();
        } else {
            clearTimeout(this.throttleTimer);
            this.throttleTimer = setTimeout(send, this.commandThrottleMs - elapsed);
        }
    }
    
    // ─────────────────────────────────────
    //  Settings Page
    // ─────────────────────────────────────
    
    setupSettings() {
        // Voice Language selection
        document.querySelectorAll('[data-lang]').forEach(btn => {
            if (btn.dataset.lang === this.voiceLanguage) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
            
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                this.voiceLanguage = lang;
                localStorage.setItem('vily-voice-lang', lang);
                
                document.querySelectorAll('[data-lang]').forEach(b => {
                    if (b.dataset.lang === lang) b.classList.add('active');
                    else b.classList.remove('active');
                });
                
                if (this.speechRecog) {
                    this.speechRecog.lang = lang;
                }
                
                this.showToast(`Voice input language: ${lang === 'ta-IN' ? 'Tamil (தமிழ்)' : 'English'}`);
            });
        });

        // Toggle switches
        document.querySelectorAll('.toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('on');
                const setting = toggle.dataset.setting;
                const isOn = toggle.classList.contains('on');
                
                if (setting === 'Light Theme') {
                    this.applyTheme(isOn ? 'light' : 'dark');
                } else if (setting === 'Sound Effects') {
                    if (typeof soundEngine !== 'undefined') {
                        soundEngine.soundEnabled = isOn;
                    }
                } else if (setting === 'Voice TTS') {
                    if (typeof soundEngine !== 'undefined') {
                        soundEngine.ttsEnabled = isOn;
                    }
                }
                
                this.showToast(`${setting}: ${isOn ? 'ON' : 'OFF'}`);
            });
        });
        
        // Connect/Disconnect setting
        document.getElementById('setting-connect')?.addEventListener('click', () => {
            if (this.connected) {
                this.disconnectBLE();
            } else {
                this.showConnectModal();
            }
        });
        
        // LED test
        document.getElementById('setting-led')?.addEventListener('click', () => {
            if (this.connected) {
                const colors = [[255,0,0],[0,255,0],[0,0,255],[255,255,0],[0,255,255],[255,0,255]];
                let i = 0;
                const cycle = setInterval(() => {
                    if (i >= colors.length) { clearInterval(cycle); ble.ledOff(); return; }
                    ble.setLED(...colors[i]);
                    i++;
                }, 400);
                this.showToast('🌈 LED Color Test');
            } else {
                this.showConnectModal();
            }
        });
        
        // Motor test
        document.getElementById('setting-motor')?.addEventListener('click', () => {
            if (this.connected) {
                ble.playAnimation(0x02);
                this.showToast('⚙️ Motor Test — Nod');
            } else {
                this.showConnectModal();
            }
        });
        
        // About
        document.getElementById('setting-about')?.addEventListener('click', () => {
            this.showToast('VILY v2.0 — AI Study Companion Platform');
        });

        // AI Provider selection
        document.querySelectorAll('[data-provider]').forEach(btn => {
            btn.addEventListener('click', () => {
                const provider = btn.dataset.provider;
                if (provider) {
                    this.updateAIProvider(provider);
                    let displayName = 'Gemini';
                    if (provider === 'openai') displayName = 'OpenAI';
                    else if (provider === 'groq') displayName = 'Groq';
                    this.showToast(`AI Provider: ${displayName}`);
                }
            });
        });

        // Save API keys
        document.getElementById('save-api-keys-btn')?.addEventListener('click', async () => {
            const geminiKey = document.getElementById('gemini-api-key-input')?.value.trim();
            const openaiKey = document.getElementById('openai-api-key-input')?.value.trim();
            const groqKey = document.getElementById('groq-api-key-input')?.value.trim();

            try {
                const response = await fetch('/api/settings/keys', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ geminiKey, openaiKey, groqKey })
                });
                if (response.ok) {
                    this.showToast('🔑 API Keys saved!');
                } else {
                    this.showToast('Failed to save keys');
                }
            } catch (err) {
                this.showToast('Failed to save keys — check server');
            }
        });

        // Clear chat history
        document.getElementById('setting-clear-chat')?.addEventListener('click', () => {
            this.conversationHistory = [];
            const chatHistory = document.getElementById('chat-history');
            if (chatHistory) {
                chatHistory.innerHTML = `
                    <div class="chat-welcome" id="chat-welcome">
                        <div class="chat-welcome-icon">🤖</div>
                        <h3>Hey there, I'm VILY!</h3>
                        <p>Your AI study companion. Ask me anything — from math problems to quiz generation. I'm here to help you learn! ✨</p>
                    </div>
                `;
            }
            this.showToast('🗑️ Chat history cleared');
        });

        // Clear memory
        document.getElementById('setting-clear-memory')?.addEventListener('click', async () => {
            try {
                await fetch('/api/memory/clear', { method: 'POST' });
                this.showToast('🧠 AI Memory cleared');
            } catch (err) {
                this.showToast('Failed to clear memory');
            }
        });
    }

    updateProviderBadge() {
        const badgeName = document.getElementById('ai-provider-name');
        const badgeBtn = document.getElementById('ai-provider-badge');
        if (badgeName) {
            let displayName = 'Gemini';
            if (this.aiProvider === 'openai') displayName = 'OpenAI';
            else if (this.aiProvider === 'groq') displayName = 'Groq';
            badgeName.textContent = displayName;
        }
        if (badgeBtn) {
            if (this.aiProvider === 'gemini') {
                badgeBtn.style.color = 'var(--accent-primary)';
                badgeBtn.style.background = 'var(--accent-primary-glow)';
                badgeBtn.style.borderColor = 'rgba(108,92,231,0.2)';
            } else if (this.aiProvider === 'openai') {
                badgeBtn.style.color = 'var(--accent-green)';
                badgeBtn.style.background = 'rgba(0, 184, 148, 0.1)';
                badgeBtn.style.borderColor = 'rgba(0, 184, 148, 0.2)';
            } else if (this.aiProvider === 'groq') {
                badgeBtn.style.color = 'var(--accent-pink)';
                badgeBtn.style.background = 'rgba(253, 121, 168, 0.1)';
                badgeBtn.style.borderColor = 'rgba(253, 121, 168, 0.2)';
            }
        }
    }
    
    updateAIProvider(provider) {
        this.aiProvider = provider;
        localStorage.setItem('vily-ai-provider', provider);
        
        this.updateProviderBadge();
        
        // Sync Home page provider buttons
        document.querySelectorAll('[data-home-provider]').forEach(btn => {
            if (btn.dataset.homeProvider === provider) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Sync Settings page provider buttons
        document.querySelectorAll('[data-provider]').forEach(btn => {
            if (btn.dataset.provider === provider) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    // ─────────────────────────────────────
    //  Toast
    // ─────────────────────────────────────
    
    showToast(message) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('out');
            setTimeout(() => toast.remove(), 250);
        }, 2500);
    }

    startSpeechRecognition() {
        if (!this.speechRecog) return;
        if (this.isRecording) return;
        
        // Safety guard: do not start recording if VILY is currently speaking or if synthesis is active
        if (window.speechSynthesis.speaking || (this.face && this.face.isSpeaking)) {
            console.log("[Speech] Guard triggered: VILY is speaking. Cannot start listening.");
            return;
        }
        
        try {
            this.speechRecog.start();
        } catch(err) {
            console.warn('[Speech] startSpeechRecognition failed:', err);
        }
    }

    // ─────────────────────────────────────
    //  AI Chat — Full Page
    // ─────────────────────────────────────
    
    setupChat() {
        const sendBtn = document.getElementById('chat-send-btn');
        const micBtn = document.getElementById('chat-mic-btn');
        const textInput = document.getElementById('chat-text-input');

        const handleSend = () => {
            const msg = textInput.value.trim();
            if (msg) {
                textInput.value = '';
                this.sendChatMessage(msg);
            }
        };

        if (sendBtn) {
            sendBtn.addEventListener('click', handleSend);
        }

        if (textInput) {
            textInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    handleSend();
                }
            });
        }

        // Quick action chips
        document.querySelectorAll('.quick-chip[data-action]').forEach(chip => {
            chip.addEventListener('click', () => {
                const action = chip.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Speech Recognition Setup (Web Speech API)
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.speechRecog = new SpeechRecognition();
            this.speechRecog.continuous = false;
            this.speechRecog.interimResults = false;
            this.speechRecog.lang = this.voiceLanguage;
            this.isRecording = false;
 
            this.speechRecog.onstart = () => {
                this.isRecording = true;
                if (this.activeMic === 'home') {
                    document.getElementById('face-mic-btn')?.classList.add('listening');
                    if (this.face) {
                        this.face.setMood('curious', 15000); // Lock to curious during listening
                        this.updateMoodLabel();
                    }
                } else {
                    micBtn.classList.add('recording');
                }
                this.showToast("Listening...");
            };

            this.speechRecog.onend = () => {
                this.isRecording = false;
                document.getElementById('face-mic-btn')?.classList.remove('listening');
                micBtn.classList.remove('recording');

                // If in continuous talk mode and not speaking, restart listening after a short delay
                if (this.continuousTalk && this.currentPage === 'home' && !window.speechSynthesis.speaking) {
                    setTimeout(() => {
                        if (this.continuousTalk && this.currentPage === 'home' && !this.isRecording) {
                            this.startSpeechRecognition();
                        }
                    }, 1200);
                }
            };

            this.speechRecog.onerror = (e) => {
                console.error('[Speech] Error:', e.error);
                this.isRecording = false;
                document.getElementById('face-mic-btn')?.classList.remove('listening');
                micBtn.classList.remove('recording');
                if (e.error !== 'no-speech') {
                    this.showToast(`Speech recognition error: ${e.error}`);
                }
            };

            this.speechRecog.onresult = (event) => {
                const text = event.results[0][0].transcript;
                
                // Forcibly stop the speech recognition immediately to prevent feedback loop
                try {
                    this.speechRecog.stop();
                } catch(err) {}
                
                if (this.activeMic === 'home') {
                    this.sendChatMessage(text, true);
                } else {
                    textInput.value = text;
                    this.sendChatMessage(text, false);
                    textInput.value = '';
                }
            };

            micBtn.addEventListener('click', () => {
                if (this.isRecording && this.activeMic !== 'chat') {
                    this.speechRecog.stop();
                    setTimeout(() => {
                        this.activeMic = 'chat';
                        this.startSpeechRecognition();
                    }, 200);
                    return;
                }
                this.activeMic = 'chat';
                if (this.isRecording) {
                    this.speechRecog.stop();
                } else {
                    this.startSpeechRecognition();
                }
            });

            const faceMic = document.getElementById('face-mic-btn');
            if (faceMic) {
                faceMic.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    // Home page microphone toggles continuous talk mode
                    this.activeMic = 'home';
                    
                    if (this.continuousTalk) {
                        this.continuousTalk = false;
                        if (this.isRecording) {
                            this.speechRecog.stop();
                        }
                        this.showToast('💬 Talk mode deactivated');
                    } else {
                        this.continuousTalk = true;
                        this.showToast('💬 Talk mode activated');
                        if (!this.isRecording) {
                            this.startSpeechRecognition();
                        }
                    }
                });
            }
        } else {
            micBtn.style.display = 'none';
            const faceMic = document.getElementById('face-mic-btn');
            if (faceMic) faceMic.style.display = 'none';
        }
    }

    handleQuickAction(action) {
        const textInput = document.getElementById('chat-text-input');
        const prompts = {
            explain: 'Explain the concept of ',
            quiz: 'Generate a quick quiz about ',
            math: 'Solve this math problem: ',
            summarize: 'Summarize this topic: ',
            flashcard: 'Create flashcards for the topic: ',
            motivate: 'Give me a motivational message to help me study!'
        };

        if (action === 'motivate') {
            this.sendChatMessage(prompts[action]);
        } else if (textInput) {
            textInput.value = prompts[action] || '';
            textInput.focus();
        }
    }
    
    detectSentimentMood(text) {
        const t = text.toLowerCase().trim();
        // Match expressions (English & Tamil)
        if (/\b(love|heart|like you|cute|sweet|beauty|beautiful|love you|dear|sweetie|charming|anbu|kaadhal|pidikkum|alagu|chellam)\b/.test(t) || t.includes("பிடிக்கும்") || t.includes("அன்பு") || t.includes("காதல்") || t.includes("செல்லம்")) {
            return 'love';
        }
        if (/\b(happy|excited|joy|yay|awesome|great|cool|hurrah|fun|delighted|glad|celebrate|yippee|santhosam|magilchi|super|vegam|vetri)\b/.test(t) || t.includes("சந்தோஷம்") || t.includes("மகிழ்ச்சி") || t.includes("வெற்றி")) {
            return 'excited';
        }
        if (/\b(sad|cry|hurt|bad|sorry|tired|failed|unhappy|pain|depressed|gloomy|lonely|weep|sogam|kavalai|vali|ala|thozhvi|kashtam)\b/.test(t) || t.includes("சோகம்") || t.includes("கவலை") || t.includes("வலி") || t.includes("தோல்வி") || t.includes("கஷ்டம்")) {
            return 'sad';
        }
        if (/\b(angry|hate|mad|annoy|stupid|idiot|fool|shut up|annoyed|furious|irritated|kobam|veruppu|muttal)\b/.test(t) || t.includes("கோபம்") || t.includes("வெறுப்பு") || t.includes("முட்டாள்")) {
            return 'angry';
        }
        if (/\b(wow|shock|surprise|really|omg|incredible|unbelievable|gasp|aachariyam|appadiya|sema)\b/.test(t) || t.includes("ஆச்சரியம்") || t.includes("அப்படியா") || t.includes("செம")) {
            return 'surprised';
        }
        if (/\b(sleep|sleepy|tired|night|bed|exhausted|yawn|lazy|thoongu|kalaipu)\b/.test(t) || t.includes("தூங்கு") || t.includes("களைப்பு")) {
            return 'sleepy';
        }
        if (/\b(what|how|why|who|where|question|explain|concept|ask|query|curious|wonder|enna|eppadi|yen|yaar|yenge|kelvi)\b/.test(t) || t.includes("என்ன") || t.includes("எப்படி") || t.includes("ஏன்") || t.includes("யார்") || t.includes("எங்கே") || t.includes("கேள்வி")) {
            return 'curious';
        }
        if (/\b(solve|math|calculate|quiz|test|study|exam|focus|concentrate|padi|kanakku|thiruvu)\b/.test(t) || t.includes("படி") || t.includes("கணக்கு")) {
            return 'focused';
        }
        return 'thinking';
    }

    async sendChatMessage(message, isHomeVoice = false) {
        const chatHistory = document.getElementById('chat-history');
        if (!chatHistory) return;

        // Hide welcome
        const welcome = document.getElementById('chat-welcome');
        if (welcome) welcome.style.display = 'none';

        // Navigate to chat page if not already there and not home voice chat
        if (!isHomeVoice && this.currentPage !== 'chat') {
            this.navigateTo('chat');
        }

        // Append user message
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        
        const userMsg = document.createElement('div');
        userMsg.className = 'chat-msg user';
        userMsg.innerHTML = `
            <div class="chat-msg-avatar">U</div>
            <div class="chat-msg-content">
                <div class="chat-msg-bubble">${this.escapeHtml(message)}</div>
                <span class="chat-msg-time">${timeStr}</span>
            </div>
        `;
        chatHistory.appendChild(userMsg);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        // Add to conversation history
        this.conversationHistory.push({ role: 'user', content: message });

        // Typing indicator
        const typingMsg = document.createElement('div');
        typingMsg.className = 'chat-msg bot';
        typingMsg.id = 'typing-indicator';
        typingMsg.innerHTML = `
            <div class="chat-msg-avatar">V</div>
            <div class="chat-msg-content">
                <div class="chat-msg-bubble">
                    <div class="typing-indicator">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            </div>
        `;
        chatHistory.appendChild(typingMsg);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        if (this.face) {
            const initialMood = this.detectSentimentMood(message);
            this.face.setMood(initialMood, 25000); // Lock it for up to 25s or until response
            this.updateMoodLabel();
        }

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message,
                    provider: this.aiProvider,
                    history: this.conversationHistory.slice(-10) // Last 10 messages for context
                })
            });

            // Remove typing indicator
            const indicator = document.getElementById('typing-indicator');
            if (indicator) indicator.remove();

            if (!response.ok) throw new Error('API request failed');
            const data = await response.json();

            // Add bot response
            const botMsg = document.createElement('div');
            botMsg.className = 'chat-msg bot';
            botMsg.innerHTML = `
                <div class="chat-msg-avatar">V</div>
                <div class="chat-msg-content">
                    <div class="chat-msg-bubble">${this.formatBotReply(data.reply)}</div>
                    <span class="chat-msg-time">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                </div>
            `;
            chatHistory.appendChild(botMsg);
            chatHistory.scrollTop = chatHistory.scrollHeight;

            // Add to conversation history
            this.conversationHistory.push({ role: 'assistant', content: data.reply });

            if (isHomeVoice) {
                this.showFaceSubtitle(data.reply);
            }

            this.handleAIResponse(data);

        } catch (err) {
            console.error('[Chat] Fetch error:', err);
            const indicator = document.getElementById('typing-indicator');
            if (indicator) indicator.remove();
            
            const errMsgText = "*Bzzt* Connection failed! Check if the server is running. *whir*";
            const errorMsg = document.createElement('div');
            errorMsg.className = 'chat-msg bot';
            errorMsg.innerHTML = `
                <div class="chat-msg-avatar">V</div>
                <div class="chat-msg-content">
                    <div class="chat-msg-bubble">${errMsgText}</div>
                </div>
            `;
            chatHistory.appendChild(errorMsg);
            chatHistory.scrollTop = chatHistory.scrollHeight;

            if (isHomeVoice) {
                this.showFaceSubtitle(errMsgText);
            }
        }
    }

    showFaceSubtitle(text) {
        const subtitleEl = document.getElementById('face-subtitle');
        if (!subtitleEl) return;
        
        const cleanText = text
            .replace(/<[^>]*>/g, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1');
            
        subtitleEl.textContent = cleanText;
        subtitleEl.classList.add('show');
        
        if (this.subtitleTimeout) {
            clearTimeout(this.subtitleTimeout);
        }
        
        const displayTime = Math.max(3500, Math.min(8500, cleanText.length * 65));
        
        this.subtitleTimeout = setTimeout(() => {
            subtitleEl.classList.remove('show');
        }, displayTime);
    }

    formatBotReply(text) {
        if (!text) return '';
        // Simple markdown-like formatting
        return text
            .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    handleAIResponse(data) {
        // 1. Text-To-Speech
        if (typeof soundEngine !== 'undefined') {
            soundEngine.speak(data.reply, () => {
                // Once speech finishes, if continuous talk is active on Home, restart listening
                if (this.continuousTalk && this.currentPage === 'home') {
                    setTimeout(() => {
                        if (this.continuousTalk && this.currentPage === 'home' && !this.isRecording) {
                            this.startSpeechRecognition();
                        }
                    }, 1200);
                }
            });
        }

        // 2. Face Mood update
        if (this.face) {
            this.face.setMood(data.mood || 'happy', 15000); // Lock response mood for 15 seconds
            this.updateMoodLabel();
        }

        // 3. Physical BLE execution
        if (this.connected && data.action && data.action !== 'none') {
            const act = data.action.toLowerCase();
            if (act === 'dance') ble.playAnimation(0x03);
            else if (act === 'nod') ble.playAnimation(0x02);
            else if (act === 'shake') ble.playAnimation(0x01);
            else if (act === 'excited') ble.playAnimation(0x04);
            else if (act === 'shy') ble.playAnimation(0x05);
            else if (act === 'forward') ble.moveForward(this.maxSpeed);
            else if (act === 'backward') ble.moveBackward(this.maxSpeed);
            else if (act === 'left') ble.spinLeft(this.maxSpeed);
            else if (act === 'right') ble.spinRight(this.maxSpeed);
            else if (act === 'stop') ble.stop();
            
            if (['forward', 'backward', 'left', 'right'].includes(act)) {
                setTimeout(() => {
                    if (this.connected) ble.stop();
                }, 1500);
            }
        }
    }
}

// ─── Init ───
let app;
document.addEventListener('DOMContentLoaded', () => {
    window.app = new VilyApp();
    app = window.app;
});
