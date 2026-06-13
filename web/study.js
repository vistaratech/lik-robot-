/**
 * VILY Study Tools Module
 * Quiz Generator, Math Solver, Notes, Pomodoro, Flashcards, Explainer, Planner
 */

class StudyTools {
    constructor(app) {
        this.app = app;
        this.currentSubview = null;
        
        // Sub-modules
        this.quiz = new QuizEngine(this);
        this.math = new MathSolver(this);
        this.notes = new NotesManager(this);
        this.pomodoro = new PomodoroTimer(this);
        this.flashcards = new FlashcardDeck(this);
        this.explainer = new ConceptExplainer(this);
        this.planner = new StudyPlanner(this);
        
        this.init();
    }

    init() {
        // Study card click handlers
        document.querySelectorAll('.study-card[data-tool]').forEach(card => {
            card.addEventListener('click', () => {
                const tool = card.dataset.tool;
                if (tool === 'games') {
                    this.openSubview('games');
                } else {
                    this.openSubview(tool);
                }
            });
        });

        // Game cards in study break
        document.querySelectorAll('#subview-games .study-card[data-game]').forEach(card => {
            card.addEventListener('click', () => {
                const game = card.dataset.game;
                this.app.handleGameLaunch(game);
            });
        });

        // Back buttons
        document.querySelectorAll('.subview-back-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeSubview();
            });
        });
    }

    openSubview(toolName) {
        const hub = document.getElementById('study-hub');
        const subview = document.getElementById(`subview-${toolName}`);
        if (!hub || !subview) return;

        hub.style.display = 'none';
        // Hide all subviews
        document.querySelectorAll('.study-subview').forEach(sv => sv.classList.remove('active'));
        subview.classList.add('active');
        this.currentSubview = toolName;

        // Update top bar
        const titles = {
            quiz: 'Quiz Generator',
            math: 'Math Solver',
            notes: 'Notes',
            pomodoro: 'Pomodoro Timer',
            flashcards: 'Flashcards',
            explain: 'Concept Explainer',
            planner: 'Study Planner',
            games: 'Study Break'
        };
        this.app.updateTopBar(titles[toolName] || 'Study Tools', 'AI-powered learning');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    closeSubview() {
        const hub = document.getElementById('study-hub');
        document.querySelectorAll('.study-subview').forEach(sv => sv.classList.remove('active'));
        if (hub) hub.style.display = 'block';
        this.currentSubview = null;
        this.app.updateTopBar('Study Tools', 'Your learning toolkit');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// ═══════════════════════════════════════════════
//  Quiz Engine
// ═══════════════════════════════════════════════
class QuizEngine {
    constructor(study) {
        this.study = study;
        this.questions = [];
        this.currentIndex = 0;
        this.score = 0;
        this.questionCount = 5;
        this.answered = false;

        this.init();
    }

    init() {
        // Question count buttons
        document.querySelectorAll('#subview-quiz .quiz-option-btn[data-count]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#subview-quiz .quiz-option-btn[data-count]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.questionCount = parseInt(btn.dataset.count);
            });
        });

        // Generate button
        const genBtn = document.getElementById('quiz-generate-btn');
        if (genBtn) {
            genBtn.addEventListener('click', () => this.generate());
        }
    }

    async generate() {
        const topicInput = document.getElementById('quiz-topic');
        const topic = topicInput?.value.trim();
        if (!topic) {
            this.study.app.showToast('Please enter a topic!');
            return;
        }

        const genBtn = document.getElementById('quiz-generate-btn');
        genBtn.disabled = true;
        genBtn.textContent = '⚡ Generating...';

        try {
            const response = await fetch('/api/quiz/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, count: this.questionCount })
            });

            if (!response.ok) throw new Error('Failed to generate quiz');
            const data = await response.json();
            
            if (data.questions && data.questions.length > 0) {
                this.questions = data.questions;
                this.currentIndex = 0;
                this.score = 0;
                this.showQuestion();
                document.getElementById('quiz-setup').style.display = 'none';
            } else {
                throw new Error('No questions generated');
            }
        } catch (err) {
            console.error('[Quiz] Error:', err);
            this.study.app.showToast('Failed to generate quiz. Check your API key.');
        } finally {
            genBtn.disabled = false;
            genBtn.innerHTML = '<i data-lucide="sparkles" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Generate Quiz with AI';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    showQuestion() {
        const area = document.getElementById('quiz-play-area');
        if (!area || this.currentIndex >= this.questions.length) {
            this.showResults();
            return;
        }

        const q = this.questions[this.currentIndex];
        const progress = ((this.currentIndex) / this.questions.length) * 100;
        this.answered = false;

        area.innerHTML = `
            <div class="quiz-question-card">
                <div class="quiz-progress">
                    <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${progress}%"></div></div>
                    <span class="quiz-progress-text">${this.currentIndex + 1} / ${this.questions.length}</span>
                </div>
                <div class="quiz-question-text">${q.question}</div>
                <div class="quiz-answers">
                    ${q.options.map((opt, i) => `
                        <button class="quiz-answer-btn" data-index="${i}">
                            <span class="answer-letter">${String.fromCharCode(65 + i)}</span>
                            <span>${opt}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        // Bind answer clicks
        area.querySelectorAll('.quiz-answer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.answered) return;
                this.answered = true;
                const selectedIndex = parseInt(btn.dataset.index);
                this.checkAnswer(selectedIndex, area);
            });
        });
    }

    checkAnswer(selectedIndex, area) {
        const q = this.questions[this.currentIndex];
        const buttons = area.querySelectorAll('.quiz-answer-btn');
        const correctIndex = q.correctIndex;

        buttons.forEach((btn, i) => {
            if (i === correctIndex) {
                btn.classList.add('correct');
            } else if (i === selectedIndex && i !== correctIndex) {
                btn.classList.add('wrong');
            }
        });

        if (selectedIndex === correctIndex) {
            this.score++;
            this.study.app.showToast('✅ Correct!');
        } else {
            this.study.app.showToast('❌ Wrong!');
        }

        setTimeout(() => {
            this.currentIndex++;
            this.showQuestion();
        }, 1200);
    }

    showResults() {
        const area = document.getElementById('quiz-play-area');
        const percent = Math.round((this.score / this.questions.length) * 100);
        const circumference = 2 * Math.PI * 44;
        const offset = circumference - (percent / 100) * circumference;
        const color = percent >= 70 ? 'var(--accent-green)' : percent >= 40 ? 'var(--accent-orange)' : 'var(--accent-red)';

        area.innerHTML = `
            <div class="quiz-results">
                <div class="quiz-score-ring">
                    <svg viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="44" fill="none" stroke="var(--bg-elevated)" stroke-width="6"/>
                        <circle cx="50" cy="50" r="44" fill="none" stroke="${color}" stroke-width="6" 
                            stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                            style="transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset 1s ease;"/>
                    </svg>
                    <div class="quiz-score-text">
                        <span class="score-num">${percent}%</span>
                        <span class="score-label">${this.score}/${this.questions.length}</span>
                    </div>
                </div>
                <h3 style="font-size:18px;font-weight:700;color:var(--text-primary);">
                    ${percent >= 70 ? 'Great job! 🎉' : percent >= 40 ? 'Good effort! 💪' : 'Keep studying! 📚'}
                </h3>
                <p style="font-size:13px;color:var(--text-secondary);max-width:280px;line-height:1.5;">
                    ${percent >= 70 ? 'You really know your stuff!' : 'Review the topic and try again for a better score.'}
                </p>
                <button class="pomodoro-btn primary" onclick="document.getElementById('quiz-setup').style.display='flex'; document.getElementById('quiz-play-area').innerHTML=''; if(typeof lucide!=='undefined')lucide.createIcons();">
                    Try Another Quiz
                </button>
            </div>
        `;
    }
}

