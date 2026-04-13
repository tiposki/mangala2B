/**
 * Mangala - Geleneksel Türk Strateji Oyunu
 * Game Logic & UI Controller
 */

(function () {
    'use strict';

    // ===== GAME CONSTANTS =====
    const PITS_PER_PLAYER = 6;
    const INITIAL_STONES = 4;
    const TOTAL_PITS = 14; // 6 pits + 1 store per player = 14
    const P1_STORE = 6;   // Index 6 = Player 1's store
    const P2_STORE = 13;  // Index 13 = Player 2's store

    // ===== GAME STATE =====
    let board = [];       // Array of 14: indices 0-5 P1 pits, 6 P1 store, 7-12 P2 pits, 13 P2 store
    let currentPlayer = 1; // 1 or 2
    let gameOver = false;
    let animating = false;
    let gameMode = 'ai';  // 'ai' or 'pvp'

    // ===== DOM REFERENCES =====
    const statusMessage = document.getElementById('status-message');
    const btnHelp = document.getElementById('btn-help');
    const btnTheme = document.getElementById('btn-theme');
    const iconSun = document.getElementById('icon-sun');
    const iconMoon = document.getElementById('icon-moon');
    const btnNewGame = document.getElementById('btn-new-game');
    const modalOverlay = document.getElementById('modal-overlay');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnVsComputer = document.getElementById('btn-vs-computer');
    const btnVsPlayer = document.getElementById('btn-vs-player');
    const gameoverOverlay = document.getElementById('gameover-overlay');
    const btnPlayAgain = document.getElementById('btn-play-again');
    const btnSound = document.getElementById('btn-sound');
    const iconSoundOn = document.getElementById('icon-sound-on');
    const iconSoundOff = document.getElementById('icon-sound-off');

    // ===== AUDIO MANAGEMENT =====
    let audioCtx = null;
    let bgmOsc = null;
    let bgmGain = null;
    let isSoundEnabled = true;
    let bgmInterval = null;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function toggleSound() {
        isSoundEnabled = !isSoundEnabled;
        if (isSoundEnabled) {
            iconSoundOn.style.display = 'block';
            iconSoundOff.style.display = 'none';
            initAudio();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            startBGM();
        } else {
            iconSoundOn.style.display = 'none';
            iconSoundOff.style.display = 'block';
            stopBGM();
        }
    }

    // ---- BGM State ----
    let bgmMelodyStep = 0;
    let bgmChordStep = 0;
    let bgmMelodyInterval = null;
    let bgmChordInterval = null;
    let bgmDroneOsc = null;
    let bgmDroneGain = null;
    let bgmDroneOsc2 = null;
    let bgmDroneGain2 = null;

    function startBGM() {
        if (!isSoundEnabled || !audioCtx) return;
        if (bgmMelodyInterval) return;

        const now = audioCtx.currentTime;

        // ======= LAYER 1: Warm bass drone (two detuned sines) =======
        bgmDroneOsc = audioCtx.createOscillator();
        bgmDroneGain = audioCtx.createGain();
        bgmDroneOsc.type = 'sine';
        bgmDroneOsc.frequency.setValueAtTime(110, now); // A2
        bgmDroneGain.gain.setValueAtTime(0, now);
        bgmDroneGain.gain.linearRampToValueAtTime(0.018, now + 3);
        bgmDroneOsc.connect(bgmDroneGain);
        bgmDroneGain.connect(audioCtx.destination);
        bgmDroneOsc.start(now);

        bgmDroneOsc2 = audioCtx.createOscillator();
        bgmDroneGain2 = audioCtx.createGain();
        bgmDroneOsc2.type = 'sine';
        bgmDroneOsc2.frequency.setValueAtTime(110.5, now); // slightly detuned for warmth
        bgmDroneGain2.gain.setValueAtTime(0, now);
        bgmDroneGain2.gain.linearRampToValueAtTime(0.012, now + 3);
        bgmDroneOsc2.connect(bgmDroneGain2);
        bgmDroneGain2.connect(audioCtx.destination);
        bgmDroneOsc2.start(now);

        // ======= LAYER 2: Evolving chord pads =======
        const chords = [
            [220, 261.63, 329.63],   // Am
            [196, 246.94, 293.66],   // G
            [174.61, 220, 261.63],   // F
            [164.81, 196, 246.94],   // Em
            [220, 277.18, 329.63],   // Am(add9 flavor)
            [196, 246.94, 311.13],   // G(add#4 flavor)
            [174.61, 220, 277.18],   // Fmaj7 flavor
            [164.81, 207.65, 261.63] // Em7 flavor
        ];

        bgmChordInterval = setInterval(() => {
            if (!isSoundEnabled || !audioCtx) return;
            const t = audioCtx.currentTime;
            const chord = chords[bgmChordStep % chords.length];

            chord.forEach((freq, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, t);
                // stagger attack slightly per note
                const attack = 0.8 + i * 0.3;
                const vol = 0.012 + Math.random() * 0.005;
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(vol, t + attack);
                gain.gain.linearRampToValueAtTime(vol * 0.7, t + 3);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 5.5);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(t);
                osc.stop(t + 5.8);
            });

            bgmChordStep++;
        }, 6000);

        // ======= LAYER 3: Long melodic sequence =======
        // Notes spanning 3 octaves of A minor pentatonic + some color tones
        const scale = [
            220.00, 246.94, 261.63, 293.66, 329.63,  // A3-E4
            349.23, 392.00, 440.00, 493.88, 523.25,  // F4-C5
            587.33, 659.25, 698.46, 783.99            // D5-G5
        ];
        // 64-step melody with rests (-1) for breathing room
        const melody = [
            0,  2,  4,  -1, 3,  5,  4,  2,
            7,  6,  4,  3,  5,  -1, -1, 2,
            4,  6,  8,  7,  9,  8,  6,  -1,
            5,  4,  2,  0,  2,  3,  -1, 0,
            2,  5,  7,  6,  4,  3,  5,  7,
            9,  10, 8,  -1, 7,  6,  4,  2,
            3,  5,  4,  2,  0,  -1, -1, 2,
            4,  3,  2,  0,  -1, 0,  2,  -1
        ];

        bgmMelodyInterval = setInterval(() => {
            if (!isSoundEnabled || !audioCtx) return;
            const t = audioCtx.currentTime;
            const noteIdx = melody[bgmMelodyStep % melody.length];

            if (noteIdx === -1) {
                bgmMelodyStep++;
                return;
            }
            const freq = scale[noteIdx];

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            // Alternate between triangle and sine for tonal variety
            osc.type = (bgmMelodyStep % 3 === 0) ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, t);

            // Humanized dynamics
            const vel = 0.022 + Math.random() * 0.012;
            const dur = 1.2 + Math.random() * 1.3;

            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(vel, t + 0.06);
            gain.gain.linearRampToValueAtTime(vel * 0.6, t + dur * 0.6);
            gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(t);
            osc.stop(t + dur + 0.1);

            bgmMelodyStep++;
        }, 700);
    }

    function stopBGM() {
        // Stop drone
        if (bgmDroneOsc) {
            try { bgmDroneOsc.stop(); } catch(e) {}
            bgmDroneOsc.disconnect();
            bgmDroneOsc = null;
        }
        if (bgmDroneGain) { bgmDroneGain.disconnect(); bgmDroneGain = null; }
        if (bgmDroneOsc2) {
            try { bgmDroneOsc2.stop(); } catch(e) {}
            bgmDroneOsc2.disconnect();
            bgmDroneOsc2 = null;
        }
        if (bgmDroneGain2) { bgmDroneGain2.disconnect(); bgmDroneGain2 = null; }
        // Stop chord pad
        if (bgmChordInterval) {
            clearInterval(bgmChordInterval);
            bgmChordInterval = null;
        }
        // Stop melody
        if (bgmMelodyInterval) {
            clearInterval(bgmMelodyInterval);
            bgmMelodyInterval = null;
        }
    }

    function playSound(type) {
        if (!isSoundEnabled || !audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'drop') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
            gainNode.gain.setValueAtTime(0.05, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'capture') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
            gainNode.gain.setValueAtTime(0.05, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'win') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(554.37, now + 0.15);
            osc.frequency.setValueAtTime(659.25, now + 0.3);
            osc.frequency.setValueAtTime(880, now + 0.45);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 1);
            osc.start(now);
            osc.stop(now + 1);
        } else if (type === 'lose') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(150, now + 0.5);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        }
    }

    // ===== THEME MANAGEMENT =====
    function initTheme() {
        const theme = 'light'; // Always default to light mode on start.
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('mangala-theme', theme);
        updateThemeIcon(theme);
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('mangala-theme', next);
        updateThemeIcon(next);
    }

    function updateThemeIcon(theme) {
        if (theme === 'dark') {
            iconSun.style.display = 'block';
            iconMoon.style.display = 'none';
        } else {
            iconSun.style.display = 'none';
            iconMoon.style.display = 'block';
        }
    }

    // ===== MODAL =====
    function openModal() {
        modalOverlay.classList.add('active');
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
    }

    function openGameOver() {
        gameoverOverlay.classList.add('active');
    }

    function closeGameOver() {
        gameoverOverlay.classList.remove('active');
    }

    // ===== GAME MODE =====
    function setGameMode(mode) {
        gameMode = mode;
        updatePlayerLabels();
    }

    function updatePlayerLabels() {
        const p1Name = document.getElementById('player1-name');
        const p2Name = document.getElementById('player2-name');
        const goLabel1 = document.getElementById('gameover-label-1');
        const goEmoji1 = document.getElementById('gameover-emoji-1');
        const goLabel2 = document.getElementById('gameover-label-2');
        const goEmoji2 = document.getElementById('gameover-emoji-2');

        if (gameMode === 'pvp') {
            p1Name.textContent = 'Oyuncu 1';
            p2Name.textContent = 'Oyuncu 2';
            goLabel1.textContent = 'Oyuncu 1';
            goEmoji1.textContent = '😊';
            goLabel2.textContent = 'Oyuncu 2';
            goEmoji2.textContent = '😎';
        } else {
            p1Name.textContent = 'Oyuncu';
            p2Name.textContent = 'Bilgisayar';
            goLabel1.textContent = 'Oyuncu';
            goEmoji1.textContent = '😊';
            goLabel2.textContent = 'Bilgisayar';
            goEmoji2.textContent = '🤖';
        }
    }

    function getPlayerDisplayName(player) {
        if (gameMode === 'pvp') {
            return player === 1 ? 'Oyuncu 1' : 'Oyuncu 2';
        }
        return player === 1 ? 'Oyuncu' : 'Bilgisayar';
    }

    // ===== STONE RENDERING =====
    function createStoneElements(count, container, isStore = false) {
        container.innerHTML = '';
        const limit = isStore ? 35 : 20; // Allow more stones in store
        const maxVisible = Math.min(count, limit);
        
        if (isStore && count > 12) {
            container.classList.add('scrambled');
            // Fixed random positions to prevent jumpy movement between identical stone counts
            // We use seed or stable randomness based on count or just random
            for (let i = 0; i < maxVisible; i++) {
                const stone = document.createElement('div');
                stone.className = 'stone scrambled-stone';
                // Randomly spread in container bounds (80x80px approx)
                const rx = 15 + (Math.random() * 70); // 15% to 85% width
                const ry = 25 + (Math.random() * 50); // 25% to 75% height (safer middle zone)
                stone.style.left = rx + '%';
                stone.style.top = ry + '%';
                stone.style.transform = `translate(-50%, -50%) rotate(${Math.random() * 360}deg)`;
                // Small variation in scale for "pile" effect
                stone.style.zIndex = i;
                container.appendChild(stone);
            }
        } else {
            container.classList.remove('scrambled');
            for (let i = 0; i < maxVisible; i++) {
                const stone = document.createElement('div');
                stone.className = 'stone';
                container.appendChild(stone);
            }
        }
    }

    // ===== BOARD RENDERING =====
    function renderBoard() {
        for (let i = 0; i < PITS_PER_PLAYER; i++) {
            renderSinglePit(i);
            renderSinglePit(i + 7);
        }
        renderStore(1);
        renderStore(2);
        updateScores();
        updateClickablePits();
    }

    function renderSinglePit(index) {
        const pitEl = document.getElementById('pit-' + index);
        if (!pitEl) return;
        const stonesContainer = pitEl.querySelector('.pit-stones');
        const countEl = pitEl.querySelector('.pit-count');
        countEl.textContent = board[index];
        createStoneElements(board[index], stonesContainer, false);
    }

    function renderStore(player) {
        const storeIndex = player === 1 ? P1_STORE : P2_STORE;
        const stonesContainer = document.getElementById('store-' + player + '-stones');
        const countEl = document.getElementById('store-' + player + '-count');
        countEl.textContent = board[storeIndex];
        createStoneElements(board[storeIndex], stonesContainer, true);
    }

    function updateScores() {
        const store1 = document.getElementById('store-1');
        const store2 = document.getElementById('store-2');
        store1.classList.toggle('active-turn', currentPlayer === 1 && !gameOver);
        store2.classList.toggle('active-turn', currentPlayer === 2 && !gameOver);
    }

    function updateClickablePits() {
        // Player 1 pits
        for (let i = 0; i < PITS_PER_PLAYER; i++) {
            const pit = document.getElementById('pit-' + i);
            if (currentPlayer === 1 && !gameOver && !animating && board[i] > 0) {
                pit.classList.add('clickable');
            } else {
                pit.classList.remove('clickable');
            }
        }
        // Player 2 pits (only clickable in PvP mode when it's P2's turn)
        for (let i = 7; i <= 12; i++) {
            const pit = document.getElementById('pit-' + i);
            if (gameMode === 'pvp' && currentPlayer === 2 && !gameOver && !animating && board[i] > 0) {
                pit.classList.add('clickable');
            } else {
                pit.classList.remove('clickable');
            }
        }
    }

    // ===== GAME INITIALIZATION =====
    function initGame() {
        board = new Array(TOTAL_PITS).fill(0);
        for (let i = 0; i < PITS_PER_PLAYER; i++) {
            board[i] = INITIAL_STONES;          // P1 pits
            board[i + 7] = INITIAL_STONES;      // P2 pits
        }
        board[P1_STORE] = 0;
        board[P2_STORE] = 0;
        currentPlayer = 1;
        gameOver = false;
        animating = false;
        updatePlayerLabels();
        renderBoard();
        setStatus('Oynamak için bir çukur seçin', false);
        closeGameOver();
    }

    function setStatus(msg, highlight) {
        statusMessage.textContent = msg;
        if (highlight) {
            statusMessage.classList.add('highlight');
        } else {
            statusMessage.classList.remove('highlight');
        }
    }

    // ===== GAME LOGIC =====
    function getPlayerPits(player) {
        if (player === 1) return [0, 1, 2, 3, 4, 5];
        return [7, 8, 9, 10, 11, 12];
    }

    function getPlayerStore(player) {
        return player === 1 ? P1_STORE : P2_STORE;
    }

    function getOpponentStore(player) {
        return player === 1 ? P2_STORE : P1_STORE;
    }

    function getOppositePit(pitIndex) {
        // Pit 0 <-> 12, 1 <-> 11, 2 <-> 10, 3 <-> 9, 4 <-> 8, 5 <-> 7
        return 12 - pitIndex;
    }

    function isPlayerPit(player, pitIndex) {
        if (player === 1) return pitIndex >= 0 && pitIndex <= 5;
        return pitIndex >= 7 && pitIndex <= 12;
    }

    function checkGameOver() {
        const p1Empty = getPlayerPits(1).every(i => board[i] === 0);
        const p2Empty = getPlayerPits(2).every(i => board[i] === 0);
        return p1Empty || p2Empty;
    }

    function finishGame() {
        gameOver = true;
        // Collect remaining stones
        for (const i of getPlayerPits(1)) {
            board[P1_STORE] += board[i];
            board[i] = 0;
        }
        for (const i of getPlayerPits(2)) {
            board[P2_STORE] += board[i];
            board[i] = 0;
        }
        renderBoard();
        showGameOver();
    }

    function showGameOver() {
        const s1 = board[P1_STORE];
        const s2 = board[P2_STORE];
        document.getElementById('final-score-1').textContent = s1;
        document.getElementById('final-score-2').textContent = s2;
        const title = document.getElementById('gameover-title');
        const msg = document.getElementById('gameover-message');

        const players = document.querySelectorAll('.gameover-player');
        players.forEach(p => p.classList.remove('winner'));

        if (s1 > s2) {
            if (gameMode === 'pvp') {
                title.textContent = '🎉 Oyun Bitti!';
                msg.textContent = 'Oyuncu 1 kazandı!';
                setStatus('Oyuncu 1 kazandı! 🎉', true);
                playSound('win');
            } else {
                title.textContent = '🎉 Tebrikler!';
                msg.textContent = 'Oyuncu kazandı!';
                setStatus('Tebrikler, kazandınız! 🎉', true);
                playSound('win');
            }
            players[0].classList.add('winner');
        } else if (s2 > s1) {
            if (gameMode === 'pvp') {
                title.textContent = '🎉 Oyun Bitti!';
                msg.textContent = 'Oyuncu 2 kazandı!';
                setStatus('Oyuncu 2 kazandı! 🎉', true);
                playSound('win');
            } else {
                title.textContent = '😔 Oyun Bitti';
                msg.textContent = 'Bilgisayar kazandı!';
                setStatus('Bilgisayar kazandı. Tekrar deneyin!', true);
                playSound('lose');
            }
            players[1].classList.add('winner');
        } else {
            title.textContent = '🤝 Berabere!';
            msg.textContent = 'Harika bir mücadele oldu!';
            setStatus('Berabere! Harika oyundu! 🤝', true);
        }

        setTimeout(() => openGameOver(), 600);
    }

    // ===== HELPERS FOR FLYING ANIMATION =====
    function getPitElement(index) {
        if (index === P1_STORE) return document.getElementById('store-1');
        if (index === P2_STORE) return document.getElementById('store-2');
        return document.getElementById('pit-' + index);
    }

    function getCenterPosition(el) {
        const rect = el.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    function createFlyingStone() {
        const stone = document.createElement('div');
        stone.className = 'flying-stone';
        document.body.appendChild(stone);
        return stone;
    }

    function animateStoneTo(stone, targetPos) {
        return new Promise(resolve => {
            stone.style.left = (targetPos.x - 7) + 'px';
            stone.style.top = (targetPos.y - 7) + 'px';
            const onEnd = () => {
                stone.removeEventListener('transitionend', onEnd);
                resolve();
            };
            stone.addEventListener('transitionend', onEnd);
            // Fallback in case transitionend doesn't fire
            setTimeout(resolve, 400);
        });
    }

    // ===== SOW STONES (Animated) =====
    async function sowStones(pitIndex, player) {
        animating = true;
        updateClickablePits();

        const stones = board[pitIndex];
        const sourcePitEl = getPitElement(pitIndex);
        const sourcePos = getCenterPosition(sourcePitEl);

        // Play pickup animation
        sourcePitEl.classList.add('pit-pickup');

        // Track how many stones remain visually in the source pit
        // We do NOT clear the source pit immediately — we remove stones one by one
        let remainingInSource = stones;

        // Set the board state to 0 internally for this pit (game logic)
        board[pitIndex] = 0;

        // But visually keep the stones until each one "departs"
        // We'll update the pit count but keep stones visible
        // Don't call renderSinglePit yet — we manually manage the visual

        await delay(200);

        let currentIndex = pitIndex;
        const opponentStore = getOpponentStore(player);

        for (let s = 0; s < stones; s++) {
            currentIndex = (currentIndex + 1) % TOTAL_PITS;
            // Skip opponent's store
            if (currentIndex === opponentStore) {
                currentIndex = (currentIndex + 1) % TOTAL_PITS;
            }

            // Remove one stone visually from the source pit
            remainingInSource--;
            updatePitVisual(pitIndex, remainingInSource);

            // Create a flying stone at source position
            const flyStone = createFlyingStone();
            const currentSourcePos = getCenterPosition(sourcePitEl);
            flyStone.style.left = (currentSourcePos.x - 7) + 'px';
            flyStone.style.top = (currentSourcePos.y - 7) + 'px';

            // Force layout so starting position is applied
            void flyStone.offsetWidth;

            // Get target position
            const targetEl = getPitElement(currentIndex);
            const targetPos = getCenterPosition(targetEl);

            // Animate the flying stone to target
            await animateStoneTo(flyStone, targetPos);

            // Update board state then render only the changed pit
            board[currentIndex]++;
            flyStone.remove();
            if (currentIndex === P1_STORE || currentIndex === P2_STORE) {
                renderStore(currentIndex === P1_STORE ? 1 : 2);
                updateScores();
            } else {
                renderSinglePit(currentIndex);
            }

            // Highlight the pit where stone was dropped
            highlightPit(currentIndex);
            playSound('drop');

            await delay(80);
        }

        sourcePitEl.classList.remove('pit-pickup');

        // Check special rules for last stone position
        const lastIndex = currentIndex;

        // Extra turn: last stone in own store
        if (lastIndex === getPlayerStore(player)) {
            animating = false;
            if (checkGameOver()) {
                finishGame();
                return;
            }
            if (gameMode === 'ai') {
                if (player === 1) {
                    setStatus('Son taş hazinenize düştü! Tekrar oynayın 🌟', true);
                    renderBoard();
                } else {
                    // AI gets extra turn
                    setStatus('Bilgisayar ekstra hamle kazandı!', false);
                    renderBoard();
                    setTimeout(() => aiTurn(), 800);
                }
            } else {
                // PvP mode
                setStatus(`Son taş hazineye düştü! ${getPlayerDisplayName(player)} tekrar oynuyor 🌟`, true);
                renderBoard();
                // In PvP mode, same player continues (pits already updated)
            }
            return;
        }

        // Capture: last stone in own empty pit (was 1 now, meaning it was 0 before)
        if (isPlayerPit(player, lastIndex) && board[lastIndex] === 1) {
            const oppositeIndex = getOppositePit(lastIndex);
            if (board[oppositeIndex] > 0) {
                const captured = board[oppositeIndex] + 1; // opposite + the stone itself
                board[getPlayerStore(player)] += captured;
                board[oppositeIndex] = 0;
                board[lastIndex] = 0;

                // Animate capture
                highlightCapture(lastIndex);
                highlightCapture(oppositeIndex);
                await delay(400);
                renderBoard();
                animateScore(player);
                playSound('capture');

                setStatus(`${captured} taş ele geçirildi! ✨`, true);
            }
        }

        animating = false;

        if (checkGameOver()) {
            finishGame();
            return;
        }

        // Switch turn
        currentPlayer = player === 1 ? 2 : 1;
        renderBoard();

        if (gameMode === 'ai') {
            if (currentPlayer === 2) {
                setStatus('Bilgisayar düşünüyor...', false);
                setTimeout(() => aiTurn(), 900);
            } else {
                setStatus('Sıra sizde! Bir çukur seçin', false);
            }
        } else {
            // PvP mode
            setStatus(`Sıra ${getPlayerDisplayName(currentPlayer)}\'de! Bir çukur seçin`, false);
        }
    }

    /**
     * Update a pit's visual display without changing the board array.
     * Used during sowing animation to show stones being picked up one by one.
     */
    function updatePitVisual(index, visualCount) {
        const isStore = (index === P1_STORE || index === P2_STORE);
        const containerId = isStore ? 
            (index === P1_STORE ? 'store-1' : 'store-2') : 
            'pit-' + index;
        
        const parentEl = document.getElementById(containerId);
        if (!parentEl) return;
        
        let stonesContainer;
        if (isStore) {
            stonesContainer = document.getElementById('store-' + (index === P1_STORE ? '1' : '2') + '-stones');
        } else {
            stonesContainer = parentEl.querySelector('.pit-stones');
        }

        const countEl = isStore ? 
            document.getElementById('store-' + (index === P1_STORE ? '1' : '2') + '-count') : 
            parentEl.querySelector('.pit-count');
            
        countEl.textContent = visualCount;
        createStoneElements(visualCount, stonesContainer, isStore);
    }

    function highlightPit(index) {
        let el;
        if (index === P1_STORE) el = document.getElementById('store-1');
        else if (index === P2_STORE) el = document.getElementById('store-2');
        else el = document.getElementById('pit-' + index);
        if (el) {
            el.classList.remove('last-drop');
            void el.offsetWidth; // trigger reflow
            el.classList.add('last-drop');
        }
    }

    function highlightCapture(index) {
        const el = document.getElementById('pit-' + index);
        if (el) {
            el.classList.remove('captured');
            void el.offsetWidth;
            el.classList.add('captured');
        }
    }

    function animateScore(player) {
        const storeCount = document.getElementById('store-' + player + '-count');
        storeCount.classList.remove('score-animate');
        void storeCount.offsetWidth;
        storeCount.classList.add('score-animate');
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===== AI LOGIC =====
    function aiTurn() {
        if (gameOver || currentPlayer !== 2) return;

        const validPits = getPlayerPits(2).filter(i => board[i] > 0);
        if (validPits.length === 0) {
            finishGame();
            return;
        }

        const bestPit = aiChoosePit(validPits);
        sowStones(bestPit, 2);
    }

    function aiChoosePit(validPits) {
        // Strategy: evaluate each move
        let bestScore = -Infinity;
        let bestPit = validPits[0];

        for (const pit of validPits) {
            const score = evaluateMove(pit, 2);
            if (score > bestScore) {
                bestScore = score;
                bestPit = pit;
            }
        }

        return bestPit;
    }

    function evaluateMove(pitIndex, player) {
        // Simulate the move
        const simBoard = [...board];
        let score = 0;

        const stones = simBoard[pitIndex];
        simBoard[pitIndex] = 0;

        let current = pitIndex;
        const opponentStore = getOpponentStore(player);

        for (let s = 0; s < stones; s++) {
            current = (current + 1) % TOTAL_PITS;
            if (current === opponentStore) {
                current = (current + 1) % TOTAL_PITS;
            }
            simBoard[current]++;
        }

        const lastIndex = current;
        const store = getPlayerStore(player);

        // Bonus for landing in own store (extra turn)
        if (lastIndex === store) {
            score += 10;
        }

        // Bonus for capturing
        if (isPlayerPit(player, lastIndex) && simBoard[lastIndex] === 1) {
            const opposite = getOppositePit(lastIndex);
            if (simBoard[opposite] > 0) {
                score += simBoard[opposite] + 1;
            }
        }

        // Prefer moves that add to store
        const storeGain = simBoard[store] - board[store];
        score += storeGain * 2;

        // Slight randomness for variety
        score += Math.random() * 2;

        return score;
    }

    // ===== PIT CLICK HANDLER =====
    function handlePitClick(e) {
        if (animating || gameOver) return;

        const pitEl = e.currentTarget;
        const pitIndex = parseInt(pitEl.dataset.pit);

        if (gameMode === 'ai') {
            // Only Player 1 can click in AI mode
            if (currentPlayer !== 1) return;
            if (pitIndex < 0 || pitIndex > 5) return;
            if (board[pitIndex] === 0) return;
            sowStones(pitIndex, 1);
        } else {
            // PvP mode: the current player clicks their own pits
            if (currentPlayer === 1) {
                if (pitIndex < 0 || pitIndex > 5) return;
                if (board[pitIndex] === 0) return;
                sowStones(pitIndex, 1);
            } else {
                if (pitIndex < 7 || pitIndex > 12) return;
                if (board[pitIndex] === 0) return;
                sowStones(pitIndex, 2);
            }
        }
    }

    // ===== EVENT LISTENERS =====
    function setupEvents() {
        // Init audio on first interaction if sound is enabled
        const handleFirstInteraction = () => {
            if (isSoundEnabled) {
                initAudio();
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume().then(() => {
                        startBGM();
                    });
                } else {
                    startBGM();
                }
            }
            document.removeEventListener('click', handleFirstInteraction);
            document.removeEventListener('touchstart', handleFirstInteraction);
        };
        document.addEventListener('click', handleFirstInteraction);
        document.addEventListener('touchstart', handleFirstInteraction);

        // Theme toggle
        btnTheme.addEventListener('click', () => {
            playSound('click');
            toggleTheme();
        });

        // Sound toggle
        btnSound.addEventListener('click', () => {
            playSound('click');
            toggleSound();
        });

        // Help modal
        btnHelp.addEventListener('click', () => {
            playSound('click');
            openModal();
        });
        btnCloseModal.addEventListener('click', () => {
            playSound('click');
            closeModal();
        });

        // Game mode buttons
        btnVsComputer.addEventListener('click', () => {
            playSound('click');
            setGameMode('ai');
            closeModal();
            setTimeout(initGame, 300);
        });
        btnVsPlayer.addEventListener('click', () => {
            playSound('click');
            setGameMode('pvp');
            closeModal();
            setTimeout(initGame, 300);
        });

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        // Game over modal
        btnPlayAgain.addEventListener('click', () => {
            playSound('click');
            closeGameOver();
            setTimeout(initGame, 300);
        });
        gameoverOverlay.addEventListener('click', (e) => {
            if (e.target === gameoverOverlay) {
                closeGameOver();
                setTimeout(initGame, 300);
            }
        });

        // New game
        btnNewGame.addEventListener('click', () => {
            playSound('click');
            openModal();
        });

        // Pit clicks - All pits (both P1 and P2)
        for (let i = 0; i < PITS_PER_PLAYER; i++) {
            const pit = document.getElementById('pit-' + i);
            pit.addEventListener('click', handlePitClick);
        }
        for (let i = 7; i <= 12; i++) {
            const pit = document.getElementById('pit-' + i);
            pit.addEventListener('click', handlePitClick);
        }

        // Keyboard: Escape to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
                closeGameOver();
            }
        });
    }

    // ===== ORIENTATION HANDLING =====
    function checkOrientation() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isMobile = w < 900 || h < 500;
        const isPortrait = h > w;
        const warning = document.getElementById('orientation-warning');

        if (isMobile && isPortrait) {
            warning.style.display = 'flex';
            document.getElementById('app-header').style.display = 'none';
            document.getElementById('status-bar').style.display = 'none';
            document.getElementById('game-container').style.display = 'none';
            const footer = document.getElementById('app-footer');
            if (footer) footer.style.display = 'none';
        } else {
            warning.style.display = 'none';
            document.getElementById('app-header').style.display = '';
            document.getElementById('status-bar').style.display = '';
            document.getElementById('game-container').style.display = '';
            const footer = document.getElementById('app-footer');
            if (footer) footer.style.display = '';
        }
    }

    // ===== INIT =====
    function init() {
        initTheme();
        
        // Sync sound UI with initial state
        if (isSoundEnabled) {
            iconSoundOn.style.display = 'block';
            iconSoundOff.style.display = 'none';
        } else {
            iconSoundOn.style.display = 'none';
            iconSoundOff.style.display = 'block';
        }

        setupEvents();
        initGame();
        checkOrientation();
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', () => {
            setTimeout(checkOrientation, 100);
        });
        // Always show instructions on load
        setTimeout(openModal, 500);
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
