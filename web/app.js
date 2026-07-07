/**
 * LIK App — AI Study Companion Platform
 * Home (Face), AI Chat, Study Tools, RC Control, Settings
 */

class LikApp {
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
        this.rpsHands = null;
        this.rpsDetectInterval = null;
        this.rpsGameoverTimeout = null;
        this.simonGame = null;
        this.rcStream = null;
        this.headlightOn = false;
        this.studyTools = null;
        this.activeActionInterval = null;
        this.activeActionTimeout = null;
        let savedProvider = localStorage.getItem('lik-ai-provider');
        // Default to 'gemini' (best TTS + fastest chat) if not set
        if (!savedProvider) {
            savedProvider = 'gemini';
            localStorage.setItem('lik-ai-provider', 'gemini');
        }
        this.aiProvider = savedProvider;
        this.conversationHistory = [];
        this.activeMic = 'chat';
        this.subtitleTimeout = null;
        this.continuousTalk = false;
        this.voiceLanguage = localStorage.getItem('lik-voice-lang') || 'en-US';
        
        // Vision State Variables
        this.visionMode = false;
        this.visionTimer = null;
        this.cameraFacingMode = localStorage.getItem('lik-camera-facing') || 'user';
        this.visionStream = null;
        this.isScanning = false;
        this.isInitialBoot = true;
        
        // ═══════ NEW MODE STATE VARIABLES ═══════
        this.pomodoroInterval = null;
        this.pomodoroTimeLeft = 0;
        this.pomodoroState = 'focus'; // 'focus' or 'break'
        this.djMicStream = null;
        this.djAudioCtx = null;
        this.djInterval = null;
        
        // ═══════ AUTONOMOUS PATROL ═══════
        this.patrol = null;  // AutonomousPatrol instance
        
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
        this.setupActionShortcuts();
        this.setupNewModes();
        this.setupPatrol();
        this.updateMoodLabel();
        
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
        const menuBtn = document.getElementById('menu-btn');
        const closeBtn = document.getElementById('drawer-close-btn');
        const drawer = document.getElementById('control-drawer');