// ═══════════════════════════════════════════════
//  Math Solver
// ═══════════════════════════════════════════════
class MathSolver {
    constructor(study) {
        this.study = study;
        this.init();
    }

    init() {
        const solveBtn = document.getElementById('math-solve-btn');
        if (solveBtn) {
            solveBtn.addEventListener('click', () => this.solve());
        }

        const input = document.getElementById('math-input');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.solve();
            });
        }
    }

    async solve() {
        const input = document.getElementById('math-input');
        const problem = input?.value.trim();
        if (!problem) {
            this.study.app.showToast('Please enter a math problem!');
            return;
        }

        const solveBtn = document.getElementById('math-solve-btn');
        solveBtn.disabled = true;
        solveBtn.textContent = '⚡ Solving...';

        const resultDiv = document.getElementById('math-result');

        try {
            const response = await fetch('/api/math/solve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ problem })
            });

            if (!response.ok) throw new Error('Failed to solve');
            const data = await response.json();

            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `
                <div class="quiz-question-card" style="margin-top:8px;">
                    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;font-weight:600;">Solution:</div>
                    <div style="font-size:14px;color:var(--text-primary);line-height:1.7;white-space:pre-wrap;">${this.formatSolution(data.solution)}</div>
                </div>
            `;
        } catch (err) {
            console.error('[Math] Error:', err);
            this.study.app.showToast('Failed to solve. Check your API key.');
        } finally {
            solveBtn.disabled = false;
            solveBtn.innerHTML = '<i data-lucide="sparkles" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Solve with AI';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    formatSolution(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }
}

// ═══════════════════════════════════════════════
//  Notes Manager
// ═══════════════════════════════════════════════
class NotesManager {
    constructor(study) {
        this.study = study;
        this.notes = JSON.parse(localStorage.getItem('vily-notes') || '[]');
        this.editingId = null;
        this.init();
    }

    init() {
        const addBtn = document.getElementById('notes-add-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.openEditor());

        const saveBtn = document.getElementById('note-save-btn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveNote());

        const cancelBtn = document.getElementById('note-cancel-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeEditor());

        const searchInput = document.getElementById('notes-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.renderList(searchInput.value));
        }

        this.renderList();
    }

    renderList(filter = '') {
        const list = document.getElementById('notes-list');
        if (!list) return;

        const filtered = this.notes.filter(n => 
            n.title.toLowerCase().includes(filter.toLowerCase()) ||
            n.body.toLowerCase().includes(filter.toLowerCase())
        );

        if (filtered.length === 0) {
            list.innerHTML = `
                <div style="text-align:center;padding:40px 0;color:var(--text-muted);font-size:13px;">
                    ${filter ? 'No matching notes found' : 'No notes yet. Tap "New Note" to create one!'}
                </div>
            `;
            return;
        }

        list.innerHTML = filtered.map(note => `
            <div class="note-item" data-id="${note.id}">
                <div class="note-item-title">${this.escapeHtml(note.title || 'Untitled')}</div>
                <div class="note-item-preview">${this.escapeHtml(note.body.substring(0, 80))}</div>
                <div class="note-item-date">${new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        `).join('');

        // Bind clicks
        list.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const note = this.notes.find(n => n.id === id);
                if (note) this.openEditor(note);
            });
        });
    }

    openEditor(note = null) {
        const editor = document.getElementById('note-editor');
        const notesList = document.getElementById('notes-list');
        const toolbar = document.querySelector('.notes-toolbar');
        const titleInput = document.getElementById('note-title');
        const bodyInput = document.getElementById('note-body');

        if (note) {
            this.editingId = note.id;
            titleInput.value = note.title;
            bodyInput.value = note.body;
        } else {
            this.editingId = null;
            titleInput.value = '';
            bodyInput.value = '';
        }

        notesList.style.display = 'none';
        toolbar.style.display = 'none';
        editor.classList.add('active');
        titleInput.focus();
    }

    closeEditor() {
        const editor = document.getElementById('note-editor');
        const notesList = document.getElementById('notes-list');
        const toolbar = document.querySelector('.notes-toolbar');

        editor.classList.remove('active');
        notesList.style.display = 'flex';
        toolbar.style.display = 'flex';
        this.editingId = null;
    }

    saveNote() {
        const title = document.getElementById('note-title').value.trim();
        const body = document.getElementById('note-body').value.trim();

        if (!title && !body) {
            this.study.app.showToast('Note is empty!');
            return;
        }

        if (this.editingId) {
            const note = this.notes.find(n => n.id === this.editingId);
            if (note) {
                note.title = title || 'Untitled';
                note.body = body;
                note.updatedAt = new Date().toISOString();
            }
        } else {
            this.notes.unshift({
                id: 'note-' + Date.now(),
                title: title || 'Untitled',
                body: body,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        localStorage.setItem('vily-notes', JSON.stringify(this.notes));
        this.closeEditor();
        this.renderList();
        this.study.app.showToast('📝 Note saved!');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ═══════════════════════════════════════════════
//  Pomodoro Timer
// ═══════════════════════════════════════════════
class PomodoroTimer {
    constructor(study) {
        this.study = study;
        this.focusDuration = 25 * 60; // seconds
        this.breakDuration = 5 * 60;
        this.timeRemaining = this.focusDuration;
        this.isRunning = false;
        this.isBreak = false;
        this.completedSessions = 0;
        this.timer = null;
        this.circumference = 2 * Math.PI * 44;

        this.init();
    }

    init() {
        const startBtn = document.getElementById('pomodoro-start-btn');
        const resetBtn = document.getElementById('pomodoro-reset-btn');

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (this.isRunning) {
                    this.pause();
                } else {
                    this.start();
                }
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }

        this.updateDisplay();
    }

    start() {
        this.isRunning = true;
        const startBtn = document.getElementById('pomodoro-start-btn');
        if (startBtn) startBtn.textContent = 'Pause';

        if (this.study.app.face) {
            this.study.app.face.setMood('focused');
            this.study.app.updateMoodLabel();
        }

        this.timer = setInterval(() => {
            this.timeRemaining--;
            this.updateDisplay();

            if (this.timeRemaining <= 0) {
                this.onPhaseComplete();
            }
        }, 1000);
    }

    pause() {
        this.isRunning = false;
        clearInterval(this.timer);
        const startBtn = document.getElementById('pomodoro-start-btn');
        if (startBtn) startBtn.textContent = 'Resume';
    }

    reset() {
        this.pause();
        this.isBreak = false;
        this.timeRemaining = this.focusDuration;
        const startBtn = document.getElementById('pomodoro-start-btn');
        if (startBtn) startBtn.textContent = 'Start';
        this.updateDisplay();
    }

    onPhaseComplete() {
        clearInterval(this.timer);
        this.isRunning = false;

        if (!this.isBreak) {
            // Focus phase complete
            this.completedSessions++;
            this.updateSessionDots();
            this.study.app.showToast('🎉 Focus session complete! Take a break.');

            if (typeof soundEngine !== 'undefined') {
                soundEngine.playBeep(880, 300, 'sine', 0.3);
                setTimeout(() => soundEngine.playBeep(880, 300, 'sine', 0.3), 350);
            }

            this.isBreak = true;
            this.timeRemaining = this.breakDuration;
        } else {
            // Break complete
            this.study.app.showToast('⏰ Break over! Let\'s focus again.');
            
            if (typeof soundEngine !== 'undefined') {
                soundEngine.playBeep(660, 500, 'sine', 0.3);
            }

            this.isBreak = false;
            this.timeRemaining = this.focusDuration;
        }

        this.updateDisplay();
        const startBtn = document.getElementById('pomodoro-start-btn');
        if (startBtn) startBtn.textContent = 'Start';
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const timeEl = document.getElementById('pomodoro-time');
        const phaseEl = document.getElementById('pomodoro-phase');
        const progressEl = document.getElementById('pomodoro-progress');

        if (timeEl) {
            timeEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

        if (phaseEl) {
            phaseEl.textContent = this.isBreak ? 'Break' : 'Focus';
        }

        if (progressEl) {
            const total = this.isBreak ? this.breakDuration : this.focusDuration;
            const progress = 1 - (this.timeRemaining / total);
            const offset = this.circumference * (1 - progress);
            progressEl.setAttribute('stroke-dashoffset', offset);
            
            if (this.isBreak) {
                progressEl.classList.add('break-mode');
            } else {
                progressEl.classList.remove('break-mode');
            }
        }
    }

    updateSessionDots() {
        const dots = document.querySelectorAll('.pomodoro-dot');
        dots.forEach((dot, i) => {
            if (i < this.completedSessions) {
                dot.classList.add('completed');
            }
        });
    }
}

// ═══════════════════════════════════════════════
//  Flashcard Deck
// ═══════════════════════════════════════════════
class FlashcardDeck {
    constructor(study) {
        this.study = study;
        this.cards = JSON.parse(localStorage.getItem('vily-flashcards') || '[]');
        this.currentIndex = 0;
        this.isFlipped = false;

        this.init();
    }

    init() {
        const wrapper = document.getElementById('flashcard-wrapper');
        if (wrapper) {
            wrapper.addEventListener('click', () => this.flip());
        }

        const prevBtn = document.getElementById('flashcard-prev');
        const nextBtn = document.getElementById('flashcard-next');
        if (prevBtn) prevBtn.addEventListener('click', () => this.prev());
        if (nextBtn) nextBtn.addEventListener('click', () => this.next());

        const addBtn = document.getElementById('flashcard-add-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.addCard());

        const genBtn = document.getElementById('flashcard-generate-btn');
        if (genBtn) genBtn.addEventListener('click', () => this.generateCards());

        this.updateDisplay();
    }

    flip() {
        const card = document.getElementById('flashcard');
        if (card) {
            this.isFlipped = !this.isFlipped;
            card.classList.toggle('flipped', this.isFlipped);
        }
    }

    prev() {
        if (this.cards.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + this.cards.length) % this.cards.length;
        this.isFlipped = false;
        this.updateDisplay();
    }

    next() {
        if (this.cards.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.cards.length;
        this.isFlipped = false;
        this.updateDisplay();
    }

    addCard() {
        const front = prompt('Enter the question (front):');
        if (!front) return;
        const back = prompt('Enter the answer (back):');
        if (!back) return;

        this.cards.push({ front, back, id: 'fc-' + Date.now() });
        localStorage.setItem('vily-flashcards', JSON.stringify(this.cards));
        this.currentIndex = this.cards.length - 1;
        this.isFlipped = false;
        this.updateDisplay();
        this.study.app.showToast('🃏 Flashcard added!');
    }

    async generateCards() {
        const topic = prompt('Enter a topic to generate flashcards:');
        if (!topic) return;

        this.study.app.showToast('⚡ Generating flashcards...');

        try {
            const response = await fetch('/api/flashcards/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, count: 5 })
            });

            if (!response.ok) throw new Error('Failed');
            const data = await response.json();

            if (data.cards && data.cards.length > 0) {
                this.cards.push(...data.cards.map(c => ({
                    front: c.front,
                    back: c.back,
                    id: 'fc-' + Date.now() + Math.random()
                })));
                localStorage.setItem('vily-flashcards', JSON.stringify(this.cards));
                this.currentIndex = this.cards.length - data.cards.length;
                this.isFlipped = false;
                this.updateDisplay();
                this.study.app.showToast(`🃏 ${data.cards.length} flashcards generated!`);
            }
        } catch (err) {
            console.error('[Flashcards] Error:', err);
            this.study.app.showToast('Failed to generate. Check your API key.');
        }
    }

    updateDisplay() {
        const frontText = document.getElementById('flashcard-front-text');
        const backText = document.getElementById('flashcard-back-text');
        const counter = document.getElementById('flashcard-counter');
        const card = document.getElementById('flashcard');

        if (card) card.classList.remove('flipped');
        this.isFlipped = false;

        if (this.cards.length === 0) {
            if (frontText) frontText.textContent = 'Create your first flashcard!';
            if (backText) backText.textContent = 'Tap "Add Card" below to begin';
            if (counter) counter.textContent = '0 / 0';
            return;
        }

        const c = this.cards[this.currentIndex];
        if (frontText) frontText.textContent = c.front;
        if (backText) backText.textContent = c.back;
        if (counter) counter.textContent = `${this.currentIndex + 1} / ${this.cards.length}`;
    }
}

// ═══════════════════════════════════════════════
//  Concept Explainer
// ═══════════════════════════════════════════════
class ConceptExplainer {
    constructor(study) {
        this.study = study;
        this.level = 'simple';
        this.init();
    }

    init() {
        document.querySelectorAll('#subview-explain .quiz-option-btn[data-level]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#subview-explain .quiz-option-btn[data-level]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.level = btn.dataset.level;
            });
        });

        const explainBtn = document.getElementById('explain-btn');
        if (explainBtn) {
            explainBtn.addEventListener('click', () => this.explain());
        }
    }

    async explain() {
        const input = document.getElementById('explain-input');
        const concept = input?.value.trim();
        if (!concept) {
            this.study.app.showToast('Please enter a concept!');
            return;
        }

        const btn = document.getElementById('explain-btn');
        btn.disabled = true;
        btn.textContent = '⚡ Explaining...';

        try {
            const response = await fetch('/api/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ concept, level: this.level })
            });

            if (!response.ok) throw new Error('Failed');
            const data = await response.json();

            const resultDiv = document.getElementById('explain-result');
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `
                <div class="quiz-question-card" style="margin-top:8px;">
                    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;font-weight:600;">
                        📖 ${concept} (${this.level})
                    </div>
                    <div style="font-size:14px;color:var(--text-primary);line-height:1.7;white-space:pre-wrap;">
                        ${data.explanation.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        } catch (err) {
            console.error('[Explain] Error:', err);
            this.study.app.showToast('Failed to explain. Check your API key.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="sparkles" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Explain with AI';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

// ═══════════════════════════════════════════════
//  Study Planner
// ═══════════════════════════════════════════════
class StudyPlanner {
    constructor(study) {
        this.study = study;
        this.tasks = JSON.parse(localStorage.getItem('vily-planner') || '[]');
        this.init();
    }

    init() {
        const addBtn = document.getElementById('planner-add-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.addTask());

        this.renderList();
    }

    addTask() {
        const title = prompt('What do you need to study?');
        if (!title) return;

        this.tasks.push({
            id: 'task-' + Date.now(),
            title: title,
            completed: false,
            createdAt: new Date().toISOString()
        });

        localStorage.setItem('vily-planner', JSON.stringify(this.tasks));
        this.renderList();
        this.study.app.showToast('📅 Task added!');
    }

    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            localStorage.setItem('vily-planner', JSON.stringify(this.tasks));
            this.renderList();
        }
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        localStorage.setItem('vily-planner', JSON.stringify(this.tasks));
        this.renderList();
    }

    renderList() {
        const list = document.getElementById('planner-list');
        if (!list) return;

        if (this.tasks.length === 0) {
            list.innerHTML = `
                <div style="text-align:center;padding:40px 0;color:var(--text-muted);font-size:13px;">
                    No tasks yet. Tap "Add Task" to plan your study sessions!
                </div>
            `;
            return;
        }

        list.innerHTML = this.tasks.map(task => `
            <div class="note-item" style="display:flex;align-items:center;gap:12px;">
                <button onclick="window.app?.studyTools?.planner?.toggleTask('${task.id}')" 
                    style="width:22px;height:22px;border-radius:6px;border:2px solid ${task.completed ? 'var(--accent-green)' : 'var(--text-muted)'};
                    background:${task.completed ? 'var(--accent-green)' : 'transparent'};flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;">
                    ${task.completed ? '✓' : ''}
                </button>
                <div style="flex:1;min-width:0;">
                    <div class="note-item-title" style="${task.completed ? 'text-decoration:line-through;opacity:0.5;' : ''}">${task.title}</div>
                    <div class="note-item-date">${new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
                <button onclick="window.app?.studyTools?.planner?.deleteTask('${task.id}')"
                    style="color:var(--accent-red);background:none;border:none;cursor:pointer;font-size:14px;padding:4px;">✕</button>
            </div>
        `).join('');
    }
}