        if (menuBtn && drawer) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                drawer.classList.add('open');
                // Set default drawer tab to drive (RC)
                this.navigateTo('drive');
            });
        }

        if (closeBtn && drawer) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                drawer.classList.remove('open');
                this.currentPage = 'home';
            });
        }

        // Close drawer when clicking outside
        document.addEventListener('click', (e) => {
            if (drawer && drawer.classList.contains('open')) {
                if (!drawer.contains(e.target) && !menuBtn.contains(e.target)) {
                    drawer.classList.remove('open');
                    this.currentPage = 'home';
                }
            }
        });

        // Tab buttons inside drawer click events
        document.querySelectorAll('.drawer-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tab = btn.dataset.tab;
                if (tab) {
                    this.navigateTo(tab);
                }
            });
        });
    }
    
    navigateTo(pageId) {
        // Map old page names to new drawer tabs
        const tabMap = {
            home: 'home',
            chat: 'chat',
            rc: 'drive',
            drive: 'drive',
            settings: 'settings'
        };
        const activeTab = tabMap[pageId] || pageId;

        // Hide home page subtitle and deactivate talk mode when navigating away from home
        if (activeTab !== 'home') {
            this.continuousTalk = false;
            if (this.isRecording && this.activeMic === 'home') {
                this.stopVoiceRecording();
            }
            const subtitleEl = document.getElementById('face-subtitle');
            if (subtitleEl) subtitleEl.classList.remove('show');
            if (this.subtitleTimeout) {
                clearTimeout(this.subtitleTimeout);
            }
        }

        // Clean up camera stream if leaving drive (RC)
        if (activeTab !== 'drive' && this.rcStream) {
            this.rcStream.getTracks().forEach(track => track.stop());
            this.rcStream = null;
        }

        if (activeTab === 'home') {
            document.getElementById('control-drawer')?.classList.remove('open');
            this.currentPage = 'home';
        } else {
            // Open the drawer
            const drawer = document.getElementById('control-drawer');
            if (drawer) drawer.classList.add('open');

            // Toggle tab button active state
            document.querySelectorAll('.drawer-tab-btn').forEach(b => {
                if (b.dataset.tab === activeTab) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
            
            // Toggle tab panel visibility
            document.querySelectorAll('.drawer-tab-panel').forEach(p => {
                if (p.id === `panel-${activeTab}`) {
                    p.classList.add('active');
                } else {
                    p.classList.remove('active');
                }
            });

            this.currentPage = activeTab;

            // Focus chat input if chat tab is active
            if (activeTab === 'chat') {
                setTimeout(() => {
                    const input = document.getElementById('chat-text-input');
                    if (input) input.focus();
                }, 100);
            }
        }

        // Setup view state when navigating home
        if (pageId === 'home') {
            const toggle3d = document.getElementById('toggle-3d-view');
            const is3d = toggle3d && toggle3d.classList.contains('on');
            const faceCanvas = document.getElementById('face-canvas');
            const threeContainer = document.getElementById('three-container');
            
            if (is3d) {
                faceCanvas.classList.add('view-hidden');
                threeContainer.classList.remove('view-hidden');
                if (!this.threeView) {
                    this.threeView = new Robot3DView('three-container', 'face-canvas');
                    const bgVal = this.theme === 'light' ? 0xf5f6fa : 0x0a0a0f;
                    if (this.threeView.scene) {
                        this.threeView.scene.background.setHex(bgVal);
                        this.threeView.scene.fog.color.setHex(bgVal);
                    }
                }
            } else {
                threeContainer.classList.add('view-hidden');
                faceCanvas.classList.remove('view-hidden');
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
        
        // ═══════ LOOI Boot Animation — play wake-up sequence on startup ═══════
        this.face.playBootAnimation();
        this.face.onBootComplete = () => {
            if (this.isInitialBoot) {
                this.isInitialBoot = false;
                
                const lang = localStorage.getItem('lik-voice-lang') || 'en-US';
                const isTamil = lang.startsWith('ta');
                const greeting = {
                    en: "Hi, my name is Lik! How can I help you now?",
                    ta: "ஹாய், என் பெயர் லைக்! நான் இப்போது உங்களுக்கு எவ்வாறு உதவ வேண்டும்?"
                };
                const text = isTamil ? greeting.ta : greeting.en;

                this.showFaceSubtitle(text);

                const playGreeting = () => {
                    if (typeof soundEngine !== 'undefined') {
                        soundEngine.speak(text);
                    }
                };

                // If audio context is already unlocked, play immediately
                if (typeof soundEngine !== 'undefined' && soundEngine.ctx && soundEngine.ctx.state === 'running') {
                    playGreeting();
                } else {
                    // Otherwise, play on the first body click/interaction (e.g. click modal)
                    const unlockHandler = () => {
                        playGreeting();
                        document.body.removeEventListener('click', unlockHandler);
                        document.body.removeEventListener('touchstart', unlockHandler);
                    };
                    document.body.addEventListener('click', unlockHandler);
                    document.body.addEventListener('touchstart', unlockHandler);
                }
            }
        };
        const faceContainer = document.querySelector('.face-container');
        if (faceContainer) {
            faceContainer.classList.add('booting');
            setTimeout(() => faceContainer.classList.remove('booting'), 2000);
        }
        
        // Update mood label periodically
        setInterval(() => this.updateMoodLabel(), 1000);
        
        // Double-tap face to toggle pure fullscreen face mode
        let lastTap = 0;
        document.getElementById('face-canvas').addEventListener('click', () => {
            const now = Date.now();
            if (now - lastTap < 300) {
                document.body.classList.toggle('fullscreen-pure');
                setTimeout(() => {
                    if (this.face) {
                        this.face.setupCanvas();
                    }
                }, 100);
                const isFullscreen = document.body.classList.contains('fullscreen-pure');
                this.showToast(isFullscreen ? "Pure Face Active! Double-tap to show controls" : "Show controls button");
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
        this.theme = localStorage.getItem('lik-theme') || 'dark';
        
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
        localStorage.setItem('lik-theme', theme);
        
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
            faceCanvas.classList.add('view-hidden');
            threeContainer.classList.remove('view-hidden');
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
            threeContainer.classList.add('view-hidden');
            faceCanvas.classList.remove('view-hidden');
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

    triggerDanceAnimation(duration = 4.0) {
        if (this.face) {
            this.face.startDance(duration);
        }
        
        const wasIn2D = !document.getElementById('face-canvas').classList.contains('view-hidden');
        if (wasIn2D) {
            const faceCanvas = document.getElementById('face-canvas');
            const threeContainer = document.getElementById('three-container');
            if (faceCanvas && threeContainer) {
                faceCanvas.classList.add('view-hidden');
                threeContainer.classList.remove('view-hidden');
                
                if (!this.threeView) {
                    this.threeView = new Robot3DView('three-container', 'face-canvas');
                    const bgVal = this.theme === 'light' ? 0xf5f6fa : 0x0a0a0f;
                    if (this.threeView.scene) {
                        this.threeView.scene.background.setHex(bgVal);
                        this.threeView.scene.fog.color.setHex(bgVal);
                    }
                }
            }
        }
        
        if (this.threeView) {
            this.threeView.startDance(duration);
        }
        
        if (wasIn2D) {
            if (this.danceSwitchTimeout) {
                clearTimeout(this.danceSwitchTimeout);
            }
            this.danceSwitchTimeout = setTimeout(() => {
                if (this.currentPage === 'home') {
                    const faceCanvas = document.getElementById('face-canvas');
                    const threeContainer = document.getElementById('three-container');
                    const toggle3d = document.getElementById('toggle-3d-view');
                    const is3dCurrentlyOn = toggle3d && toggle3d.classList.contains('on');
                    
                    if (!is3dCurrentlyOn && faceCanvas && threeContainer) {
                        threeContainer.classList.add('view-hidden');
                        faceCanvas.classList.remove('view-hidden');
                        if (this.threeView) {
                            this.threeView.destroy();
                            this.threeView = null;
                        }
                        if (this.face) {
                            this.face.setupCanvas();
                        }
                    }
                }
            }, duration * 1000);
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
            this.showToast('Disconnected from LIK');
            this.face.setMood('sad');
            // Pause patrol on disconnect
            if (this.patrol && this.patrol.active) {
                this.patrol.pause('Disconnected');
            }
        };
        
        ble.onBattery = (percent) => {
            this.batteryPercent = percent;
            this.updateBatteryUI(percent);
        };
        
        ble.onMotorStatus = () => {};
        ble.onLog = () => {};
        
        // Cliff detection callback — autonomous patrol safety
        ble.onCliffDetected = (cliffCode) => {
            console.log(`[CLIFF] Received cliff event: 0x${cliffCode.toString(16)}`);
            if (this.patrol && this.patrol.active) {
                this.patrol.handleCliffEvent(cliffCode);
            }
            // Flash face surprise
            if (this.face) {
                this.face.setMood('surprised', 2000);
                this.updateMoodLabel();
            }
            const side = cliffCode === 0x03 ? 'BOTH' : cliffCode === 0x01 ? 'LEFT' : 'RIGHT';
            this.showToast(`⚠️ Cliff detected (${side})! Auto-reversing...`);
            if (typeof soundEngine !== 'undefined') soundEngine.playBeep(880, 200, 'square', 0.3);
        };
        
        // Connect button in modal
        document.getElementById('modal-connect-btn').addEventListener('click', () => this.connectBLE());
        document.getElementById('modal-cancel-btn').addEventListener('click', () => this.hideConnectModal());
        
        // Connection tap on top bar
        const bleStatusTap = document.getElementById('ble-status-tap');
        if (bleStatusTap) {
            bleStatusTap.addEventListener('click', () => {
                if (this.connected) {
                    this.disconnectBLE();
                } else {
                    this.showConnectModal();
                }
            });
        }
    }
    
    async connectBLE() {
        const btn = document.getElementById('modal-connect-btn');
        btn.classList.add('connecting');
        btn.innerHTML = '<i class="icon-pulse">📡</i> Connecting...';
        
        try {
            await ble.connect();
            this.hideConnectModal();
        } catch (err) {
            btn.classList.remove('connecting');
            btn.innerHTML = '<i data-lucide="bluetooth" style="display:inline-block; width:16px; height:16px; vertical-align:middle; margin-right:4px;"></i> Connect';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            if (err.message && err.message.includes('User cancelled')) {
                this.showToast('Connection cancelled');
            } else {
                this.showToast('Connection failed. Try again.');
            }
        }
    }
    
    async disconnectBLE() {
        await ble.disconnect();
        this.showToast('Disconnected');
    }
    
    showConnectModal() {
        const modal = document.getElementById('connect-modal');
        if (modal) modal.classList.add('show');
    }
    
    hideConnectModal() {
        const modal = document.getElementById('connect-modal');
        if (modal) modal.classList.remove('show');
        const btn = document.getElementById('modal-connect-btn');
        if (btn) {
            btn.classList.remove('connecting');
            btn.innerHTML = '<i data-lucide="bluetooth" style="display:inline-block; width:16px; height:16px; vertical-align:middle; margin-right:4px;"></i> Connect';
        }
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
    // Games module removed
    
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

        // Helper to bind RC Transmitter controls (Simultaneous Throttle & Steering tracking)
        this.activeThrottle = 'center';
        this.activeSteering = 'center';

        const updateControlState = () => {
            const t = this.activeThrottle;
            const s = this.activeSteering;
            let dir = 'center';
            
            if (t === 'forward') {
                if (s === 'left') dir = 'forward-left';
                else if (s === 'right') dir = 'forward-right';
                else dir = 'forward';
            } else if (t === 'backward') {
                if (s === 'left') dir = 'backward-left';
                else if (s === 'right') dir = 'backward-right';
                else dir = 'backward';
            } else { // t === 'center'
                if (s === 'left') dir = 'left';
                else if (s === 'right') dir = 'right';
                else dir = 'center';
            }
            this.sendMotorCommand(dir, this.maxSpeed);
        };

        const bindButton = (btnId, type, activeValue) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;

            const handlePress = (e) => {
                e.preventDefault();
                btn.classList.add('active');
                if (type === 'throttle') this.activeThrottle = activeValue;
                if (type === 'steering') this.activeSteering = activeValue;
                updateControlState();
            };

            const handleRelease = (e) => {
                e.preventDefault();
                btn.classList.remove('active');
                if (type === 'throttle' && this.activeThrottle === activeValue) {
                    this.activeThrottle = 'center';
                }
                if (type === 'steering' && this.activeSteering === activeValue) {
                    this.activeSteering = 'center';
                }
                updateControlState();
            };

            btn.addEventListener('mousedown', handlePress);
            btn.addEventListener('touchstart', handlePress, { passive: false });
            btn.addEventListener('mouseup', handleRelease);
            btn.addEventListener('mouseleave', handleRelease);
            btn.addEventListener('touchend', handleRelease);
        };

        // Bind Throttle & Steering sticks
        bindButton('rc-btn-up', 'throttle', 'forward');
        bindButton('rc-btn-down', 'throttle', 'backward');
        bindButton('rc-btn-left', 'steering', 'left');
        bindButton('rc-btn-right', 'steering', 'right');

        // Stop button (emergency stop)
        const stopBtn = document.getElementById('rc-btn-stop');
        if (stopBtn) {
            const handleStop = (e) => {
                e.preventDefault();
                stopBtn.classList.add('active');
                setTimeout(() => stopBtn.classList.remove('active'), 250);
                this.activeThrottle = 'center';
                this.activeSteering = 'center';
                this.sendMotorCommand('center', 0);
                if (this.connected) {
                    this.clearActionTimers();
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
        // Initialize Gemini model version dropdown selection
        const modelSelect = document.getElementById('gemini-model-select');
        if (modelSelect) {
            modelSelect.value = localStorage.getItem('lik-gemini-model') || 'gemini-2.5-flash';
        }

        // Initialize voice tone dropdown selection
        const voiceToneSelect = document.getElementById('setting-voice-tone');
        if (voiceToneSelect) {
            voiceToneSelect.value = localStorage.getItem('lik-voice-tone') || 'Puck';
            voiceToneSelect.addEventListener('change', () => {
                const val = voiceToneSelect.value;
                localStorage.setItem('lik-voice-tone', val);
                this.showToast(`Robot voice tone updated to: ${val}`);
            });
        }

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
                localStorage.setItem('lik-voice-lang', lang);
                
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

        // Initialize toggles from localStorage
        const soundsEnabled = localStorage.getItem('lik-sounds-enabled') !== 'false'; // default true
        const ttsEnabled = localStorage.getItem('lik-tts-enabled') !== 'false'; // default true
        const fastVoiceEnabled = localStorage.getItem('lik-fast-voice-enabled') === 'true'; // default false

        const toggleSounds = document.getElementById('toggle-sounds');
        if (toggleSounds) {
            if (soundsEnabled) toggleSounds.classList.add('on');
            else toggleSounds.classList.remove('on');
            if (typeof soundEngine !== 'undefined') soundEngine.soundEnabled = soundsEnabled;
        }

        const toggleTTS = document.getElementById('toggle-voice-tts');
        if (toggleTTS) {
            if (ttsEnabled) toggleTTS.classList.add('on');
            else toggleTTS.classList.remove('on');
            if (typeof soundEngine !== 'undefined') soundEngine.ttsEnabled = ttsEnabled;
        }

        const toggleFastVoice = document.getElementById('toggle-fast-voice');
        if (toggleFastVoice) {
            if (fastVoiceEnabled) toggleFastVoice.classList.add('on');
            else toggleFastVoice.classList.remove('on');
            if (typeof soundEngine !== 'undefined') soundEngine.useBrowserTTSOnly = fastVoiceEnabled;
        }

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
                    localStorage.setItem('lik-sounds-enabled', isOn ? 'true' : 'false');
                } else if (setting === 'Voice TTS') {
                    if (typeof soundEngine !== 'undefined') {
                        soundEngine.ttsEnabled = isOn;
                    }
                    localStorage.setItem('lik-tts-enabled', isOn ? 'true' : 'false');
                } else if (setting === 'Fast Voice') {
                    if (typeof soundEngine !== 'undefined') {
                        soundEngine.useBrowserTTSOnly = isOn;
                    }
                    localStorage.setItem('lik-fast-voice-enabled', isOn ? 'true' : 'false');
                } else if (setting === 'Vision Mode') {
                    this.toggleVisionMode(isOn);
                }
                
                this.showToast(`${setting}: ${isOn ? 'ON' : 'OFF'}`);
            });
        });

        // Camera Facing selection
        document.querySelectorAll('[data-facing]').forEach(btn => {
            if (btn.dataset.facing === this.cameraFacingMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
            
            btn.addEventListener('click', () => {
                const facing = btn.dataset.facing;
                this.cameraFacingMode = facing;
                localStorage.setItem('lik-camera-facing', facing);
                
                document.querySelectorAll('[data-facing]').forEach(b => {
                    if (b.dataset.facing === facing) b.classList.add('active');
                    else b.classList.remove('active');
                });
                
                this.showToast(`Camera set to: ${facing === 'user' ? 'Front (User)' : 'Back (Desk)'}`);
                
                // If vision camera is currently active, restart it to apply changes
                if (this.visionStream) {
                    this.stopVisionCamera();
                    this.startVisionCamera();
                }
            });
        });

        // Video PIP preview Camera Flip Button
        document.getElementById('vision-preview-flip-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const nextFacing = this.cameraFacingMode === 'user' ? 'environment' : 'user';
            this.cameraFacingMode = nextFacing;
            localStorage.setItem('lik-camera-facing', nextFacing);
            
            // Sync settings pane buttons
            document.querySelectorAll('[data-facing]').forEach(b => {
                if (b.dataset.facing === nextFacing) b.classList.add('active');
                else b.classList.remove('active');
            });
            
            this.showToast(`Camera flipped to: ${nextFacing === 'user' ? 'Front' : 'Back'}`);
            
            // Restart camera stream to apply changes
            if (this.visionStream) {
                this.stopVisionCamera();
                this.startVisionCamera();
            }
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
            this.showToast('LIK v2.0 — AI Study Companion Platform');
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

        // Save API keys & configurations
        document.getElementById('save-api-keys-btn')?.addEventListener('click', async () => {
            const geminiKey = document.getElementById('gemini-api-key-input')?.value.trim();
            const openaiKey = document.getElementById('openai-api-key-input')?.value.trim();
            const groqKey = document.getElementById('groq-api-key-input')?.value.trim();
            const geminiModel = document.getElementById('gemini-model-select')?.value || 'gemini-2.5-flash';

            try {
                const response = await fetch('/api/settings/keys', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ geminiKey, openaiKey, groqKey, geminiModel })
                });
                if (response.ok) {
                    localStorage.setItem('lik-gemini-model', geminiModel);
                    this.showToast('🔑 Settings & Keys saved!');
                } else {
                    this.showToast('Failed to save settings');
                }
            } catch (err) {
                this.showToast('Failed to save settings — check server');
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
                        <h3>Hey there, I'm LIK!</h3>
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

        // Secure Modal OK button
        document.getElementById('modal-secure-ok-btn')?.addEventListener('click', () => {
            document.getElementById('secure-modal')?.classList.remove('open');
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
        localStorage.setItem('lik-ai-provider', provider);
        
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
        
        // Safety guard: do not start recording if LIK is currently speaking or if synthesis is active
        if (window.speechSynthesis.speaking || (this.face && this.face.isSpeaking)) {
            console.log("[Speech] Guard triggered: LIK is speaking. Cannot start listening.");
            return;
        }
        
        try {
            this.speechRecog.start();
        } catch(err) {
            console.warn('[Speech] startSpeechRecognition failed:', err);
        }
    }

    setupActionShortcuts() {
        const actionButtons = document.querySelectorAll('.face-actions-container .face-action-btn');
        actionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.getAttribute('data-action');
                if (action) {
                    this.executeAction(action);
                }
            });
        });
    }

    executeAction(actionName) {
        const act = actionName.toLowerCase();
        
        if (act === 'dog') {
            if (this.face) {
                // Clear any other active modes first before entering dog mode
                this.cleanupActiveModes();
                
                this.face.dogMode = !this.face.dogMode;
                const isDog = this.face.dogMode;
                
                const dogBtn = document.getElementById('dog-mode-btn');
                if (dogBtn) {
                    if (isDog) {
                        dogBtn.classList.add('active');
                        dogBtn.style.color = '#00b894';
                        dogBtn.style.borderColor = '#00b894';
                        dogBtn.style.boxShadow = '0 0 15px rgba(0, 184, 148, 0.4)';
                    } else {
                        dogBtn.classList.remove('active');
                        dogBtn.style.color = '';
                        dogBtn.style.borderColor = '';
                        dogBtn.style.boxShadow = '';
                    }
                }
                
                if (isDog) {
                    this.face.setMood('excited', 10000);
                    if (typeof soundEngine !== 'undefined') {
                        soundEngine.playMoodSound('bark');
                    }
                    this.showToast('🐶 Dog Mode ON! Woof woof!');
                    
                    if (this.connected) {
                        this.clearActionTimers();
                        const playDogBehaviors = () => {
                            ble.playAnimation(0x03);
                            if (typeof soundEngine !== 'undefined') {
                                soundEngine.playMoodSound('bark');
                            }
                        };
                        playDogBehaviors();
                        this.activeActionInterval = setInterval(playDogBehaviors, 3000);
                        
                        this.activeActionTimeout = setTimeout(() => {
                            this.clearActionTimers();
                            if (this.connected) ble.stop();
                        }, 10000);
                    }
                } else {
                    this.face.setMood('happy', 3000);
                    this.showToast('🤖 Robot Mode active!');
                    this.clearActionTimers();
                    if (this.connected) {
                        ble.stop();
                    }
                }
                this.updateMoodLabel();
            }
            return;
        }

        // Clean up any running visual modes for new animations (except simple picker/themes)
        if (act !== 'colors' && act !== 'emotions') {
            this.cleanupActiveModes();
        }

        // Show command label on face canvas
        if (this.face) {
            this.face.showCommand(act.toUpperCase(), 10000);
        }

        // 1. Face animations
        if (this.face) {
            if (act === 'dance') {
                this.face.setMood('excited', 10000);
                this.triggerDanceAnimation(10.0);
            } else if (act === 'nod') {
                this.face.setMood('eureka', 10000);
                this.face.playNod();
            } else if (act === 'shake') {
                this.face.setMood('confused', 10000);
                this.face.playShake();
            } else if (act === 'excited') {
                this.face.setMood('excited', 10000);
            } else if (act === 'shy') {
                this.face.setMood('shy', 10000);
            } else if (act === 'curious') {
                this.face.setMood('curious', 10000);
            }
            
            // --- NEW MODES IMPLEMENTATION ---
            else if (act === 'karaoke') {
                this.face.startKaraoke();
                this.showToast('🎤 Karaoke Mode ON! Sing along!');
                if (typeof soundEngine !== 'undefined') soundEngine.playMoodSound('karaoke');
            } 
            else if (act === 'sleep') {
                this.face.startSleepMode();
                this.face.setMood('sleepy', 0, false, true);
                document.getElementById('sleep-mode-btn')?.classList.add('active');
                this.showToast('😴 Sleep mode active. Goodnight ZZZ...');
                if (typeof soundEngine !== 'undefined') soundEngine.playMoodSound('sleep');
            } 
            else if (act === 'love') {
                this.face.startLoveMode();
                this.face.setMood('love', 0, false, true);
                this.showToast('❤️ Spread the love! Feeling loved!');
                if (typeof soundEngine !== 'undefined') soundEngine.playMoodSound('love');
            } 
            else if (act === 'pong') {
                this.face.startPong();
                document.getElementById('pong-score-overlay')?.classList.add('show');
                document.getElementById('pong-mode-btn')?.classList.add('active');
                this.showToast('🕹️ Pong Game Started! Move cursor/drag screen to steer!');
                if (typeof soundEngine !== 'undefined') soundEngine.playMoodSound('pong_score');
            } 
            else if (act === 'rps') {
                this.startRPSGame();
            } 
            else if (act === 'colors') {
                const themeName = this.face.cycleColor();
                this.showToast(`🎨 Color Theme Swapped to: ${themeName}`);
                if (typeof soundEngine !== 'undefined') soundEngine.playMoodSound('color_cycle');
            } 
            else if (act === 'emotions') {
                document.getElementById('emotion-wheel-overlay')?.classList.add('show');
            } 
            else if (act === 'photo') {
                this.face.startPhotoMode();
                this.showToast('📸 Say cheese! 3... 2... 1...');
                setTimeout(() => {
                    if (typeof soundEngine !== 'undefined') soundEngine.playMoodSound('photo_shutter');
                    if (this.face) this.face.triggerPhotoFlash();
                    
                    // Take screenshot of canvas
                    setTimeout(() => {
                        const canvas = document.getElementById('face-canvas');
                        if (canvas) {
                            const link = document.createElement('a');
                            link.download = 'lik_robot_selfie.png';
                            link.href = canvas.toDataURL('image/png');
                            link.click();
                            this.showToast('💾 Selfie saved to your downloads!');
                        }
                        this.cleanupActiveModes();
                        if (this.face) this.face.setMood('happy', 3000);
                        this.updateMoodLabel();
                    }, 100);
                }, 3000);
            } 
            else if (act === 'story') {
                this.face.startStoryMode();
                this.showToast('🎭 Robot Story Mode started!');
                if (typeof soundEngine !== 'undefined') soundEngine.playMoodSound('story_start');
            } 
            else if (act === 'pomodoro') {
                this.face.isPomodoroMode = true;
                this.face.setMood('focused', 0, false, true);
                document.getElementById('pomodoro-overlay')?.classList.add('show');
                document.getElementById('pomodoro-mode-btn')?.classList.add('active');
                this.pomodoroTimeLeft = 25 * 60; // 25 minutes
                this.pomodoroState = 'focus';
                this.showToast('🍅 Focus session started for 25 minutes! You got this!');
                
                const timerText = document.getElementById('pomodoro-timer-text');
                const labelText = document.getElementById('pomodoro-label');
                if (timerText) timerText.textContent = '25:00';
                if (labelText) labelText.textContent = 'FOCUS TIME';

                this.pomodoroInterval = setInterval(() => {
                    this.pomodoroTimeLeft--;
                    if (this.pomodoroTimeLeft <= 0) {
                        if (this.pomodoroState === 'focus') {
                            this.pomodoroState = 'break';
                            this.pomodoroTimeLeft = 5 * 60; // 5 mins
                            if (labelText) labelText.textContent = 'BREAK TIME';
                            if (typeof soundEngine !== 'undefined') soundEngine.playMoodSound('pomodoro_break');
                            if (this.face) this.face.setMood('sleepy', 0, false, true);
                            this.showToast('☕ Take a 5-minute break!');
                        } else {
                            this.stopPomodoro();
                            if (typeof soundEngine !== 'undefined') soundEngine.playMoodSound('pomodoro_alarm');
                            this.showToast('🔔 Session complete! Great job!');
                        }
                    }
                    const mins = Math.floor(this.pomodoroTimeLeft / 60).toString().padStart(2, '0');
                    const secs = (this.pomodoroTimeLeft % 60).toString().padStart(2, '0');
                    if (timerText) timerText.textContent = `${mins}:${secs}`;
                }, 1000);
            } 
            else if (act === 'dj') {
                document.getElementById('dj-mode-btn')?.classList.add('active');
                this.showToast('🎵 DJ Mode Active! Visualizing audio levels...');
                if (typeof soundEngine !== 'undefined') soundEngine.playMoodSound('dj_drop');
                
                // Get microphone
                navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                    .then(stream => {
                        this.djMicStream = stream;
                        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                        this.djAudioCtx = new AudioContextClass();
                        const source = this.djAudioCtx.createMediaStreamSource(stream);
                        const analyser = this.djAudioCtx.createAnalyser();
                        analyser.fftSize = 64;
                        source.connect(analyser);
                        
                        const bufferLength = analyser.frequencyBinCount;
                        const dataArray = new Uint8Array(bufferLength);
                        
                        if (this.face) {
                            this.face.startDJMode(analyser, dataArray);
                        }
                    })
                    .catch(err => {
                        console.warn('[DJ] Microphone access denied, running visual simulation.', err);
                        if (this.face) {
                            this.face.startDJMode(null, null); // Fallback simulated EQ
                        }
                    });
            }

            this.updateMoodLabel();
        }

        // 2. Physical BLE execution
        if (this.connected) {
            this.clearActionTimers();

            const playCmd = () => {
                if (act === 'dance' || act === 'karaoke' || act === 'dj') ble.playAnimation(0x03); // Dance
                else if (act === 'nod' || act === 'pomodoro' || act === 'photo') ble.playAnimation(0x02); // Nod
                else if (act === 'shake') ble.playAnimation(0x01); // Shake
                else if (act === 'excited' || act === 'love') ble.playAnimation(0x04); // Excited
                else if (act === 'shy' || act === 'sleep') ble.playAnimation(0x05); // Shy/Sleepy
                else if (act === 'forward') ble.moveForward(this.maxSpeed);
                else if (act === 'backward') ble.moveBackward(this.maxSpeed);
                else if (act === 'left') ble.spinLeft(this.maxSpeed);
                else if (act === 'right') ble.spinRight(this.maxSpeed);
                else if (act === 'stop') ble.stop();
            };

            // Play initially
            playCmd();

            // Set up repetition for short animation cycles to fill the window
            let repeatInterval = 0;
            if (act === 'dance' || act === 'karaoke' || act === 'dj') repeatInterval = 2200; // Dance keyframes are ~2.3s
            else if (act === 'excited' || act === 'love') repeatInterval = 1200; // Excited keyframes are ~1.3s
            else if (act === 'nod') repeatInterval = 750; // Nod is ~0.8s
            else if (act === 'shake') repeatInterval = 650; // Shake is ~0.7s
            else if (act === 'shy' || act === 'sleep') repeatInterval = 1450; // Shy is ~1.5s

            if (repeatInterval > 0) {
                this.activeActionInterval = setInterval(() => {
                    if (this.connected) playCmd();
                }, repeatInterval);
            }

            // Stop simple actions after 10 seconds (Persistent modes stay active until manually cancelled)
            const isPersistent = ['sleep', 'pong', 'dj', 'pomodoro', 'rps'].includes(act);
            const isColorOrEmotion = ['colors', 'emotions'].includes(act);
            
            if (isColorOrEmotion) {
                // Play once, clear repeat interval immediately
                if (this.activeActionInterval) {
                    clearInterval(this.activeActionInterval);
                }
            } else if (!isPersistent) {
                let duration = 10000;
                if (act === 'story') {
                    duration = 28000; // Let the entire 28s story finish
                }
                this.activeActionTimeout = setTimeout(() => {
                    this.clearActionTimers();
                    if (this.connected) {
                        ble.stop();
                        ble.stopAnimation();
                    }
                }, duration);
            }
        } else {
            this.showToast(`Action "${act}" played locally (Connect Bluetooth to move robot)`);
        }
    }

    clearActionTimers() {
        if (this.activeActionInterval) {
            clearInterval(this.activeActionInterval);
            this.activeActionInterval = null;
        }
        if (this.activeActionTimeout) {
            clearTimeout(this.activeActionTimeout);
            this.activeActionTimeout = null;
        }
    }

    setupNewModes() {
        // Pomodoro Close
        const pomodoroStopBtn = document.getElementById('pomodoro-stop-btn');
        if (pomodoroStopBtn) {
            pomodoroStopBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.stopPomodoro();
            });
        }

        // Pong Exit
        const pongExitBtn = document.getElementById('pong-exit-btn');
        if (pongExitBtn) {
            pongExitBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.stopPongGame();
            });
        }

        // RPS Exit
        const rpsExitBtn = document.getElementById('rps-exit-btn');
        if (rpsExitBtn) {
            rpsExitBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.stopRPSGame();
            });
        }

        // Emotion Wheel Picker
        const emotionItems = document.querySelectorAll('.emotion-item');
        emotionItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const emotion = item.getAttribute('data-emotion');
                if (emotion && this.face) {
                    this.face.setMood(emotion, 10000);
                    this.updateMoodLabel();
                    this.showToast(`Robot feeling: ${this.face.getMoodLabel()}!`);
                    document.getElementById('emotion-wheel-overlay')?.classList.remove('show');
                }
            });
        });

        const emotionWheelClose = document.getElementById('emotion-wheel-close');
        if (emotionWheelClose) {
            emotionWheelClose.addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('emotion-wheel-overlay')?.classList.remove('show');
            });
        }

        // Keyboard Pong Controls
        window.addEventListener('keydown', (e) => {
            if (this.face && this.face.isPongMode) {
                if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                    e.preventDefault();
                    this.face.targetPupilY = Math.max(-0.9, this.face.targetPupilY - 0.18);
                } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                    e.preventDefault();
                    this.face.targetPupilY = Math.min(0.9, this.face.targetPupilY + 0.18);
                }
            }
        });
    }

    // ─────────────────────────────────────
    //  Autonomous Patrol Setup
    // ─────────────────────────────────────
    
    setupPatrol() {
        // Create patrol engine instance
        this.patrol = new AutonomousPatrol(this);
        
        // Patrol toggle button
        const toggleBtn = document.getElementById('patrol-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // If patrol is paused (e.g. after disconnect), resume
                if (this.patrol.active && this.patrol.paused && this.connected) {
                    this.patrol.resume();
                    return;
                }
                
                this.patrol.toggle();
            });
        }
        
        // Pattern chip selectors
        document.querySelectorAll('.patrol-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const pattern = chip.dataset.pattern;
                if (!pattern) return;
                
                // Update active chip
                document.querySelectorAll('.patrol-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                
                this.patrol.pattern = pattern;
                
                // If currently patrolling, restart with new pattern
                if (this.patrol.active && !this.patrol.paused) {
                    this.patrol.stop();
                    setTimeout(() => this.patrol.start(), 300);
                }
            });
        });
        
        // Patrol speed slider
        const patrolSpeedSlider = document.getElementById('patrol-speed-slider');
        const patrolSpeedVal = document.getElementById('patrol-speed-val');
        if (patrolSpeedSlider) {
            patrolSpeedSlider.addEventListener('input', (e) => {
                const pct = parseInt(e.target.value);
                this.patrol.speed = pct;
                if (patrolSpeedVal) patrolSpeedVal.textContent = `${pct}%`;
            });
        }
    }

    stopPomodoro() {
        if (this.pomodoroInterval) {
            clearInterval(this.pomodoroInterval);
            this.pomodoroInterval = null;
        }
        document.getElementById('pomodoro-overlay')?.classList.remove('show');
        if (this.face) {
            this.face.isPomodoroMode = false;
            this.face.setMood('happy', 3000);
        }
        this.showToast('🍅 Pomodoro Timer Stopped!');
        this.updateMoodLabel();
        
        // Remove active state from button
        document.getElementById('pomodoro-mode-btn')?.classList.remove('active');
    }

    stopPongGame() {
        if (this.face) {
            this.face.stopPong();
            this.face.setMood('happy', 3000);
        }
        document.getElementById('pong-score-overlay')?.classList.remove('show');
        this.showToast('🕹️ Pong Game Over!');
        this.updateMoodLabel();
        
        // Remove active state from button
        document.getElementById('pong-mode-btn')?.classList.remove('active');
    }

    // ─── RPS Game ───
    async startRPSGame() {
        // Start camera
        const camOk = await this.startVisionCamera();
        if (!camOk) {
            this.showToast('⚠️ Camera required for Rock Paper Scissors!');
            return;
        }
        
        // Start face RPS mode
        this.face.startRPS();
        document.getElementById('rps-overlay')?.classList.add('show');
        document.getElementById('rps-mode-btn')?.classList.add('active');
        this.showToast('✌️ Rock Paper Scissors! Show your hand to the camera!');
        
        // Initialize MediaPipe Hands (if available)
        this._initRPSHandDetection();
        
        // Monitor for gameover
        this._monitorRPSGameover();
    }
    
    _initRPSHandDetection() {
        // Use MediaPipe Hands if loaded from CDN
        if (typeof Hands !== 'undefined') {
            try {
                this.rpsHands = new Hands({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
                });
                this.rpsHands.setOptions({
                    maxNumHands: 1,
                    modelComplexity: 0, // Fastest model
                    minDetectionConfidence: 0.6,
                    minTrackingConfidence: 0.5
                });
                
                this.rpsHands.onResults((results) => {
                    this._onRPSHandResults(results);
                });
                
                // Start detection loop when face enters 'detect' phase
                this.rpsDetectInterval = setInterval(() => {
                    if (this.face && this.face.isRPSMode && this.face.rpsPhase === 'detect' && !this.face.rpsPlayerChoice) {
                        const video = document.getElementById('vision-video');
                        if (video && video.readyState >= 2 && this.rpsHands) {
                            this.rpsHands.send({ image: video }).catch(() => {});
                        }
                    }
                }, 300);
                
                console.log('[RPS] MediaPipe Hands initialized');
            } catch (err) {
                console.warn('[RPS] MediaPipe init failed, using fallback:', err);
                this._initRPSFallbackDetection();
            }
        } else {
            console.log('[RPS] MediaPipe not available, using canvas fallback');
            this._initRPSFallbackDetection();
        }
    }
    
    _initRPSFallbackDetection() {
        // Fallback: Simple skin-color pixel counting from camera frame
        // More skin pixels = open hand (paper), less = fist (rock), medium = scissors
        this.rpsDetectInterval = setInterval(() => {
            if (this.face && this.face.isRPSMode && this.face.rpsPhase === 'detect' && !this.face.rpsPlayerChoice) {
                const video = document.getElementById('vision-video');
                if (video && video.readyState >= 2) {
                    this._detectGestureFallback(video);
                }
            }
        }, 500);
    }
    
    _onRPSHandResults(results) {
        if (!this.face || !this.face.isRPSMode || this.face.rpsPhase !== 'detect' || this.face.rpsPlayerChoice) return;
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            const gesture = this._classifyHandGesture(landmarks);
            if (gesture) {
                this.face.rpsSetPlayerChoice(gesture);
                this.showToast(`You showed: ${this.face.rpsEmojis[gesture]} ${gesture.toUpperCase()}`);
            }
        }
    }
    
    _classifyHandGesture(landmarks) {
        // Count extended fingers using landmark positions
        // Finger tip landmarks: thumb=4, index=8, middle=12, ring=16, pinky=20
        // Finger PIP landmarks: thumb=3, index=6, middle=10, ring=14, pinky=18
        let extendedFingers = 0;
        
        // Thumb: compare x position (tip vs IP joint) - different axis for thumb
        const thumbTip = landmarks[4];
        const thumbIP = landmarks[3];
        const wrist = landmarks[0];
        // Check if hand is right or left by comparing wrist to middle finger MCP
        const isRightHand = landmarks[17].x < wrist.x;
        if (isRightHand) {
            if (thumbTip.x < thumbIP.x) extendedFingers++;
        } else {
            if (thumbTip.x > thumbIP.x) extendedFingers++;
        }
        
        // Other fingers: compare y position (tip should be above PIP when extended)
        const fingerTips = [8, 12, 16, 20];
        const fingerPIPs = [6, 10, 14, 18];
        for (let i = 0; i < 4; i++) {
            if (landmarks[fingerTips[i]].y < landmarks[fingerPIPs[i]].y) {
                extendedFingers++;
            }
        }
        
        // Classify: 0-1 fingers = rock, 2 fingers = scissors, 3-5 fingers = paper
        if (extendedFingers <= 1) return 'rock';
        if (extendedFingers === 2) return 'scissors';
        return 'paper';
    }
    
    _detectGestureFallback(video) {
        // Simple fallback: capture frame, count skin-colored pixels
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 160, 120);
        const imageData = ctx.getImageData(0, 0, 160, 120);
        const data = imageData.data;
        
        let skinPixels = 0;
        const totalPixels = 160 * 120;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i+1], b = data[i+2];
            // Simple skin color detection (works for various skin tones)
            if (r > 80 && g > 40 && b > 20 && r > g && r > b && (r - g) > 15 && Math.abs(r - g) < 100) {
                skinPixels++;
            }
        }
        
        const skinRatio = skinPixels / totalPixels;
        
        // Classify based on skin pixel ratio
        let gesture;
        if (skinRatio > 0.15) gesture = 'paper';      // Open hand = lots of skin
        else if (skinRatio > 0.06) gesture = 'scissors'; // Partial = scissors
        else gesture = 'rock';                           // Fist = less skin
        
        this.face.rpsSetPlayerChoice(gesture);
        this.showToast(`You showed: ${this.face.rpsEmojis[gesture]} ${gesture.toUpperCase()}`);
    }
    
    _monitorRPSGameover() {
        // Check periodically if game has ended
        this.rpsGameoverTimeout = setInterval(() => {
            if (this.face && this.face.isRPSMode && this.face.rpsPhase === 'gameover' && this.face.rpsResultTimer >= 4.0) {
                this.stopRPSGame();
            }
        }, 500);
    }
    
    stopRPSGame() {
        // Stop detection
        if (this.rpsDetectInterval) {
            clearInterval(this.rpsDetectInterval);
            this.rpsDetectInterval = null;
        }
        if (this.rpsGameoverTimeout) {
            clearInterval(this.rpsGameoverTimeout);
            this.rpsGameoverTimeout = null;
        }
        
        // Close MediaPipe
        if (this.rpsHands) {
            this.rpsHands.close();
            this.rpsHands = null;
        }
        
        // Stop camera
        this.stopVisionCamera();
        
        // Stop face mode
        if (this.face) {
            // Announce final result
            if (this.face.rpsScorePlayer > this.face.rpsScoreCpu) {
                this.showToast('🏆 Congratulations! You won the game!');
                this.face.setMood('excited', 3000);
            } else if (this.face.rpsScorePlayer < this.face.rpsScoreCpu) {
                this.showToast('🤖 LIK wins! Better luck next time!');
                this.face.setMood('happy', 3000);
            } else {
                this.showToast('🤝 It\'s a tie! Great game!');
                this.face.setMood('surprised', 3000);
            }
            this.face.stopRPS();
        }
        
        // Hide overlay
        document.getElementById('rps-overlay')?.classList.remove('show');
        document.getElementById('rps-mode-btn')?.classList.remove('active');
        this.updateMoodLabel();
    }

    cleanupActiveModes() {
        this.clearActionTimers();
        
        // Stop Pomodoro if running
        if (this.pomodoroInterval) {
            clearInterval(this.pomodoroInterval);
            this.pomodoroInterval = null;
            document.getElementById('pomodoro-overlay')?.classList.remove('show');
            document.getElementById('pomodoro-mode-btn')?.classList.remove('active');
        }
        
        // Stop Pong and other modes on face
        if (this.face) {
            this.face.stopPong();
            this.face.stopRPS();
            this.face.stopSleepMode();
            this.face.stopLoveMode();
            this.face.stopKaraoke();
            this.face.stopStoryMode();
            this.face.stopDJMode();
            this.face.stopPhotoMode();
            this.face.isSleepMode = false;
            this.face.isLoveMode = false;
            this.face.isPongMode = false;
            this.face.isRPSMode = false;
            this.face.isPhotoMode = false;
            this.face.isStoryMode = false;
            this.face.isDJMode = false;
            this.face.isKaraoke = false;
            this.face.isPomodoroMode = false;
        }
        
        // Remove button highlights
        document.getElementById('sleep-mode-btn')?.classList.remove('active');
        document.getElementById('pong-mode-btn')?.classList.remove('active');
        document.getElementById('rps-mode-btn')?.classList.remove('active');
        document.getElementById('pomodoro-mode-btn')?.classList.remove('active');
        document.getElementById('dj-mode-btn')?.classList.remove('active');
        
        // Close overlays
        document.getElementById('pong-score-overlay')?.classList.remove('show');
        document.getElementById('rps-overlay')?.classList.remove('show');
        document.getElementById('emotion-wheel-overlay')?.classList.remove('show');
        
        // Clean up RPS resources
        if (this.rpsDetectInterval) {
            clearInterval(this.rpsDetectInterval);
            this.rpsDetectInterval = null;
        }
        if (this.rpsGameoverTimeout) {
            clearInterval(this.rpsGameoverTimeout);
            this.rpsGameoverTimeout = null;
        }
        if (this.rpsHands) {
            this.rpsHands.close();
            this.rpsHands = null;
        }
        
        // Clean up DJ mic audio
        if (this.djMicStream) {
            this.djMicStream.getTracks().forEach(t => t.stop());
            this.djMicStream = null;
        }
        if (this.djInterval) {
            clearInterval(this.djInterval);
            this.djInterval = null;
        }
        
        // Stop BLE movements if connected
        if (this.connected) {
            ble.stop();
            ble.stopAnimation();
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

        // Manual vision scan button click
        const visionBtn = document.getElementById('chat-vision-btn');
        if (visionBtn) {
            visionBtn.addEventListener('click', () => {
                if (this.isScanning) return;
                this.captureAndScan(false); // false = manual scan
            });
        }

        // Quick action chips
        document.querySelectorAll('.quick-chip[data-action]').forEach(chip => {
            chip.addEventListener('click', () => {
                const action = chip.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Setup voice recording triggers and buttons directly (no browser speechRecog dependency)
        micBtn.addEventListener('click', () => {
            if (this.isRecording && this.activeMic !== 'chat') {
                this.stopVoiceRecording();
                setTimeout(() => {
                    this.activeMic = 'chat';
                    this.startVoiceRecording();
                }, 200);
                return;
            }
            this.activeMic = 'chat';
            if (this.isRecording) {
                this.stopVoiceRecording();
            } else {
                this.startVoiceRecording();
            }
        });

        const faceMic = document.getElementById('face-mic-btn');
        if (faceMic) {
            faceMic.addEventListener('click', (e) => {
                e.stopPropagation();
                this.activeMic = 'home';
                
                if (this.continuousTalk) {
                    this.continuousTalk = false;
                    if (this.isRecording) {
                        this.stopVoiceRecording();
                    }
                    this.showToast('💬 Talk mode deactivated');
                } else {
                    this.continuousTalk = true;
                    this.showToast('💬 Talk mode activated');
                    if (!this.isRecording) {
                        this.startVoiceRecording();
                    }
                }
            });
        }
    }

    startSpeechRecognition() {
        this.startVoiceRecording();
    }

    async startVoiceRecording() {
        if (this.isRecording || this.isTranscribing) return;

        // Safety guard: do not start recording if LIK is currently speaking
        const isLikSpeaking = 
            window.speechSynthesis.speaking ||
            (typeof soundEngine !== 'undefined' && soundEngine._isSpeakingNeural) ||
            (this.face && this.face.isSpeaking);

        if (isLikSpeaking) {
            console.log("[Speech] Guard triggered: LIK is speaking. Cannot start listening.");
            return;
        }

        const micBtn = document.getElementById('chat-mic-btn');
        const faceMic = document.getElementById('face-mic-btn');

        try {
            this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Set up Audio Context and Analyser for visualizer
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass();
            const source = this.audioContext.createMediaStreamSource(this.audioStream);
            this.audioAnalyser = this.audioContext.createAnalyser();
            this.audioAnalyser.fftSize = 256;
            source.connect(this.audioAnalyser);

            // Set up Media Recorder with optimized bitrate (24kbps) to reduce size and latency
            this.audioChunks = [];
            let options = { 
                mimeType: 'audio/webm',
                audioBitsPerSecond: 24000
            };
            if (!MediaRecorder.isTypeSupported('audio/webm')) {
                options = { 
                    mimeType: 'audio/mp4',
                    audioBitsPerSecond: 24000
                };
            }
            this.mediaRecorder = new MediaRecorder(this.audioStream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                await this.processRecordedAudio();
            };

            this.isRecording = true;
            this.recordingStartTime = Date.now(); // Store start time for silence guard
            this.mediaRecorder.start();

            // UI updates
            if (this.activeMic === 'home') {
                faceMic?.classList.add('listening');
            } else {
                micBtn?.classList.add('recording');
            }

            this.lastInteractionTime = Date.now();

            // Force face mood to curious (listening) and lock it, suppress the curious chime
            if (this.face) {
                // If in continuous talk mode, keep the current emotion/expression rather than jumping to curious
                if (!this.continuousTalk) {
                    this.face.setMood('curious', 30000, false);
                }
                this.updateMoodLabel();
            }

            // Animate waveform
            const canvas = document.getElementById('voice-wave-canvas');
            if (canvas) {
                canvas.style.opacity = '1';
                this.drawVoiceWaveform();
            }

            // Start silence detection loop
            this.setupSilenceDetection();
            this.showToast("Listening...");

        } catch (err) {
            console.error('[Voice] Error starting recording:', err);
            this.showSecureModal();
        }
    }

    setupSilenceDetection() {
        if (!this.audioAnalyser) return;
        const bufferLength = this.audioAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        let silenceStart = null;
        const check = () => {
            if (!this.isRecording) return;

            // Ignore silence checks during the first 1.5 seconds of recording to let it stabilize
            if (Date.now() - this.recordingStartTime < 1500) {
                setTimeout(check, 100);
                return;
            }

            this.audioAnalyser.getByteTimeDomainData(dataArray);
            
            // Calculate Root Mean Square (RMS) volume
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                const val = (dataArray[i] - 128) / 128;
                sum += val * val;
            }
            const rms = Math.sqrt(sum / bufferLength);

            // Silence threshold (Reduced sensitivity: 0.006 instead of 0.015)
            if (rms < 0.006) {
                if (silenceStart === null) {
                    silenceStart = Date.now();
                } else if (Date.now() - silenceStart > 2500) { // 2.5 seconds of silence (Longer pause allowed!)
                    console.log("[Voice] Silence detected. Stopping recording.");
                    this.stopVoiceRecording();
                    return;
                }
            } else {
                silenceStart = null; // reset silence timer
            }

            setTimeout(check, 100);
        };
        
        check();
    }

    drawVoiceWaveform() {
        const canvas = document.getElementById('voice-wave-canvas');
        if (!canvas || !this.isRecording || !this.audioAnalyser) return;

        const ctx = canvas.getContext('2d');
        const bufferLength = this.audioAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Adjust canvas visual resolution based on its bounding box
        canvas.width = canvas.clientWidth * window.devicePixelRatio;
        canvas.height = canvas.clientHeight * window.devicePixelRatio;

        const draw = () => {
            if (!this.isRecording || !this.audioAnalyser) {
                cancelAnimationFrame(this.waveAnimationId);
                return;
            }

            this.waveAnimationId = requestAnimationFrame(draw);
            this.audioAnalyser.getByteTimeDomainData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Scale dynamically based on canvas dimensions to support smaller visualizers
            const heightRatio = canvas.clientHeight > 0 ? (canvas.clientHeight / 65) : 1;
            const freqScale = canvas.clientWidth > 0 ? (280 / canvas.clientWidth) : 1;

            // Draw glowing golden waves matching LIK's design
            ctx.lineWidth = Math.max(1.5, 3 * heightRatio);
            ctx.shadowBlur = Math.max(4, 10 * heightRatio);
            
            const time = Date.now() * 0.004;

            // Draw 3 layers of waves for rich visual aesthetics
            const waves = [
                { amplitude: 22 * heightRatio, color: 'rgba(253, 150, 68, 0.75)', speed: 1.0, freq: 0.05 },
                { amplitude: 14 * heightRatio, color: 'rgba(254, 202, 87, 0.45)', speed: -1.5, freq: 0.03 },
                { amplitude: 8 * heightRatio, color: 'rgba(255, 255, 255, 0.25)', speed: 2.0, freq: 0.08 }
            ];

            waves.forEach(w => {
                ctx.strokeStyle = w.color;
                ctx.shadowColor = w.color;
                ctx.beginPath();

                for (let x = 0; x < canvas.width; x++) {
                    const index = Math.floor((x / canvas.width) * bufferLength);
                    const micVal = (dataArray[index] - 128) / 128;
                    const cssX = x / window.devicePixelRatio;
                    const angle = cssX * w.freq * freqScale + time * w.speed;
                    const envelope = Math.sin((x / canvas.width) * Math.PI);
                    
                    const y = (canvas.height / 2) + 
                              Math.sin(angle) * w.amplitude * envelope * (1 + micVal * 4);

                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            });
        };

        draw();
    }

    stopVoiceRecording() {
        if (!this.isRecording || !this.mediaRecorder) return;
        
        try {
            this.mediaRecorder.stop();
        } catch (e) {}
        this.isRecording = false;

        // UI Reset
        document.getElementById('face-mic-btn')?.classList.remove('listening');
        document.getElementById('chat-mic-btn')?.classList.remove('recording');

        // Hide waveform canvas
        const canvas = document.getElementById('voice-wave-canvas');
        if (canvas) canvas.style.opacity = '0';

        // Stop media stream tracks
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }

        // Close AudioContext
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }

        cancelAnimationFrame(this.waveAnimationId);
    }

    async processRecordedAudio() {
        if (this.audioChunks.length === 0) return;
        
        this.isTranscribing = true;
        this.showToast('🧠 Listening to your voice...');
        if (this.face) {
            // Keep current expression during transcription in continuous talk to reduce flickering
            if (!this.continuousTalk) {
                this.face.setMood('thinking', 15000, false); // suppress thinking sound
            }
            this.updateMoodLabel();
        }

        const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });
        
        // Convert Blob to Base64 to POST to our endpoint
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64Audio = reader.result.split(',')[1];
            
            try {
                const response = await fetch('/api/transcribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        audio: base64Audio,
                        mimeType: this.mediaRecorder.mimeType,
                        provider: this.aiProvider,
                        language: this.voiceLanguage
                    })
                });

                if (!response.ok) {
                    throw new Error(`Server status ${response.status}`);
                }

                const data = await response.json();
                const text = data.text ? data.text.trim() : '';

                if (text && text.length > 1) {
                    this.showToast(`Voice: "${text}"`);
                    const wasCommand = await this.checkVoiceCommand(text, this.activeMic === 'home');
                    if (!wasCommand) {
                        if (this.activeMic === 'home') {
                            this.sendChatMessage(text, true);
                        } else {
                            const textInput = document.getElementById('chat-text-input');
                            if (textInput) textInput.value = text;
                            this.sendChatMessage(text, false);
                            if (textInput) textInput.value = '';
                        }
                    }
                } else {
                    this.showToast("No speech detected. Try again!");
                    if (this.face) this.face.setMood('confused', 2000);
                }

            } catch (err) {
                console.error('[Voice] Transcription failed:', err);
                this.showToast('⚠️ Audio processing failed. Try typing!');
                if (this.face) this.face.setMood('confused', 2000);
            } finally {
                this.isTranscribing = false;
                
                // Only auto-restart listening if NOT currently speaking (either neural or browser)
                const isSpeakingNow = () =>
                    (typeof soundEngine !== 'undefined' && soundEngine._isSpeakingNeural) ||
                    window.speechSynthesis.speaking ||
                    (this.face && this.face.isSpeaking);

                // If continuous talk is active and AI is NOT currently speaking, restart listening
                if (this.continuousTalk && this.currentPage === 'home' && !isSpeakingNow()) {
                    setTimeout(() => {
                        if (this.continuousTalk && this.currentPage === 'home' && !this.isRecording && !isSpeakingNow()) {
                            this.startVoiceRecording();
                        }
                    }, 800);
                }
            }
        };
    }

    async checkVoiceCommand(text, isHomeVoice = false) {
        const clean = text.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"");
        
        // Define commands mapping
        const commands = [
            {
                keywords: ['dance', 'dancer', 'dancing', 'ஆடு', 'நடனம்', 'wiggle', 'wobble'],
                action: () => {
                    this.triggerDanceAnimation(4.0);
                    this.face.showCommand('🕺 DANCE 🕺', 4000);
                },
                reply: {
                    en: "Woohoo! Let's get groovy and dance! Feel the beat!",
                    ta: "ஆஹா! நான் நடனமாடப் போகிறேன்! என் ஆட்டத்தைப் பாருங்கள்!"
                }
            },
            {
                keywords: ['sleep', 'sleepy', 'go to sleep', 'good night', 'tired', 'thoongu', 'தூங்கு', 'தூக்கம்'],
                action: () => {
                    this.face.setMood('sleepy', 10000, true, true);
                    this.face.showCommand('💤 SLEEPY 💤', 4000);
                },
                reply: {
                    en: "Yawn... I'm so sleepy. Good night!",
                    ta: "ஆஆஹ்... எனக்கு மிகவும் தூக்கம் வருகிறது. குட் நைட்!"
                }
            },
            {
                keywords: ['wake up', 'wake', 'wakeup', 'hello robot', 'hi robot', 'எழுந்திரு', 'விழி', 'wake up robot'],
                action: () => {
                    this.face.playBootAnimation();
                    this.face.showCommand('☀️ WAKE UP ☀️', 4000);
                },
                reply: {
                    en: "Wow! Good morning! I'm awake and ready to study!",
                    ta: "வணக்கம்! நான் விழித்துக்கொண்டேன், படிக்க தயார்!"
                }
            },
            {
                keywords: ['angry', 'mad', 'furious', 'hate you', 'bad robot', 'கோபம்', 'கோபமா'],
                action: () => {
                    this.face.setMood('angry', 5000, true, true);
                    this.face.showCommand('💢 ANGRY 💢', 4000);
                },
                reply: {
                    en: "Hmph! You are making me angry! Grrr...",
                    ta: "ஹ்ம்! எனக்கு மிகவும் கோபமாக இருக்கிறது!"
                }
            },
            {
                keywords: ['love', 'heart', 'i love you', 'love you', 'sweetheart', 'அன்பு', 'காதல்'],
                action: () => {
                    this.face.setMood('love', 5000, true, true);
                    this.face.showCommand('❤️ LOVE ❤️', 4000);
                },
                reply: {
                    en: "Aww, I love you too! You are the best companion!",
                    ta: "ஐ லவ் யூ டூ! நீங்கள் சிறந்த நண்பர்!"
                }
            },
            {
                keywords: ['happy', 'smile', 'santhosam', 'சிரி', 'மகிழ்ச்சி', 'be happy'],
                action: () => {
                    this.face.setMood('happy', 5000, true, true);
                    this.face.showCommand('😊 HAPPY 😊', 4000);
                },
                reply: {
                    en: "Hehehe! I'm super happy and smiling!",
                    ta: "ஹிஹிஹி! நான் மிகவும் மகிழ்ச்சியாக இருக்கிறேன்!"
                }
            },
            {
                keywords: ['excited', 'jump', 'bounce', 'super', 'awesome', 'துள்ளு', 'உற்சாகம்'],
                action: () => {
                    this.face.setMood('excited', 5000, true, true);
                    this.face.bounceVel = -5.0;
                    this.face.showCommand('⚡ EXCITED ⚡', 4000);
                },
                reply: {
                    en: "Oh my god! This is so exciting! Yeah!",
                    ta: "அற்புதம்! இது மிகவும் உற்சாகமாக இருக்கிறது!"
                }
            },
            {
                keywords: ['shy', 'blush', 'cute', 'வெட்கம்', 'vetkam'],
                action: () => {
                    this.face.setMood('shy', 5000, true, true);
                    this.face.showCommand('😳 SHY 😳', 4000);
                },
                reply: {
                    en: "Oh stop, you are making me blush!",
                    ta: "ஐயோ, எனக்கு வெட்கமாக இருக்கிறது!"
                }
            },
            {
                keywords: ['surprised', 'shocked', 'wow', 'really', 'ஆச்சரியம்', 'அதிசயம்'],
                action: () => {
                    this.face.setMood('surprised', 5000, true, true);
                    this.face.showCommand('😲 SURPRISED 😲', 4000);
                },
                reply: {
                    en: "Wow! No way! That is unbelievable!",
                    ta: "அப்படியா! என்னால் நம்பவே முடியவில்லை!"
                }
            },
            {
                keywords: ['thinking', 'think', 'yogi', 'யோசி'],
                action: () => {
                    this.face.setMood('thinking', 5000, true, true);
                    this.face.showCommand('🤔 THINKING 🤔', 4000);
                },
                reply: {
                    en: "Hmmm... let me ponder on that for a second.",
                    ta: "ம்ம்ம்... நான் அதைப்பற்றி யோசிக்கிறேன்."
                }
            },
            {
                keywords: ['eureka', 'idea', 'bulb', 'யோசனை'],
                action: () => {
                    this.face.setMood('eureka', 5000, true, true);
                    this.face.showCommand('💡 EUREKA! 💡', 4000);
                },
                reply: {
                    en: "Aha! I have got a bright idea! Check this out!",
                    ta: "ஆஹா! எனக்கு ஒரு அருமையான யோசனை தோன்றிவிட்டது!"
                }
            },
            {
                keywords: ['sad', 'cry', 'unhappy', 'அழு', 'வருத்தம்'],
                action: () => {
                    this.face.setMood('sad', 5000, true, true);
                    this.face.showCommand('😢 SAD 😢', 4000);
                },
                reply: {
                    en: "Aww... that makes me really sad. *sniff*",
                    ta: "ஐயோ... அது எனக்கு மிகவும் வருத்தத்தை அளிக்கிறது."
                }
            },
            {
                keywords: ['focused', 'focus', 'study', 'exam', 'concentrate', 'கவனம்', 'padi'],
                action: () => {
                    this.face.setMood('focused', 5000, true, true);
                    this.face.showCommand('🎯 FOCUSED 🎯', 4000);
                },
                reply: {
                    en: "Focus mode activated! Let's get to work.",
                    ta: "கவனம் செலுத்த வேண்டிய நேரம்! படிப்பைத் தொடங்குவோம்."
                }
            },
            {
                keywords: ['nod', 'yes', 'agree', 'சரி', 'ஆம்'],
                action: () => {
                    this.face.playNod();
                    this.face.showCommand('👍 NOD 👍', 3000);
                },
                reply: {
                    en: "Yes, I agree! I am nodding my head.",
                    ta: "ஆம், நான் ஒப்புக்கொள்கிறேன்!"
                }
            },
            {
                keywords: ['shake', 'no', 'disagree', 'இல்லை', 'கூடாது'],
                action: () => {
                    this.face.playShake();
                    this.face.showCommand('👎 SHAKE 👎', 3000);
                },
                reply: {
                    en: "No, I don't agree! Shaking my head no.",
                    ta: "இல்லை, நான் அதை ஏற்கவில்லை!"
                }
            },
            {
                keywords: ['look around', 'look', 'eyes', 'பார்', 'சுற்றிப்பார்'],
                action: () => {
                    this.face.targetPupilX = (Math.random() - 0.5) * 0.9;
                    this.face.targetPupilY = (Math.random() - 0.5) * 0.6;
                    this.face.showCommand('👀 LOOK AROUND 👀', 3000);
                },
                reply: {
                    en: "Looking around! My pupils are tracking.",
                    ta: "சுற்றிப் பார்க்கிறேன்! என் கண்கள் நகர்கின்றன."
                }
            },
            {
                keywords: ['what is this', 'what is in my hand', 'what do i have', 'identify object', 'detect object', 'identify', 'detect', 'what is that', 'what am i holding', 'holding', 'இது என்ன', 'என் கையில் என்ன', 'கண்டறி', 'பொருள்', 'பொருளைக் காண்க', 'என்ன வச்சிருக்கேன்', 'வச்சிருக்கேன்'],
                action: async () => {
                    this.showToast('📷 Opening camera...');
                    const success = await this.startVisionCamera();
                    if (!success) {
                        return;
                    }
                    
                    // Show a countdown/guidance on face canvas or subtitle
                    let countdown = 3;
                    const interval = setInterval(() => {
                        if (countdown > 0) {
                            const countdownText = {
                                en: `Show me the object... Scanning in ${countdown}`,
                                ta: `பொருளைக் காட்டுங்கள்... ${countdown} நொடியில்`
                            };
                            const isTamil = (localStorage.getItem('lik-voice-lang') || 'en-US').startsWith('ta');
                            this.showFaceSubtitle(isTamil ? countdownText.ta : countdownText.en);
                            if (typeof soundEngine !== 'undefined') {
                                soundEngine.playBeep(800, 100);
                            }
                            countdown--;
                        } else {
                            clearInterval(interval);
                            // Capture and scan
                            this.captureAndScan(false);
                        }
                    }, 1000);
                },
                reply: {
                    en: "Sure, let me open my camera. Please hold the object in front of LIK CAM!",
                    ta: "சரி, பார்க்கிறேன்! உங்கள் கையில் இருக்கும் பொருளை என் கேமராவில் காட்டுங்கள்!"
                }
            }
        ];

        // Find match
        let matchedCommand = null;
        for (const cmd of commands) {
            for (const keyword of cmd.keywords) {
                const isTamilKeyword = /[\u0B80-\u0BFF]/.test(keyword);
                if (isTamilKeyword) {
                    if (clean.includes(keyword)) {
                        matchedCommand = cmd;
                        break;
                    }
                } else {
                    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
                    if (regex.test(clean)) {
                        matchedCommand = cmd;
                        break;
                    }
                }
            }
            if (matchedCommand) break;
        }

        if (matchedCommand) {
            console.log(`[Voice Command] Intercepted keyword from: "${text}". Triggering action.`);
            
            // Execute animation action
            matchedCommand.action();

            // Set reply text based on current language
            const lang = localStorage.getItem('lik-voice-lang') || 'en-US';
            const isTamil = lang.startsWith('ta');
            const replyText = isTamil ? matchedCommand.reply.ta : matchedCommand.reply.en;

            // Render in chat bubble if panel is open or if we want it recorded
            const chatHistory = document.getElementById('chat-history');
            if (chatHistory) {
                // Hide welcome
                const welcome = document.getElementById('chat-welcome');
                if (welcome) welcome.style.display = 'none';

                const now = new Date();
                const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                // Append user command message
                const userMsg = document.createElement('div');
                userMsg.className = 'chat-msg user';
                userMsg.innerHTML = `
                    <div class="chat-msg-avatar">U</div>
                    <div class="chat-msg-content">
                        <div class="chat-msg-bubble">${this.escapeHtml(text)}</div>
                        <span class="chat-msg-time">${timeStr}</span>
                    </div>
                `;
                chatHistory.appendChild(userMsg);

                // Append bot response message with typing animation
                this.appendBotMessage(chatHistory, replyText, 'V', timeStr);

                // Add to conversation history
                this.conversationHistory.push({ role: 'user', content: text });
                this.conversationHistory.push({ role: 'assistant', content: replyText });
            }

            // Show subtitle on face
            if (isHomeVoice) {
                this.showFaceSubtitle(replyText);
            }

            // Speak response (Beep then Voice)
            if (typeof soundEngine !== 'undefined') {
                soundEngine.stopSpeaking();
                if (clean.includes('dance')) {
                    soundEngine.playBeep(900, 100, 'sine', 0.12, 1300);
                } else if (clean.includes('sleep')) {
                    soundEngine.playBeep(260, 400, 'sine', 0.06);
                } else {
                    soundEngine.playBeep(600, 100, 'sine', 0.08, 800);
                }
                
                setTimeout(() => {
                    soundEngine.speak(replyText);
                }, 200);
            }

            return true;
        }

        return false;
    }

    showSecureModal() {
        const modal = document.getElementById('secure-modal');
        const urlText = document.getElementById('insecure-url-text');
        
        if (modal) {
            if (urlText) {
                urlText.textContent = window.location.origin;
            }
            modal.classList.add('open');
            
            // Stop recording state just in case
            this.isRecording = false;
            document.getElementById('face-mic-btn')?.classList.remove('listening');
            document.getElementById('chat-mic-btn')?.classList.remove('recording');
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

        this.lastInteractionTime = Date.now();

        if (this.face && !isHomeVoice) {
            this.face.setMood('thinking', 10000, false);
            this.updateMoodLabel();
        }

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message,
                    provider: this.aiProvider,
                    history: this.conversationHistory.slice(-10),
                    voice_mode: isHomeVoice  // ← tells AI to reply in 1-2 short sentences
                })
            });

            // Remove typing indicator
            const indicator = document.getElementById('typing-indicator');
            if (indicator) indicator.remove();

            if (!response.ok) throw new Error('API request failed');
            const data = await response.json();

            // ── Prefetch TTS in parallel while rendering the chat bubble ──
            const voiceLang = localStorage.getItem('lik-voice-lang') || 'en-US';
            const ttsPromise = typeof soundEngine !== 'undefined'
                ? soundEngine.prefetchTTS(data.reply, voiceLang)
                : Promise.resolve(null);

            // Add bot response to UI with typing animation
            this.appendBotMessage(chatHistory, data.reply, 'V');

            // Add to conversation history
            this.conversationHistory.push({ role: 'assistant', content: data.reply });

            if (isHomeVoice) {
                this.showFaceSubtitle(data.reply);
            }

            // Pass the pre-fetched TTS promise so handleAIResponse can play instantly
            this.handleAIResponse(data, ttsPromise);

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

    appendBotMessage(chatHistory, text, avatar = 'V', timeStr = null) {
        if (!timeStr) {
            const now = new Date();
            timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        }
        const botMsg = document.createElement('div');
        botMsg.className = 'chat-msg bot';
        botMsg.innerHTML = `
            <div class="chat-msg-avatar">${avatar}</div>
            <div class="chat-msg-content">
                <div class="chat-msg-bubble"></div>
                <span class="chat-msg-time">${timeStr}</span>
            </div>
        `;
        chatHistory.appendChild(botMsg);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        const bubbleEl = botMsg.querySelector('.chat-msg-bubble');
        const words = text.split(' ');
        let wordIndex = 0;
        const typeInterval = setInterval(() => {
            if (wordIndex < words.length) {
                const currentText = words.slice(0, wordIndex + 1).join(' ');
                bubbleEl.innerHTML = this.formatBotReply(currentText);
                chatHistory.scrollTop = chatHistory.scrollHeight;
                wordIndex++;
            } else {
                clearInterval(typeInterval);
            }
        }, 60);
        return typeInterval;
    }

    showFaceSubtitle(text) {
        const subtitleEl = document.getElementById('face-subtitle');
        if (!subtitleEl) return;
        
        const cleanText = text
            .replace(/<[^>]*>/g, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1');
            
        if (this.subtitleInterval) {
            clearInterval(this.subtitleInterval);
        }
        
        subtitleEl.textContent = '';
        subtitleEl.classList.add('show');
        
        const words = cleanText.split(' ');
        let wordIndex = 0;
        
        this.subtitleInterval = setInterval(() => {
            if (wordIndex < words.length) {
                subtitleEl.textContent = words.slice(0, wordIndex + 1).join(' ');
                wordIndex++;
            } else {
                clearInterval(this.subtitleInterval);
                this.subtitleInterval = null;
            }
        }, 80); // 80ms per word represents a natural reading/speaking speed
        
        if (this.subtitleTimeout) {
            clearTimeout(this.subtitleTimeout);
        }
        
        const displayTime = Math.max(3500, Math.min(10000, cleanText.length * 65 + 1000));
        
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

    handleAIResponse(data, ttsPromise) {
        this.lastInteractionTime = Date.now();
        // 1. Text-To-Speech (Neural Gemini TTS with intelligent browser fallback)
        if (typeof soundEngine !== 'undefined') {
            const onSpeakEnd = () => {
                // ── Conversation loop: restart listening only after speech fully ends ──
                if (this.continuousTalk && this.currentPage === 'home') {
                    // Small gap after speech so the mic doesn't catch echo
                    setTimeout(() => {
                        if (this.continuousTalk && this.currentPage === 'home' && !this.isRecording) {
                            this.startVoiceRecording();
                        }
                    }, 600);
                }
            };

            if (ttsPromise) {
                soundEngine.speakWithPrefetch(data.reply, ttsPromise, onSpeakEnd);
            } else {
                soundEngine.speak(data.reply, onSpeakEnd);
            }
        }

        // 2. Face Mood update
        if (this.face) {
            this.face.setMood(data.mood || 'happy', 15000); // Lock response mood for 15 seconds
            this.updateMoodLabel();
        }

        // 3. ═══════ LOOI Face Animations + Physical BLE execution ═══════
        if (data.action && data.action !== 'none') {
            const act = data.action.toLowerCase();
            
            // Face-level animations (always play, even without BLE connection)
            if (this.face) {
                if (act === 'dance') this.triggerDanceAnimation(4.0);
                else if (act === 'nod') this.face.playNod();
                else if (act === 'shake') this.face.playShake();
                else if (act === 'spin_left' || act === 'spin_right') this.triggerDanceAnimation(2.0);
            }
            
            // Physical BLE execution (only when connected)
            if (this.connected) {
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

    // ─────────────────────────────────────────────
    //  Camera Vision & Reaction Methods
    // ─────────────────────────────────────────────

    async toggleVisionMode(isOn) {
        this.visionMode = isOn;
        const menuBtn = document.getElementById('menu-btn');

        if (isOn) {
            menuBtn?.classList.add('vision-active');
            const success = await this.startVisionCamera();
            if (success) {
                this.showToast('👁️ Vision active! LIK is watching your desk.');
                this.visionTimer = setInterval(() => {
                    if (this.visionMode && !this.isScanning) {
                        this.captureAndScan(true);
                    }
                }, 10000); // scan every 10 seconds
            } else {
                this.visionMode = false;
                document.getElementById('toggle-vision')?.classList.remove('on');
                menuBtn?.classList.remove('vision-active');
            }
        } else {
            menuBtn?.classList.remove('vision-active');
            clearInterval(this.visionTimer);
            this.visionTimer = null;
            this.stopVisionCamera();
            this.showToast('👁️ Vision mode deactivated');
        }
    }

    async startVisionCamera() {
        const video = document.getElementById('vision-video');
        const previewWrap = document.getElementById('vision-preview-wrap');
        if (!video) return false;

        try {
            const constraints = {
                video: {
                    facingMode: this.cameraFacingMode,
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.visionStream = stream;
            video.srcObject = stream;
            
            // Show PIP camera preview overlay
            if (previewWrap) {
                previewWrap.classList.add('show');
            }
            return true;
        } catch (err) {
            console.error('[Vision] Camera Access Error:', err);
            this.showToast('⚠️ Camera access denied! Check permissions.');
            return false;
        }
    }

    stopVisionCamera() {
        const video = document.getElementById('vision-video');
        const previewWrap = document.getElementById('vision-preview-wrap');
        if (video) video.srcObject = null;

        if (this.visionStream) {
            this.visionStream.getTracks().forEach(track => track.stop());
            this.visionStream = null;
        }

        // Hide PIP camera preview overlay
        if (previewWrap) {
            previewWrap.classList.remove('show');
        }
    }

    async captureAndScan(isContinuous = false) {
        const video = document.getElementById('vision-video');
        const visionBtn = document.getElementById('chat-vision-btn');

        // If manual scan and camera isn't running, start it temporarily
        let temporaryStream = false;
        if (!isContinuous && !this.visionStream) {
            this.isScanning = true;
            visionBtn?.classList.add('scanning');
            this.showToast('📷 Activating camera...');
            const success = await this.startVisionCamera();
            if (!success) {
                this.isScanning = false;
                visionBtn?.classList.remove('scanning');
                return;
            }
            // Wait 1 second for camera auto-focus / exposure
            await new Promise(resolve => setTimeout(resolve, 1000));
            temporaryStream = true;
        }

        this.isScanning = true;
        visionBtn?.classList.add('scanning');
        if (this.face) {
            this.face.setMood('thinking', 15000);
            this.updateMoodLabel();
        }

        try {
            // Take snapshot
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d');
            
            // Mirror image if front facing camera for logical orientation
            if (this.cameraFacingMode === 'user') {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

            // If it was a temporary stream, stop the camera now that we have the frame
            if (temporaryStream) {
                this.stopVisionCamera();
            }

            this.showToast('🔍 Analyzing desk...');
            const response = await fetch('/api/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: imageBase64,
                    provider: this.aiProvider
                })
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            const data = await response.json();
            
            // Log to chat history inside the panel
            const chatHistory = document.getElementById('chat-history');
            if (chatHistory) {
                // Hide welcome
                const welcome = document.getElementById('chat-welcome');
                if (welcome) welcome.style.display = 'none';

                const now = new Date();
                const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                // User visual action log
                const userMsg = document.createElement('div');
                userMsg.className = 'chat-msg user';
                userMsg.innerHTML = `
                    <div class="chat-msg-avatar">📷</div>
                    <div class="chat-msg-content">
                        <div class="chat-msg-bubble"><em>*Showed LIK the desk/camera*</em></div>
                        <div class="chat-msg-time">${timeStr}</div>
                    </div>
                `;
                chatHistory.appendChild(userMsg);

                // Assistant reply log with typing animation
                this.appendBotMessage(chatHistory, data.reply, '🤖', timeStr);
            }

            // Perform face mood and BLE motor movements
            this.handleAIResponse(data);
            
            // Show subtitle on the face screen
            this.showFaceSubtitle(data.reply);

        } catch (err) {
            console.error('[Vision] Analysis Failed:', err);
            this.showToast('⚠️ Scan failed! Offline or server error.');
            if (temporaryStream) {
                this.stopVisionCamera();
            }
        } finally {
            this.isScanning = false;
            visionBtn?.classList.remove('scanning');
        }
    }
}

// ═══════════════════════════════════════════════
//  AI Vision Autonomous Navigation Engine
//  Uses TensorFlow.js COCO-SSD + Visual Obstacle Grid
// ═══════════════════════════════════════════════

class VisionNavEngine {
    constructor(app, patrol) {
        this.app = app;
        this.patrol = patrol;
        this.enabled = true;
        this.isRunning = false;
        this.model = null;
        this.isLoadingModel = false;
        this.loopTimer = null;
        
        // Obstacle radar scores (0 to 100)
        this.zoneL = 0;
        this.zoneC = 0;
        this.zoneR = 0;
        
        this.lastDetectedObject = null;
        this.detectedBoxes = [];
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = 320;
        this.offscreenCanvas.height = 240;
    }
    
    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.updateBadge('active', '🟢 Vision Nav Active');
        this.updateActionText('Initializing mobile camera feed & AI models...');
        
        // Ensure rear camera is used for forward navigation
        if (this.app.cameraFacingMode !== 'environment') {
            this.app.cameraFacingMode = 'environment';
            if (this.app.visionStream) {
                this.app.stopVisionCamera();
            }
        }
        
        // Start camera if not running
        if (!this.app.visionStream) {
            const camOk = await this.app.startVisionCamera();
            if (!camOk) {
                this.updateBadge('warning', '🔴 Camera Error');
                this.updateActionText('Camera access denied. Falling back to blind patrol.');
                return;
            }
        }
        
        // Load TensorFlow.js COCO-SSD model if needed
        if (!this.model && !this.isLoadingModel) {
            this.isLoadingModel = true;
            this.updateBadge('active', '🟡 Loading COCO-SSD...');
            this.updateActionText('Loading neural network object detection model...');
            try {
                if (typeof cocoSsd !== 'undefined') {
                    this.model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
                    console.log('[VisionNav] COCO-SSD loaded successfully!');
                }
            } catch (err) {
                console.warn('[VisionNav] COCO-SSD load error:', err);
            } finally {
                this.isLoadingModel = false;
            }
        }
        
        this.updateBadge('active', '🟢 Active (AI + Grid)');
        this.updateActionText('Scanning environment for obstacles and pathways...');
        
        // Start processing loop (~5 FPS for vision AI and HUD rendering)
        this.loopTimer = setInterval(() => this.processFrame(), 200);
    }
    
    stop() {
        this.isRunning = false;
        if (this.loopTimer) {
            clearInterval(this.loopTimer);
            this.loopTimer = null;
        }
        this.updateBadge('', 'Standby');
        this.updateActionText('Select Explore & Start Patrol to enable visual guidance.');
        this.clearHUD();
        this.zoneL = 0;
        this.zoneC = 0;
        this.zoneR = 0;
        this.updateRadarUI();
    }
    
    async processFrame() {
        if (!this.isRunning || !this.app.visionStream) return;
        const video = document.getElementById('vision-video');
        if (!video || video.readyState < 2 || video.videoWidth === 0) return;
        
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        
        // 1. Run Computer Vision Floor Grid & Edge Density Analysis
        const ctx = this.offscreenCanvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 320, 240);
        const imgData = ctx.getImageData(0, 140, 320, 100).data; // lower 40% of frame (desk ahead)
        
        let edgeL = 0, edgeC = 0, edgeR = 0;
        let countL = 0, countC = 0, countR = 0;
        
        // Measure contrast variance (edges/obstacles/drop-offs) across Left, Center, Right zones
        for (let y = 0; y < 100 - 1; y += 4) {
            for (let x = 0; x < 320 - 1; x += 4) {
                const idx = (y * 320 + x) * 4;
                const idxRight = idx + 4;
                const idxDown = idx + 320 * 4;
                
                const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx+1] + 0.114 * imgData[idx+2];
                const lumR = 0.299 * imgData[idxRight] + 0.587 * imgData[idxRight+1] + 0.114 * imgData[idxRight+2];
                const lumD = 0.299 * imgData[idxDown] + 0.587 * imgData[idxDown+1] + 0.114 * imgData[idxDown+2];
                
                const edge = Math.abs(lum - lumR) + Math.abs(lum - lumD);
                
                if (x < 106) { edgeL += edge; countL++; }
                else if (x < 213) { edgeC += edge; countC++; }
                else { edgeR += edge; countR++; }
            }
        }
        
        // Normalize grid scores (baseline floor has low edge variance)
        let scoreL = Math.min(100, Math.round((edgeL / Math.max(1, countL)) * 1.8));
        let scoreC = Math.min(100, Math.round((edgeC / Math.max(1, countC)) * 1.8));
        let scoreR = Math.min(100, Math.round((edgeR / Math.max(1, countR)) * 1.8));
        
        // 2. Run TensorFlow.js Object Detection (COCO-SSD)
        this.detectedBoxes = [];
        this.lastDetectedObject = null;
        if (this.model) {
            try {
                const predictions = await this.model.detect(video);
                predictions.forEach(pred => {
                    if (pred.score < 0.45) return;
                    const [bx, by, bw, bh] = pred.bbox;
                    this.detectedBoxes.push(pred);
                    
                    // If object is in lower 70% of view (nearby on desk)
                    if (by + bh > vh * 0.3) {
                        const centerX = bx + bw / 2;
                        const obstacleWeight = Math.round(pred.score * 75);
                        this.lastDetectedObject = pred.class;
                        
                        if (centerX < vw * 0.33) {
                            scoreL = Math.max(scoreL, obstacleWeight);
                        } else if (centerX < vw * 0.66) {
                            scoreC = Math.max(scoreC, obstacleWeight);
                        } else {
                            scoreR = Math.max(scoreR, obstacleWeight);
                        }
                    }
                });
            } catch (err) {
                // Ignore transient TFJS detection errors
            }
        }
        
        // Smooth transitions with exponential moving average
        this.zoneL = Math.round(this.zoneL * 0.6 + scoreL * 0.4);
        this.zoneC = Math.round(this.zoneC * 0.6 + scoreC * 0.4);
        this.zoneR = Math.round(this.zoneR * 0.6 + scoreR * 0.4);
        
        this.updateRadarUI();
        this.drawHUD(vw, vh);
    }
    
    getNavigationDecision() {
        if (!this.isRunning || !this.app.visionStream) {
            return { action: 'fallback', reason: 'Vision offline — using standard exploration' };
        }
        
        // Dead end trap check
        if (this.zoneL > 65 && this.zoneC > 65 && this.zoneR > 65) {
            return {
                action: 'reverse_turn',
                reason: '⚠️ All zones blocked! Reversing out of dead end...',
                objectName: this.lastDetectedObject
            };
        }
        
        // Center blocked check
        if (this.zoneC >= 38) {
            const objText = this.lastDetectedObject ? `[${this.lastDetectedObject}]` : 'obstacle';
            if (this.zoneL < this.zoneR) {
                return {
                    action: 'steer_left',
                    reason: `🔴 Avoiding ${objText} ahead — Steering Left`,
                    objectName: this.lastDetectedObject
                };
            } else {
                return {
                    action: 'steer_right',
                    reason: `🔴 Avoiding ${objText} ahead — Steering Right`,
                    objectName: this.lastDetectedObject
                };
            }
        }
        
        // Clear path
        return {
            action: 'forward',
            reason: '🟢 Path clear — Cruising forward',
            objectName: null
        };
    }
    
    updateBadge(className, text) {
        const badge = document.getElementById('vision-nav-status-badge');
        if (!badge) return;
        badge.className = 'vision-nav-badge ' + className;
        badge.textContent = text;
    }
    
    updateActionText(text) {
        const el = document.getElementById('vision-nav-action-text');
        if (el) el.textContent = text;
    }
    
    updateRadarUI() {
        const updateBar = (id, val) => {
            const bar = document.getElementById(`radar-bar-${id}`);
            const label = document.getElementById(`radar-val-${id}`);
            if (!bar || !label) return;
            bar.style.width = `${val}%`;
            label.textContent = `${val}%`;
            if (val > 60) bar.style.backgroundColor = '#ff6b6b';
            else if (val > 35) bar.style.backgroundColor = '#feca57';
            else bar.style.backgroundColor = '#00b894';
        };
        updateBar('l', this.zoneL);
        updateBar('c', this.zoneC);
        updateBar('r', this.zoneR);
    }
    
    drawHUD(vw, vh) {
        const canvas = document.getElementById('vision-hud-canvas');
        if (!canvas) return;
        if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw;
            canvas.height = vh;
        }
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, vw, vh);
        
        // Draw 3 zone separators
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(vw * 0.33, 0); ctx.lineTo(vw * 0.33, vh);
        ctx.moveTo(vw * 0.66, 0); ctx.lineTo(vw * 0.66, vh);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw center targeting crosshair
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
        ctx.lineWidth = 1.5;
        const cx = vw / 2, cy = vh / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.moveTo(cx - 20, cy); ctx.lineTo(cx - 8, cy);
        ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 20, cy);
        ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy - 8);
        ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + 20);
        ctx.stroke();
        
        // Draw COCO-SSD bounding boxes
        this.detectedBoxes.forEach(pred => {
            const [bx, by, bw, bh] = pred.bbox;
            const isDanger = by + bh > vh * 0.35 && (bx + bw/2 > vw*0.25 && bx + bw/2 < vw*0.75);
            
            ctx.strokeStyle = isDanger ? '#ff6b6b' : '#00f0ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(bx, by, bw, bh);
            
            // Draw sci-fi label tab
            ctx.fillStyle = isDanger ? '#ff6b6b' : '#00f0ff';
            ctx.fillRect(bx, Math.max(0, by - 20), bw, 20);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(`${pred.class.toUpperCase()} ${Math.round(pred.score * 100)}%`, bx + 6, Math.max(14, by - 6));
        });
    }
    
    clearHUD() {
        const canvas = document.getElementById('vision-hud-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
}

// ═══════════════════════════════════════════════
//  Autonomous Patrol Engine
//  Runs entirely in the web app — sends BLE motor commands
// ═══════════════════════════════════════════════

class AutonomousPatrol {
    constructor(app) {
        this.app = app;
        this.visionNav = new VisionNavEngine(app, this);
        this.active = false;
        this.paused = false;
        this.pattern = 'explore';  // explore, zigzag, sentry, orbit
        this.speed = 40;           // 15-70 percent
        this.patrolTimer = null;
        this.stepTimer = null;
        this.statsTimer = null;
        this.idleTimer = null;
        this.cliffRecovering = false;
        
        // Stats
        this.startTime = 0;
        this.turnCount = 0;
        this.cliffCount = 0;
        
        // Pattern state
        this.currentStep = 0;
        this.zigzagLeft = true;
    }
    
    get pwmSpeed() {
        return Math.round((this.speed / 100) * 255);
    }
    
    // ─── Start / Stop ───
    
    start() {
        if (this.active) return;
        if (!this.app.connected) {
            this.app.showToast('⚡ Connect Bluetooth first!');
            this.app.showConnectModal();
            return;
        }
        
        this.active = true;
        this.paused = false;
        this.cliffRecovering = false;
        this.startTime = Date.now();
        this.turnCount = 0;
        this.cliffCount = 0;
        this.currentStep = 0;
        this.zigzagLeft = true;
        
        // Tell firmware to enable autonomous cliff safety
        ble.setAutonomous(true);
        
        // Update UI
        this.updateUI('patrolling');
        this.app.showToast(`🛰️ Patrol started — ${this.pattern.toUpperCase()} mode`);
        
        // Set face mood
        if (this.app.face) {
            const moodMap = { explore: 'curious', zigzag: 'excited', sentry: 'focused', orbit: 'curious' };
            this.app.face.setMood(moodMap[this.pattern] || 'curious', 0, false, true);
            this.app.updateMoodLabel();
        }
        
        // Start the patrol loop
        this.runPatrolStep();
        
        // Start stats counter
        this.statsTimer = setInterval(() => this.updateStatsUI(), 1000);
        
        // Start idle personality (random animations every 15-30s)
        this.scheduleIdleBehavior();
        
        // Start AI Vision Nav if in explore mode
        if (this.pattern === 'explore' && this.visionNav) {
            this.visionNav.start();
        } else if (this.visionNav) {
            this.visionNav.stop();
        }
        
        if (typeof soundEngine !== 'undefined') soundEngine.playBeep(523, 150, 'sine', 0.15);
    }
    
    stop() {
        this.active = false;
        this.paused = false;
        this.cliffRecovering = false;
        
        // Clear all timers
        clearTimeout(this.stepTimer);
        clearTimeout(this.idleTimer);
        clearInterval(this.statsTimer);
        this.stepTimer = null;
        this.idleTimer = null;
        this.statsTimer = null;
        
        // Stop motors
        if (this.app.connected) {
            ble.stop();
            ble.setAutonomous(false);
        }
        
        if (this.visionNav) this.visionNav.stop();
        
        // Update UI
        this.updateUI('idle');
        this.app.showToast('🛑 Patrol stopped');
        
        if (this.app.face) {
            this.app.face.setMood('happy', 3000);
            this.app.updateMoodLabel();
        }
        
        if (typeof soundEngine !== 'undefined') soundEngine.playBeep(330, 200, 'sine', 0.15);
    }
    
    pause(reason = '') {
        if (!this.active || this.paused) return;
        this.paused = true;
        
        clearTimeout(this.stepTimer);
        clearTimeout(this.idleTimer);
        this.stepTimer = null;
        this.idleTimer = null;
        
        if (this.app.connected) ble.stop();
        if (this.visionNav) this.visionNav.stop();
        this.updateUI('paused', reason);
    }
    
    resume() {
        if (!this.active || !this.paused) return;
        if (!this.app.connected) return;
        
        this.paused = false;
        this.cliffRecovering = false;
        this.updateUI('patrolling');
        this.app.showToast('▶️ Patrol resumed!');
        
        ble.setAutonomous(true);
        if (this.pattern === 'explore' && this.visionNav) {
            this.visionNav.start();
        }
        this.runPatrolStep();
        this.scheduleIdleBehavior();
    }
    
    toggle() {
        if (this.active) {
            this.stop();
        } else {
            this.start();
        }
    }
    
    // ─── Cliff Handling ───
    
    handleCliffEvent(cliffCode) {
        if (!this.active) return;
        this.cliffCount++;
        this.cliffRecovering = true;
        
        // Stop current step
        clearTimeout(this.stepTimer);
        this.stepTimer = null;
        
        this.updateStatsUI();
        this.updateUI('cliff');
        
        // After a short delay (firmware already reversed), turn away from the cliff
        setTimeout(async () => {
            if (!this.active || !this.app.connected) return;
            
            const turnSpeed = this.pwmSpeed;
            
            if (cliffCode === CLIFF.LEFT) {
                // Turn right to avoid left cliff
                await ble.spinRight(turnSpeed);
            } else if (cliffCode === CLIFF.RIGHT) {
                // Turn left to avoid right cliff
                await ble.spinLeft(turnSpeed);
            } else {
                // Both — full 180° turn (spin longer)
                await ble.spinRight(turnSpeed);
            }
            
            this.turnCount++;
            
            const turnDuration = (cliffCode === CLIFF.BOTH) ? 1200 : 800;
            
            setTimeout(() => {
                if (!this.active || !this.app.connected) return;
                ble.stop();
                this.cliffRecovering = false;
                this.updateUI('patrolling');
                
                // Resume patrol pattern
                setTimeout(() => {
                    if (this.active && !this.paused) {
                        this.runPatrolStep();
                    }
                }, 300);
            }, turnDuration);
            
        }, 500);
    }
    
    // ─── Patrol Pattern Logic ───
    
    runPatrolStep() {
        if (!this.active || this.paused || this.cliffRecovering) return;
        if (!this.app.connected) {
            this.pause('Disconnected');
            return;
        }
        
        switch (this.pattern) {
            case 'explore':  this.stepExplore();  break;
            case 'zigzag':   this.stepZigzag();   break;
            case 'sentry':   this.stepSentry();   break;
            case 'orbit':    this.stepOrbit();    break;
            default:         this.stepExplore();  break;
        }
    }
    
    // Pattern 1: EXPLORE — Vision-Guided Autonomous Navigation (or Fallback)
    stepExplore() {
        if (!this.active || this.cliffRecovering) return;
        
        // 1. Try Vision-Guided Navigation
        if (this.visionNav && this.visionNav.isRunning && this.app.visionStream) {
            const nav = this.visionNav.getNavigationDecision();
            this.visionNav.updateActionText(`🤖 ${nav.reason}`);
            
            if (nav.action === 'forward') {
                ble.moveForward(this.pwmSpeed);
                this.stepTimer = setTimeout(() => {
                    if (this.active && !this.cliffRecovering) this.runPatrolStep();
                }, 600);
                return;
            } else if (nav.action === 'steer_left') {
                ble.spinLeft(this.pwmSpeed);
                this.turnCount++;
                this.updateStatsUI();
                if (nav.objectName && Math.random() < 0.3) {
                    this.app.showToast(`👁️ Steered left to avoid ${nav.objectName}!`);
                }
                this.stepTimer = setTimeout(() => {
                    if (this.active && !this.cliffRecovering) this.runPatrolStep();
                }, 500);
                return;
            } else if (nav.action === 'steer_right') {
                ble.spinRight(this.pwmSpeed);
                this.turnCount++;
                this.updateStatsUI();
                if (nav.objectName && Math.random() < 0.3) {
                    this.app.showToast(`👁️ Steered right to avoid ${nav.objectName}!`);
                }
                this.stepTimer = setTimeout(() => {
                    if (this.active && !this.cliffRecovering) this.runPatrolStep();
                }, 500);
                return;
            } else if (nav.action === 'reverse_turn') {
                ble.moveBackward(this.pwmSpeed);
                this.stepTimer = setTimeout(() => {
                    if (!this.active || this.cliffRecovering) return;
                    ble.spinRight(this.pwmSpeed);
                    this.turnCount++;
                    this.updateStatsUI();
                    this.stepTimer = setTimeout(() => {
                        if (this.active && !this.cliffRecovering) this.runPatrolStep();
                    }, 800);
                }, 400);
                return;
            }
        }
        
        // 2. Standard Exploration Fallback
        const forwardTime = 2000 + Math.random() * 3000;  // 2-5 seconds
        
        ble.moveForward(this.pwmSpeed);
        
        this.stepTimer = setTimeout(() => {
            if (!this.active || this.cliffRecovering) return;
            
            // Random turn
            const turnRight = Math.random() > 0.5;
            const turnTime = 400 + Math.random() * 800;  // 0.4-1.2s turn
            
            if (turnRight) {
                ble.spinRight(this.pwmSpeed);
            } else {
                ble.spinLeft(this.pwmSpeed);
            }
            this.turnCount++;
            this.updateStatsUI();
            
            this.stepTimer = setTimeout(() => {
                if (!this.active || this.cliffRecovering) return;
                ble.stop();
                
                // Brief pause before next step
                this.stepTimer = setTimeout(() => this.runPatrolStep(), 200);
            }, turnTime);
        }, forwardTime);
    }
    
    // Pattern 2: ZIGZAG — Alternating left-forward and right-forward sweeps
    stepZigzag() {
        const sweepTime = 1500 + Math.random() * 1000;  // 1.5-2.5s
        
        if (this.zigzagLeft) {
            ble.turnLeft(this.pwmSpeed);
        } else {
            ble.turnRight(this.pwmSpeed);
        }
        this.turnCount++;
        this.updateStatsUI();
        
        this.stepTimer = setTimeout(() => {
            if (!this.active || this.cliffRecovering) return;
            this.zigzagLeft = !this.zigzagLeft;
            
            // Short forward burst between zags
            ble.moveForward(this.pwmSpeed);
            
            this.stepTimer = setTimeout(() => {
                if (!this.active || this.cliffRecovering) return;
                this.runPatrolStep();
            }, 800);
        }, sweepTime);
    }
    
    // Pattern 3: SENTRY — Forward, pause & look around, continue
    stepSentry() {
        const forwardTime = 2000 + Math.random() * 2000;  // 2-4s forward
        
        ble.moveForward(this.pwmSpeed);
        
        this.stepTimer = setTimeout(() => {
            if (!this.active || this.cliffRecovering) return;
            
            // Stop and "look around"
            ble.stop();
            
            if (this.app.face) {
                this.app.face.setMood('thinking', 3000);
                this.app.updateMoodLabel();
            }
            
            // Small turn left
            this.stepTimer = setTimeout(() => {
                if (!this.active || this.cliffRecovering) return;
                ble.spinLeft(Math.round(this.pwmSpeed * 0.6));
                this.turnCount++;
                
                this.stepTimer = setTimeout(() => {
                    if (!this.active || this.cliffRecovering) return;
                    // Turn right (past center)
                    ble.spinRight(Math.round(this.pwmSpeed * 0.6));
                    this.turnCount++;
                    this.updateStatsUI();
                    
                    this.stepTimer = setTimeout(() => {
                        if (!this.active || this.cliffRecovering) return;
                        ble.stop();
                        
                        if (this.app.face) {
                            this.app.face.setMood('focused', 0, false, true);
                            this.app.updateMoodLabel();
                        }
                        
                        // Resume patrol
                        this.stepTimer = setTimeout(() => this.runPatrolStep(), 500);
                    }, 600);
                }, 600);
            }, 1000);  // Pause duration
        }, forwardTime);
    }
    
    // Pattern 4: ORBIT — Continuous gentle curve (one wheel slightly faster)
    stepOrbit() {
        const orbitTime = 3000 + Math.random() * 4000;  // 3-7s orbit
        const innerSpeed = Math.round(this.pwmSpeed * 0.4);
        const outerSpeed = this.pwmSpeed;
        
        // Alternate orbit direction
        if (this.currentStep % 2 === 0) {
            ble.writeMotorCmd(ble.buildPacket(CMD.MOVE_FORWARD, 0, 0, innerSpeed));
            // We need asymmetric control — use turnLeft/turnRight which already has speed differential
            ble.turnLeft(outerSpeed);
        } else {
            ble.turnRight(outerSpeed);
        }
        this.currentStep++;
        this.turnCount++;
        this.updateStatsUI();
        
        this.stepTimer = setTimeout(() => {
            if (!this.active || this.cliffRecovering) return;
            ble.stop();
            
            this.stepTimer = setTimeout(() => this.runPatrolStep(), 300);
        }, orbitTime);
    }
    
    // ─── Idle Personality ───
    
    scheduleIdleBehavior() {
        if (!this.active || this.paused) return;
        
        const delay = 15000 + Math.random() * 15000;  // 15-30 seconds
        
        this.idleTimer = setTimeout(() => {
            if (!this.active || this.paused || this.cliffRecovering) {
                return;
            }
            
            // Random personality action
            const actions = ['nod', 'excited'];
            const action = actions[Math.floor(Math.random() * actions.length)];
            
            if (this.app.connected) {
                if (action === 'nod') ble.playAnimation(0x02);
                else ble.playAnimation(0x04);
            }
            
            if (this.app.face) {
                const moods = ['happy', 'excited', 'eureka', 'curious'];
                const mood = moods[Math.floor(Math.random() * moods.length)];
                this.app.face.setMood(mood, 2000);
                this.app.updateMoodLabel();
            }
            
            // Schedule next idle behavior
            this.scheduleIdleBehavior();
        }, delay);
    }
    
    // ─── UI Updates ───
    
    updateUI(state, reason = '') {
        const panel = document.getElementById('patrol-panel');
        const badge = document.getElementById('patrol-status-badge');
        const statusText = document.getElementById('patrol-status-text');
        const toggleBtn = document.getElementById('patrol-toggle-btn');
        const toggleIcon = document.getElementById('patrol-toggle-icon');
        const toggleLabel = document.getElementById('patrol-toggle-label');
        
        // Reset classes
        if (panel) panel.classList.remove('active');
        if (badge) badge.className = 'patrol-status-badge';
        if (toggleBtn) toggleBtn.classList.remove('active');
        
        switch (state) {
            case 'patrolling':
                if (panel) panel.classList.add('active');
                if (badge) badge.classList.add('patrolling');
                if (statusText) statusText.textContent = 'Patrolling';
                if (toggleBtn) toggleBtn.classList.add('active');
                if (toggleLabel) toggleLabel.textContent = 'Stop Patrol';
                // Swap icon to square (stop)
                if (toggleIcon) {
                    toggleIcon.setAttribute('data-lucide', 'square');
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
                break;
            case 'cliff':
                if (panel) panel.classList.add('active');
                if (badge) badge.classList.add('cliff');
                if (statusText) statusText.textContent = 'Cliff!';
                if (toggleBtn) toggleBtn.classList.add('active');
                break;
            case 'paused':
                if (badge) badge.classList.add('patrolling');
                if (statusText) statusText.textContent = reason ? `Paused (${reason})` : 'Paused';
                if (toggleBtn) toggleBtn.classList.add('active');
                break;
            default: // idle
                if (statusText) statusText.textContent = 'Idle';
                if (toggleLabel) toggleLabel.textContent = 'Start Patrol';
                if (toggleIcon) {
                    toggleIcon.setAttribute('data-lucide', 'play');
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
                break;
        }
    }
    
    updateStatsUI() {
        const elapsed = this.active ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
        const mins = Math.floor(elapsed / 60);
        const secs = (elapsed % 60).toString().padStart(2, '0');
        
        const timeEl = document.getElementById('patrol-time');
        const turnsEl = document.getElementById('patrol-turns');
        const cliffsEl = document.getElementById('patrol-cliffs');
        
        if (timeEl) timeEl.textContent = `${mins}:${secs}`;
        if (turnsEl) turnsEl.textContent = `${this.turnCount} turns`;
        if (cliffsEl) cliffsEl.textContent = `${this.cliffCount} cliffs`;
    }
}

// ─── Init ───
let app;
document.addEventListener('DOMContentLoaded', () => {
    window.app = new LikApp();
    app = window.app;
});
