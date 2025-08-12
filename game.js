class FishingGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.fisherman = document.getElementById('fisherman');
        this.fishingLine = document.getElementById('fishingLine');
        this.hook = document.getElementById('hook');
        
        // Herní data
        this.fishData = [];
        this.fishes = [];
        this.score = 0;
        this.fishCount = 0;
        this.caughtFishNames = [];
        this.bestScore = Number(localStorage.getItem('bestScore') || 0);
        const storedCoins = Number(localStorage.getItem('coins'));
        this.coins = Number.isFinite(storedCoins) ? storedCoins : 0;
        const storedSkin = Number(localStorage.getItem('rodSkinIdx'));
        this.rodSkinIdx = Number.isFinite(storedSkin) ? storedSkin : 0;
        this.activeMissions = [];
        this.reelActive = false;
        this.reelProgress = 0;
        this.reelDurationMs = 2500;
        this.reelTapBoost = 28;
        this.reelDecayPerFrame = 0.25;
        this.reelSuccessThreshold = 50; // %
        this.mouseX = 0;
        this.mouseY = 0;
        this.isReeling = false;
        this.gameStarted = false;
        
        // Nový systém háčku
        this.hookPosition = { x: 0, y: 0 }; // Počáteční pozice háčku - bude nastavena správně
        this.hookTargetY = 0; // Cílová pozice háčku - bude nastavena správně
        this.isHookAnimating = false;
        // Dětský režim: pauza a zvuk
        this.isPaused = false;
        this.soundEnabled = true;
        this.musicEnabled = true;
        this.preferences = this.loadPreferences();
        this.sandboxMode = this.preferences.sandbox || false;
        this.autopilot = !!this.preferences.autopilot;
        this.timerEnabled = this.preferences.timer !== false;
        this.rareMiniGameEnabled = this.preferences.rareMG !== false;
        this.waterBubbles = [];
        this.audioCtx = null;
        
        // Web Speech API
        this.synth = window.speechSynthesis;
        this.setupSpeech();
        
        this.init();
    }

    renderAlbumGrid(albumGrid) {
        if (!albumGrid) return;
        const caughtNames = new Set((this.caughtFishNames || []));
        albumGrid.innerHTML = '';
        for (const fishType of this.fishData) {
            const card = document.createElement('div');
            card.className = 'album-card';
            const img = document.createElement('img');
            img.src = `ryby/${fishType.image.replace('.jpg', '.png')}`;
            img.alt = fishType.name;
            card.appendChild(img);
            const badge = document.createElement('div');
            badge.className = 'caught-badge';
            badge.textContent = caughtNames.has(fishType.name) ? '✅' : '🔒';
            card.appendChild(badge);
            albumGrid.appendChild(card);
        }
    }
    
    setupSpeech() {
        // Nastavení českého hlasu
        this.voice = null;
        if (this.synth) {
            const voices = this.synth.getVoices();
            // Najdeme český hlas
            this.voice = voices.find(voice => voice.lang.includes('cs')) || voices[0];
            
            // Pokud hlasy ještě nejsou načtené, počkáme
            if (voices.length === 0) {
                this.synth.onvoiceschanged = () => {
                    const newVoices = this.synth.getVoices();
                    this.voice = newVoices.find(voice => voice.lang.includes('cs')) || newVoices[0];
                };
            }
        }
    }
    
    speakFishName(fishName) {
        if (this.synth && this.voice && this.soundEnabled) {
            const utterance = new SpeechSynthesisUtterance(fishName);
            utterance.voice = this.voice;
            utterance.rate = 0.8;
            utterance.pitch = 1;
            utterance.volume = 0.8;
            this.synth.speak(utterance);
        }
    }
    
    async init() {
        try {
            await this.loadFishData();
            this.setupCanvas();
            this.setupEventListeners();
            this.setupMissions();
            this.applyRodSkin();
            this.updateScore();
            this.spawnInitialFish();
            this.startCountdown(() => {
                this.gameLoop();
                this.gameStarted = true;
            });
            this.applyPreferencesToUI();
            this.applySandboxVisibility();
            if (this.timerEnabled) this.scheduleSummary();
            if (this.autopilot) this.startAutopilot();
        } catch (error) {
            console.error('Chyba při inicializaci hry:', error);
        }
    }
    
    async loadFishData() {
        // Nejprve zkusíme embedded JSON v HTML, aby hra fungovala i z file:// bez serveru
        try {
            const dataScript = document.getElementById('fishData');
            if (dataScript && dataScript.textContent && dataScript.textContent.trim().length > 2) {
                this.fishData = JSON.parse(dataScript.textContent);
                if (this.fishData && this.fishData.length) {
                    console.log('Načteno z <script id="fishData">:', this.fishData.length, 'druhů ryb');
                    return;
                }
            }
        } catch (e) {
            console.warn('Embedded fishData nelze parseovat, zkusím fetch.', e);
        }
        // Poté zkusíme fetch na lokální soubor, pokud běží server
        try {
            const response = await fetch('ryby_final.json');
            if (response.ok) {
                this.fishData = await response.json();
                console.log('Načteno z ryby_final.json:', this.fishData.length, 'druhů ryb');
                return;
            }
        } catch {}
        // Nakonec minimální fallback set
        this.fishData = [
            { name: "Kapr Obecný", image: "kapr_obecny.jpg", size_min: 40, size_max: 65, rarity: 5 },
            { name: "Štika Obecná", image: "stika_obecna.jpg", size_min: 40, size_max: 70, rarity: 4 },
            { name: "Plotice Obecná", image: "plotice_obecna.jpg", size_min: 15, size_max: 30, rarity: 1 }
        ];
    }
    
    setupCanvas() {
        // Nastavení rozměrů canvasu podle okna
        const resizeCanvas = () => {
            const rect = this.canvas.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            
            // Nastavení počáteční pozice háčku podle nové výšky canvasu
            this.hookPosition.y = this.canvas.height * 0.15; // Pozice na břehu
            this.hookTargetY = this.canvas.height * 0.15;
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }
    
    setupEventListeners() {
        // Pohyb myši
        document.addEventListener('mousemove', (e) => {
            if (this.isPaused) return;
            if (this.autopilot) return; // autopilot řídí rybáře
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            this.updateFishermanPosition();
        });

        // Dotykový pohyb (pro děti na mobilech/tabletech)
        this.canvas.addEventListener('touchmove', (e) => {
            if (this.isPaused) return;
            if (this.autopilot) return; // autopilot řídí rybáře
            if (!e.touches || e.touches.length === 0) return;
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = touch.clientX - rect.left;
            this.mouseY = touch.clientY - rect.top;
            this.updateFishermanPosition();
            e.preventDefault();
        }, { passive: false });
        
        // Kliknutí pro rybaření
        this.canvas.addEventListener('click', (e) => {
            if (this.isPaused) return;
            if (!this.isReeling && !this.isHookAnimating) {
                this.startFishing(e);
            }
        });

        // Dotyk pro rybaření
        this.canvas.addEventListener('touchstart', (e) => {
            if (this.isPaused) return;
            if (!this.isReeling && !this.isHookAnimating) {
                const touch = e.touches && e.touches[0] ? e.touches[0] : e.changedTouches[0];
                // Vytvořit event-like objekt s clientX/Y
                const evt = { clientX: touch.clientX, clientY: touch.clientY };
                this.startFishing(evt);
            }
            e.preventDefault();
        }, { passive: false });
        
        // Ikonová tlačítka
        const togglePauseBtn = document.getElementById('togglePause');
        const toggleSoundBtn = document.getElementById('toggleSound');
        const toggleMusicBtn = document.getElementById('toggleMusic');
        const toggleSandboxBtn = document.getElementById('toggleSandbox');
        const toggleAutopilotBtn = document.getElementById('toggleAutopilot');
        const toggleTimerBtn = document.getElementById('toggleTimer');
        const toggleRareMGBtn = document.getElementById('toggleRareMG');
        const openAlbumBtn = document.getElementById('openAlbum');
        const closeAlbumBtn = document.getElementById('closeAlbum');
        const albumModal = document.getElementById('albumModal');
        const albumGrid = document.getElementById('albumGrid');
        const openPhotoBtn = document.getElementById('openPhoto');
        const photoOverlay = document.getElementById('photoOverlay');
        const closePhotoBtn = document.getElementById('closePhoto');
        const cycleSkinBtn = document.getElementById('cycleSkin');
        const dailyRewardBtn = document.getElementById('dailyReward');
        const rewardModal = document.getElementById('rewardModal');
        const rewardAmount = document.getElementById('rewardAmount');
        const closeReward = document.getElementById('closeReward');
        const skinModal = document.getElementById('skinModal');
        const closeSkin = document.getElementById('closeSkin');
        const skinGrid = document.getElementById('skinGrid');
        if (togglePauseBtn) {
            togglePauseBtn.addEventListener('click', () => {
                this.isPaused = !this.isPaused;
                const icon = document.getElementById('pauseIcon');
                if (icon) icon.textContent = this.isPaused ? '▶️' : '⏸️';
                togglePauseBtn.classList.toggle('active', this.isPaused);
            });
        }
        if (toggleSoundBtn) {
            toggleSoundBtn.addEventListener('click', () => {
                this.soundEnabled = !this.soundEnabled;
                const icon = document.getElementById('soundIcon');
                if (icon) icon.textContent = this.soundEnabled ? '🔊' : '🔇';
                toggleSoundBtn.classList.toggle('active', this.soundEnabled);
            });
        }
        if (toggleMusicBtn) {
            toggleMusicBtn.addEventListener('click', () => {
                this.musicEnabled = !this.musicEnabled;
                const icon = document.getElementById('musicIcon');
                if (icon) icon.textContent = this.musicEnabled ? '🎵' : '❌';
                if (this.musicEnabled) this.startMusic(); else this.stopMusic();
                toggleMusicBtn.classList.toggle('active', this.musicEnabled);
            });
        }
        if (toggleSandboxBtn) {
            toggleSandboxBtn.addEventListener('click', () => {
                this.sandboxMode = !this.sandboxMode;
                this.preferences.sandbox = this.sandboxMode;
                this.savePreferences();
                toggleSandboxBtn.classList.toggle('active', this.sandboxMode);
                this.applySandboxVisibility();
            });
            toggleSandboxBtn.classList.toggle('active', this.sandboxMode);
        }
        if (toggleAutopilotBtn) {
            toggleAutopilotBtn.addEventListener('click', () => {
                this.autopilot = !this.autopilot;
                this.preferences.autopilot = this.autopilot;
                this.savePreferences();
                toggleAutopilotBtn.classList.toggle('active', this.autopilot);
                if (this.autopilot) this.startAutopilot(); else this.stopAutopilot();
            });
            toggleAutopilotBtn.classList.toggle('active', this.autopilot);
        }
        if (toggleTimerBtn) {
            toggleTimerBtn.addEventListener('click', () => {
                this.timerEnabled = !this.timerEnabled;
                this.preferences.timer = this.timerEnabled;
                this.savePreferences();
                toggleTimerBtn.classList.toggle('active', this.timerEnabled);
                if (this.timerEnabled) this.scheduleSummary(); else if (this.summaryTimer) clearTimeout(this.summaryTimer);
            });
            toggleTimerBtn.classList.toggle('active', this.timerEnabled);
        }
        if (toggleRareMGBtn) {
            toggleRareMGBtn.addEventListener('click', () => {
                this.rareMiniGameEnabled = !this.rareMiniGameEnabled;
                this.preferences.rareMG = this.rareMiniGameEnabled;
                this.savePreferences();
                toggleRareMGBtn.classList.toggle('active', this.rareMiniGameEnabled);
            });
            toggleRareMGBtn.classList.toggle('active', this.rareMiniGameEnabled);
        }
        const openPrefsBtn = document.getElementById('openPrefs');
        const prefsModal = document.getElementById('prefsModal');
        const closePrefs = document.getElementById('closePrefs');
        if (openPrefsBtn && prefsModal) {
            openPrefsBtn.addEventListener('click', () => {
                this.isPaused = true;
                const icon = document.getElementById('pauseIcon');
                if (icon) icon.textContent = '▶️';
                prefsModal.classList.add('show');
                this.renderPreferences();
            });
        }
        if (closePrefs && prefsModal) {
            closePrefs.addEventListener('click', () => {
                prefsModal.classList.remove('show');
                this.isPaused = false;
                const icon = document.getElementById('pauseIcon');
                if (icon) icon.textContent = '⏸️';
            });
        }

        // Album
        if (openAlbumBtn && albumModal) {
            openAlbumBtn.addEventListener('click', () => {
                this.isPaused = true;
                const icon = document.getElementById('pauseIcon');
                if (icon) icon.textContent = '▶️';
                this.renderAlbumGrid(albumGrid);
                albumModal.classList.add('show');
            });
        }
        if (closeAlbumBtn && albumModal) {
            closeAlbumBtn.addEventListener('click', () => {
                albumModal.classList.remove('show');
                this.isPaused = false;
                const icon = document.getElementById('pauseIcon');
                if (icon) icon.textContent = '⏸️';
            });
        }
        if (cycleSkinBtn) {
            cycleSkinBtn.addEventListener('click', () => {
                // otevřít shop místo cyklu
                this.isPaused = true;
                const icon = document.getElementById('pauseIcon');
                if (icon) icon.textContent = '▶️';
                this.renderSkinShop(skinGrid);
                if (skinModal) skinModal.classList.add('show');
            });
        }

        // Foto/Sandbox režim – sandbox schová vše kromě horního menu a scény
        if (openPhotoBtn && photoOverlay) {
            openPhotoBtn.addEventListener('click', () => {
                this.isPaused = true;
                photoOverlay.classList.add('show');
                document.querySelector('.controls')?.classList.add('sandbox-overlay-hidden');
                document.getElementById('missionsPanel')?.classList.add('sandbox-overlay-hidden');
                document.getElementById('infoPanel')?.classList.add('sandbox-overlay-hidden');
            });
        }
        if (closePhotoBtn && photoOverlay) {
            closePhotoBtn.addEventListener('click', () => {
                photoOverlay.classList.remove('show');
                this.isPaused = false;
                document.querySelector('.controls')?.classList.remove('sandbox-overlay-hidden');
                document.getElementById('missionsPanel')?.classList.remove('sandbox-overlay-hidden');
                document.getElementById('infoPanel')?.classList.remove('sandbox-overlay-hidden');
            });
        }

        // Denní odměna
        if (dailyRewardBtn) {
            dailyRewardBtn.addEventListener('click', () => this.tryDailyReward());
        }
        if (closeReward && rewardModal) {
            closeReward.addEventListener('click', () => rewardModal.classList.remove('show'));
        }
        if (closeSkin && skinModal) {
            closeSkin.addEventListener('click', () => {
                skinModal.classList.remove('show');
                this.isPaused = false;
                const icon = document.getElementById('pauseIcon');
                if (icon) icon.textContent = '⏸️';
            });
        }
    }
    
    updateFishermanPosition() {
        const maxX = this.canvas.width - 40;
        const fishermanX = Math.max(40, Math.min(maxX, this.mouseX));
        
        this.fisherman.style.left = fishermanX + 'px';
        
        // Aktualizace pozice háčku podle pozice rybáře
        this.hookPosition.x = fishermanX;
    }

    moveFishermanTo(x) {
        const maxX = this.canvas.width - 40;
        const fishermanX = Math.max(40, Math.min(maxX, x));
        this.fisherman.style.left = fishermanX + 'px';
        this.hookPosition.x = fishermanX;
    }
    
    spawnInitialFish() {
        // Snížený počet ryb pro lepší gameplay s většími rybami
        for (let i = 0; i < 15; i++) {
            this.spawnFish();
        }
        console.log(`Spawned ${this.fishes.length} fish`);
    }
    
    spawnFish() {
        const fishType = this.selectRandomFish();
        if (!fishType) return;
        
        // Generování náhodné velikosti mezi min a max
        const randomSize = fishType.size_min + Math.random() * (fishType.size_max - fishType.size_min);
        
        const fish = {
            ...fishType,
            id: Math.random().toString(36).substr(2, 9),
            x: Math.random() * this.canvas.width,
            y: this.canvas.height * 0.40 + Math.random() * (this.canvas.height * 0.55), // Ryby se spawnují ve vodě
            vx: (Math.random() - 0.5) * 0.8, // Zpomalené ryby
            vy: (Math.random() - 0.5) * 0.3,
            actualSize: randomSize, // Skutečná velikost této konkrétní ryby
            scale: this.getFishScale(randomSize), // Škálování podle skutečné velikosti
            depth: Math.random() * 0.8 + 0.2, // 0.2 - 1.0 (blíž k 1 = blíž k hladině)
            swimmingPhase: Math.random() * Math.PI * 2,
            imagePath: `ryby/${fishType.image.replace('.jpg', '.png')}`,
            imageElement: null,
            imageLoaded: false,
            // Nový systém životnosti pro rychlejší střídání
            lifespan: 15000 + Math.random() * 10000, // 15-25 sekund
            birthTime: Date.now(),
            isLeaving: false
        };

        // Malá šance na duhovou rybu (speciální)
        if (Math.random() < 0.04) {
            fish.isRainbow = true;
            fish.rarity = Math.min(10, (fish.rarity || 5) + 2);
        }
        
        // Načtení obrázku ryby
        const img = new Image();
        img.onload = () => {
            fish.imageElement = img;
            fish.imageLoaded = true;
            // Uložení skutečných rozměrů obrázku pro správné poměry stran
            fish.imageWidth = img.naturalWidth;
            fish.imageHeight = img.naturalHeight;
            fish.aspectRatio = img.naturalWidth / img.naturalHeight;
            console.log(`Loaded: ${fish.name} (${img.naturalWidth}x${img.naturalHeight}, ratio: ${fish.aspectRatio.toFixed(2)})`);
        };
        img.onerror = () => {
            console.warn('Nepodařilo se načíst obrázek ryby:', fish.imagePath);
            console.log('Původní image název:', fishType.image);
            console.log('Finální cesta:', fish.imagePath);
        };
        img.src = fish.imagePath;
        
        this.fishes.push(fish);
    }
    
    selectRandomFish() {
        if (this.fishData.length === 0) return null;
        
        // Vyváženější výběr ryby podle vzácnosti - menší rozdíly mezi raritami
        const weights = this.fishData.map(fish => {
            // Nový systém: rarity 1 = 6 bodů, rarity 10 = 1 bod (místo 9 vs 1)
            // Exponenciální pokles pro plynulejší distribuci
            return Math.max(1, Math.round(6 - (fish.rarity - 1) * 0.6));
        });
        
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < this.fishData.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                const selectedFish = this.fishData[i];
                return selectedFish;
            }
        }
        
        return this.fishData[0];
    }
    
    getFishScale(size) {
        // Větší škálování pro lepší viditelnost: 5-120 cm -> 0.8-4.0
        // Menší ryby budou skutečně menší, větší skutečně větší
        const scale = Math.max(0.8, Math.min(4.0, size / 30));
        return scale;
    }
    
    startFishing(e) {
        if (this.isHookAnimating) return;
        
        this.isReeling = true;
        this.isHookAnimating = true;
        
        // Animace prutu a rybáře při házení
        const fisherman = document.getElementById('fisherman');
        if (fisherman) {
            fisherman.classList.add('casting');
            setTimeout(() => {
                fisherman.classList.remove('casting');
            }, 600);
        }
        
        // Cílová pozice háčku podle kliknutí
        const rect = this.canvas.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const waterSurface = this.canvas.height * 0.35; // Voda začíná pod břehem
        this.hookTargetY = Math.max(waterSurface, Math.min(this.canvas.height - 50, clickY));
        
        console.log(`Házím háček na pozici: ${this.hookPosition.x}, ${this.hookTargetY}`);
        
        // Perfect hod efekt a bonus
        this.checkPerfectThrow(e);
        // Splash efekt u dopadu
        this.createSplash(this.hookPosition.x, this.hookTargetY);
        this.playSplashSound();
        // Animace háčku dolů
        this.animateHookDown();
    }
    
    animateHookDown() {
        const startY = this.hookPosition.y;
        const targetY = this.hookTargetY;
        const animationDuration = 600; // Rychlejší animace
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / animationDuration, 1);
            
            // Pohyb háčku dolů
            this.hookPosition.y = startY + (targetY - startY) * progress;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Háček dosáhl cíle, kontrola chycení
                setTimeout(() => {
                    this.checkForCatchAtHook();
                    this.animateHookUp();
                }, 200); // Kratší pauza
            }
        };
        
        animate();
    }
    
    animateHookUp() {
        const startY = this.hookPosition.y;
        const targetY = this.canvas.height * 0.15; // Pozice na břehu
        const animationDuration = 400; // Rychlejší návrat
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / animationDuration, 1);
            
            // Pohyb háčku nahoru
            this.hookPosition.y = startY + (targetY - startY) * progress;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Konec animace
                this.hookPosition.y = this.canvas.height * 0.15; // Reset na pozici břehu
                this.isHookAnimating = false;
                this.isReeling = false;
                
                // Reset prutu
                const rod = document.querySelector('.rod');
                if (rod) {
                    rod.style.transform = 'rotate(0deg)';
                }
            }
        };
        
        animate();
    }
    
    checkForCatchAtHook() {
        const catchRadius = 230; // Větší dosah pro děti + tolerance
        
        let closestFish = null;
        let closestDistance = Infinity;
        let bestCatchChance = 0;
        // Easy assist po 10s bez úlovku: dočasně zvětši šanci
        const longNoCatch = this.lastCatchAt ? (Date.now() - this.lastCatchAt > 10000) : true;
        
        // Najdi nejbližší rybu v dosahu
        for (let fish of this.fishes) {
            // Kontrola vzdálenosti od háčku k tělu ryby
            const distanceToFish = Math.sqrt(
                Math.pow(fish.x - this.hookPosition.x, 2) + 
                Math.pow(fish.y - this.hookPosition.y, 2)
            );
            
            // Kontrola jestli je ryba v dosahu
            if (distanceToFish < catchRadius) {
                const baseChance = Math.max(0, 1 - (distanceToFish / catchRadius));
                const rarityPenalty = fish.rarity * 0.01; // Velmi malá penalta za vzácnost
                let catchChance = Math.max(0.85, baseChance - rarityPenalty); // Minimální 85% šance
                if (longNoCatch) catchChance = Math.min(1, catchChance + 0.1);
                
                console.log(`🎣 Ryba ${fish.name} na vzdálenosti ${distanceToFish.toFixed(1)}, šance: ${(catchChance * 100).toFixed(1)}%`);
                
                // Vyber nejbližší rybu (nebo tu s nejvyšší šancí při stejné vzdálenosti)
                if (distanceToFish < closestDistance || 
                   (distanceToFish === closestDistance && catchChance > bestCatchChance)) {
                    closestFish = fish;
                    closestDistance = distanceToFish;
                    bestCatchChance = catchChance;
                }
            }
        }
        
        // Auto-assist: jemné přitažení nejbližší ryby k háčku
        if (closestFish && closestDistance > 6 && closestDistance < catchRadius) {
            const pullStrength = 0.45; // ještě jistější zásah
            const dx = this.hookPosition.x - closestFish.x;
            const dy = this.hookPosition.y - closestFish.y;
            closestFish.x += dx * pullStrength;
            closestFish.y += dy * pullStrength;
        }

        // Pokus o chycení nejbližší ryby
        if (closestFish && Math.random() < Math.max(0.96, bestCatchChance + 0.06)) {
            console.log(`✅ Chytám nejbližší rybu: ${closestFish.name} na vzdálenosti ${closestDistance.toFixed(1)}`);
            // pro vzácné ryby je nutné uspět v minihře
            // na autopilota vždy ignoruj minihru
            if (!this.autopilot && !this.reelActive && closestFish.rarity >= 7 && this.rareMiniGameEnabled) {
                // Dětská verze minihry: kratší threshold, delší čas, větší boost
                this.reelDurationMs = 2500;
                this.reelTapBoost = 28;
                this.reelDecayPerFrame = 0.25;
                this.reelSuccessThreshold = 50;
                this.startReelMiniGame(this.reelDurationMs);
                const fishToCatch = closestFish;
                // Polling na dokončení lišty
                const waitEnd = () => {
                    if (!this.reelActive && this.reelProgress >= this.reelSuccessThreshold) {
                        this.catchFish(fishToCatch);
                    } else if (!this.reelActive) {
                        // neúspěch: nic
                    } else {
                        requestAnimationFrame(waitEnd);
                    }
                };
                requestAnimationFrame(waitEnd);
            } else {
                this.catchFish(closestFish);
            }
            return;
        }
        
        console.log('Žádná ryba nebyla chycena na pozici háčku:', this.hookPosition.x, this.hookPosition.y);
    }
    
    catchFish(fish) {
        // Odstranění ryby ze seznamu
        this.fishes = this.fishes.filter(f => f.id !== fish.id);
        
        // Přičtení bodů (vzácnost * velikost + bonus)
        const sizeBonus = Math.ceil(fish.actualSize / 10); // Použití skutečné velikosti
        const rarityBonus = fish.rarity * 5;
        const points = sizeBonus + rarityBonus;
        if (!this.sandboxMode) {
            this.score += points;
        }
        this.fishCount++;
        
        console.log(`Chytil jsi ${fish.name}! +${points} bodů`);
        this.lastCatchAt = Date.now();
        
        // Aktualizace UI
        this.updateScore();
        this.showCatchInfo(fish, points);
        if (!this.caughtFishNames.includes(fish.name)) {
            this.spawnNewSpeciesBadge();
            this.caughtFishNames.push(fish.name);
        }

        // Mise: update
        this.updateMissionsOnCatch(fish);
        
        // Přečtení názvu ryby
        this.speakFishName(fish.name);
        
        // Animace úspěchu
        this.fisherman.classList.add('catch-animation');
        setTimeout(() => {
            this.fisherman.classList.remove('catch-animation');
        }, 500);
        
        // Vizuální efekt úspěchu
        this.createSuccessEffect(this.hookPosition.x, this.hookPosition.y);
        const coinsEarned = Math.max(1, Math.round(fish.rarity / 2)) + (fish.isRainbow ? 3 : 0);
        if (!this.sandboxMode) {
            this.coins += coinsEarned;
        }
        localStorage.setItem('coins', String(this.coins));
        this.updateScore();
        this.createFloatingPoints(this.hookPosition.x, this.hookPosition.y, `+${points}${!this.sandboxMode ? ' ⭐+' + coinsEarned : ''}${fish.isRainbow ? ' 🌈' : ''}`);
        this.launchConfetti(this.hookPosition.x, this.hookPosition.y, fish.rarity >= 7 ? 28 : 16);
        this.playCatchSound();
        this.bumpCombo(this.hookPosition.x, this.hookPosition.y);
        
        // Okamžité vytvoření nové ryby
        this.spawnFish();
        
        // Bonusové ryby při dobrém úlovku
        if (fish.rarity >= 8) {
            setTimeout(() => this.spawnFish(), 500);
        }
    }

    bumpCombo(x, y) {
        const now = Date.now();
        if (!this.combo) this.combo = { count: 0, lastAt: 0 };
        if (now - this.combo.lastAt < 4000) {
            this.combo.count += 1;
        } else {
            this.combo.count = 1;
        }
        this.combo.lastAt = now;
        if (this.combo.count >= 2) {
            const bonus = (this.combo.count - 1) * 5; // x2: +5, x3: +10...
            if (!this.sandboxMode) {
                this.score += bonus;
            }
            this.updateScore();
            const badge = document.createElement('div');
            badge.className = 'combo-badge';
            badge.textContent = `COMBO x${this.combo.count} +${bonus}`;
            badge.style.left = `${x}px`;
            badge.style.top = `${y - 20}px`;
            this.canvas.parentNode.appendChild(badge);
            setTimeout(() => badge.remove(), 1000);
            this.playComboSound(this.combo.count);
        }
    }
    
    createSuccessEffect(x, y) {
        // Zelené kruhy úspěchu
        const effect = document.createElement('div');
        effect.style.position = 'absolute';
        effect.style.left = (x - 25) + 'px';
        effect.style.top = (y - 25) + 'px';
        effect.style.width = '50px';
        effect.style.height = '50px';
        effect.style.borderRadius = '50%';
        effect.style.border = '3px solid #4CAF50';
        effect.style.zIndex = '10';
        effect.style.animation = 'successPulse 1s ease-out';
        effect.style.pointerEvents = 'none';
        
        this.canvas.parentNode.appendChild(effect);
        
        setTimeout(() => {
            effect.remove();
        }, 1000);
    }

    createFloatingPoints(x, y, text) {
        const el = document.createElement('div');
        el.className = 'floating-points';
        el.textContent = text;
        el.style.left = `${x}px`;
        el.style.top = `${y - 10}px`;
        this.canvas.parentNode.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    }

    createSplash(x, y) {
        const splash = document.createElement('div');
        splash.className = 'splash';
        splash.style.left = `${x - 5}px`;
        splash.style.top = `${y - 5}px`;
        this.canvas.parentNode.appendChild(splash);
        setTimeout(() => splash.remove(), 600);
    }

    launchConfetti(x, y, count = 20) {
        const colors = ['#FFD700', '#FF69B4', '#7FFF00', '#00FFFF', '#FFA500'];
        for (let i = 0; i < count; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti';
            const px = x + (Math.random() - 0.5) * 30;
            const py = y + (Math.random() - 0.5) * 30;
            piece.style.left = `${px}px`;
            piece.style.top = `${py}px`;
            piece.style.background = colors[i % colors.length];
            piece.style.transform = `translate(-50%, -50%) rotate(${Math.random() * 360}deg)`;
            this.canvas.parentNode.appendChild(piece);
            setTimeout(() => piece.remove(), 900);
        }
    }

    ensureAudio() {
        if (!this.soundEnabled) return null;
        if (!this.audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            this.audioCtx = new Ctx();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        return this.audioCtx;
    }

    playPerfectSound() {
        const ctx = this.ensureAudio();
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        const now = ctx.currentTime;
        o.frequency.setValueAtTime(880, now);
        o.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(now + 0.2);
    }

    playComboSound(multiplier) {
        const ctx = this.ensureAudio();
        if (!ctx) return;
        const notes = [523, 659, 784];
        const len = Math.min(3, Math.max(2, multiplier));
        let t = 0;
        for (let i = 0; i < len; i++) {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'square';
            o.frequency.value = notes[i];
            g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
            g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16);
            o.connect(g).connect(ctx.destination);
            o.start(ctx.currentTime + t);
            o.stop(ctx.currentTime + t + 0.18);
            t += 0.12;
        }
    }

    // --- Hudba ---
    startMusic() {
        const ctx = this.ensureAudio();
        if (!ctx || this.musicNode) return;
        const master = ctx.createGain(); master.gain.value = 0.06;
        // jednoduché arpeggio s obálkou místo konstantního bzučení
        const notes = [220, 277, 330, 440];
        const playNote = (freq, dur = 0.3) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine'; o.frequency.value = freq;
            g.gain.setValueAtTime(0.0001, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
            o.connect(g).connect(master);
            o.start();
            o.stop(ctx.currentTime + dur + 0.02);
            return o;
        };
        const schedule = () => {
            if (!this.musicNode) return;
            const base = ctx.currentTime;
            let t = 0;
            for (let i = 0; i < notes.length; i++) {
                setTimeout(() => {
                    playNote(notes[i], 0.25);
                }, t * 1000);
                t += 0.35;
            }
            // smyčka každé ~1.4 s
            this.musicNode.timer = setTimeout(schedule, 1400);
        };
        master.connect(ctx.destination);
        this.musicNode = { master, nodes: [], timer: null };
        schedule();
    }
    stopMusic() {
        if (!this.musicNode) return;
        if (this.musicNode.timer) clearTimeout(this.musicNode.timer);
        try {
            const ctx = this.audioCtx;
            this.musicNode.master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
            setTimeout(() => this.musicNode && this.musicNode.master.disconnect(), 250);
        } catch {}
        this.musicNode = null;
    }

    // --- Skin prutu ---
    applyRodSkin() {
        const skins = [
            'linear-gradient(to bottom, #8B4513 0%, #A0522D 30%, #D2691E 100%)',
            'linear-gradient(to bottom, #1E90FF 0%, #00BFFF 30%, #87CEFA 100%)',
            'linear-gradient(to bottom, #FFD700 0%, #FFA500 30%, #FF8C00 100%)',
            'linear-gradient(to bottom, #32CD32 0%, #3CB371 30%, #2E8B57 100%)'
        ];
        const skin = skins[this.rodSkinIdx % skins.length];
        document.documentElement.style.setProperty('--rod-gradient', skin);
    }

    cycleRodSkin() {
        // Stojí 5 ⭐, pokud má hráč, jinak jen přepni bez nákupu
        const price = 5;
        if (this.coins >= price) {
            this.coins -= price;
            localStorage.setItem('coins', String(this.coins));
        }
        this.rodSkinIdx = (this.rodSkinIdx + 1) % 1000;
        localStorage.setItem('rodSkinIdx', String(this.rodSkinIdx));
        this.applyRodSkin();
        this.updateScore();
    }

    renderSkinShop(skinGrid) {
        if (!skinGrid) return;
        const skins = [
            { id: 0, name: 'Dřevo', gradient: 'linear-gradient(to bottom, #8B4513 0%, #A0522D 30%, #D2691E 100%)', price: 0 },
            { id: 1, name: 'Modrá', gradient: 'linear-gradient(to bottom, #1E90FF 0%, #00BFFF 30%, #87CEFA 100%)', price: 10 },
            { id: 2, name: 'Zlatá', gradient: 'linear-gradient(to bottom, #FFD700 0%, #FFA500 30%, #FF8C00 100%)', price: 15 },
            { id: 3, name: 'Zelená', gradient: 'linear-gradient(to bottom, #32CD32 0%, #3CB371 30%, #2E8B57 100%)', price: 10 }
        ];
        const ownedKey = 'ownedSkins';
        const owned = JSON.parse(localStorage.getItem(ownedKey) || '[]');
        skinGrid.innerHTML = '';
        for (const skin of skins) {
            const card = document.createElement('div'); card.className = 'skin-card';
            const preview = document.createElement('div'); preview.className = 'skin-preview'; preview.style.background = skin.gradient;
            const title = document.createElement('div'); title.textContent = skin.name;
            const actions = document.createElement('div'); actions.className = 'skin-actions';
            const btn = document.createElement('button'); btn.className = 'icon-btn';
            const isOwned = owned.includes(skin.id) || skin.price === 0;
            btn.textContent = isOwned ? '✅' : `⭐${skin.price}`;
            btn.addEventListener('click', () => {
                if (!isOwned) {
                    if (this.coins >= skin.price) {
                        this.coins -= skin.price;
                        localStorage.setItem('coins', String(this.coins));
                        owned.push(skin.id);
                        localStorage.setItem(ownedKey, JSON.stringify(owned));
                        this.updateScore();
                        this.renderSkinShop(skinGrid);
                    } else {
                        this.playCatchSound();
                    }
                    return;
                }
                // apply
                this.rodSkinIdx = skin.id;
                localStorage.setItem('rodSkinIdx', String(this.rodSkinIdx));
                this.applyRodSkin();
                this.updateScore();
            });
            actions.appendChild(btn);
            card.appendChild(preview); card.appendChild(title); card.appendChild(actions);
            skinGrid.appendChild(card);
        }
    }

    tryDailyReward() {
        const key = 'dailyRewardDate';
        const today = new Date();
        const todayKey = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate();
        const last = localStorage.getItem(key);
        if (last === todayKey) {
            // už vybráno dnes — jemné cinknutí a nic
            this.playCatchSound();
            return;
        }
        // náhodná odměna 5–15 ⭐
        const reward = 5 + Math.floor(Math.random() * 11);
        this.coins += reward;
        localStorage.setItem('coins', String(this.coins));
        localStorage.setItem(key, todayKey);
        this.updateScore();
        const rewardModal = document.getElementById('rewardModal');
        const rewardAmount = document.getElementById('rewardAmount');
        if (rewardAmount) rewardAmount.textContent = `⭐ +${reward}`;
        if (rewardModal) rewardModal.classList.add('show');
        this.launchConfetti(this.canvas.width/2, this.canvas.height*0.2, 36);
        this.playCatchSound();
    }

    playSplashSound() {
        const ctx = this.ensureAudio();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(500, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
    }

    playCatchSound() {
        const ctx = this.ensureAudio();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.16);
    }

    spawnSpotlight(x, y) {
        const overlay = document.createElement('div');
        overlay.className = 'spotlight-overlay';
        overlay.style.left = '0px';
        overlay.style.top = '0px';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = `radial-gradient(200px 140px at ${x}px ${y}px, rgba(255,255,255,0.25), rgba(0,0,0,0.4))`;
        this.canvas.parentNode.appendChild(overlay);
        setTimeout(() => overlay.remove(), 600);
    }

    spawnNewSpeciesBadge() {
        const panel = document.getElementById('infoPanel');
        if (!panel) return;
        const badge = document.createElement('div');
        badge.className = 'new-species-badge';
        badge.textContent = 'Nový druh!';
        const rect = panel.getBoundingClientRect();
        const hostRect = this.canvas.parentNode.getBoundingClientRect();
        badge.style.left = (rect.left - hostRect.left + rect.width/2) + 'px';
        badge.style.top = (rect.top - hostRect.top - 10) + 'px';
        this.canvas.parentNode.appendChild(badge);
        setTimeout(() => badge.remove(), 1000);
    }

    // Perfect hod – bonus body a efekt
    checkPerfectThrow(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        // definuj „sweet spot“: střed a mírně pod hladinou
        const targetY = this.canvas.height * 0.5;
        const dx = Math.abs(clickX - this.hookPosition.x);
        const dy = Math.abs(clickY - targetY);
        const dist = Math.hypot(dx, dy);
        if (dist < 40) {
            // efekt kruhu
            const ring = document.createElement('div');
            ring.className = 'perfect-ring';
            ring.style.left = (clickX - 5) + 'px';
            ring.style.top = (clickY - 5) + 'px';
            this.canvas.parentNode.appendChild(ring);
            setTimeout(() => ring.remove(), 700);
            // badge
            const badge = document.createElement('div');
            badge.className = 'perfect-badge';
            badge.textContent = 'Perfect!';
            badge.style.left = `${clickX}px`;
            badge.style.top = `${clickY - 24}px`;
            this.canvas.parentNode.appendChild(badge);
            setTimeout(() => badge.remove(), 900);
            // skip efekt vlnky
            const ripple = document.createElement('div');
            ripple.className = 'skip-ripple';
            ripple.style.left = `${clickX}px`;
            ripple.style.top = `${this.canvas.height * 0.35 - 4}px`;
            this.canvas.parentNode.appendChild(ripple);
            setTimeout(() => ripple.remove(), 800);
            // bonus body
            if (!this.sandboxMode) {
                this.score += 10;
            }
            this.updateScore();
            this.createFloatingPoints(clickX, clickY, '+10');
            this.playPerfectSound();
        }
    }
    
    showCatchInfo(fish, points) {
        const lastCatch = document.getElementById('lastCatch');
        lastCatch.innerHTML = `
            <div class="fish-info">
                <img src="${fish.imagePath}" alt="${fish.name}" style="max-width: 200px;">
                <div class="rarity-stars" aria-hidden="true">${'⭐'.repeat(Math.min(10, fish.rarity))}</div>
                <div class="points-big" aria-hidden="true">🪙 +${points}</div>
            </div>
        `;
    }
    
    updateScore() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('fishCount').textContent = this.fishCount;
        const best = document.getElementById('bestScore');
        if (best) {
            if (this.score > this.bestScore) {
                this.bestScore = this.score;
                localStorage.setItem('bestScore', String(this.bestScore));
            }
            best.textContent = this.bestScore;
        }
        const coinsEl = document.getElementById('coins');
        if (coinsEl) coinsEl.textContent = this.coins;
        // drobná animace růstu skóre
        const scoreEl = document.querySelector('.score');
        if (scoreEl) {
            scoreEl.classList.remove('score-bounce');
            // force reflow
            void scoreEl.offsetWidth;
            scoreEl.classList.add('score-bounce');
        }
    }
    
    updateFish() {
        // Kontinuální přidávání ryb pokud jich je málo (snížený počet)
        if (this.fishes.length < 12) {
            this.spawnFish();
        }
        
        // Občasné přidání nové ryby pro udržení množství
        if (Math.random() < 0.001 && this.fishes.length < 18) { // Snížená šance a limit
            this.spawnFish();
        }
        
        const currentTime = Date.now();
        
        for (let i = this.fishes.length - 1; i >= 0; i--) {
            const fish = this.fishes[i];
            
            // Kontrola životnosti ryby
            const age = currentTime - fish.birthTime;
            if (age > fish.lifespan) {
                fish.isLeaving = true;
            }
            
            // Pomalejší plavání podle vzorce
            fish.swimmingPhase += 0.01; // Zpomaleno z 0.02
            
            // Základní pohyb - pomalejší
            let moveSpeedMultiplier = 1;
            
            // Rychlejší pohyb pro odcházející ryby
            if (fish.isLeaving) {
                moveSpeedMultiplier = 3; // Rychle odplouvají pryč
                // Odstraněno postupné potápění - způsobovalo klepání
            }
            
            fish.x += fish.vx * 0.5 * moveSpeedMultiplier;
            fish.y += Math.sin(fish.swimmingPhase) * 0.2;
            
            // Lepší kontrola hranic - ryby se otáčejí dříve
            const margin = 100;
            if (fish.x < -margin) {
                if (fish.isLeaving) {
                    // Odstranit rybu která odplula
                    this.fishes.splice(i, 1);
                    this.spawnFish(); // Okamžitě spawn novou
                    continue;
                } else {
                    fish.vx = Math.abs(fish.vx); // Otočit doprava
                    fish.x = -margin + 10;
                }
            }
            
            if (fish.x > this.canvas.width + margin) {
                if (fish.isLeaving) {
                    // Odstranit rybu která odplula
                    this.fishes.splice(i, 1);
                    this.spawnFish(); // Okamžitě spawn novou
                    continue;
                } else {
                    fish.vx = -Math.abs(fish.vx); // Otočit doleva
                    fish.x = this.canvas.width + margin - 10;
                }
            }
            
                        // Vertikální hranice - ryby se nemohou dostat nad vodní hladinu
            const waterSurface = this.canvas.height * 0.35; // Pozice vodní hladiny
            if (fish.y < waterSurface) {
                fish.y = waterSurface;
                fish.vy = Math.abs(fish.vy);
            }
            if (fish.y > this.canvas.height - 50) {
                fish.y = this.canvas.height - 50;
                fish.vy = -Math.abs(fish.vy);
            }
            
            // Náhodné změny směru - méně časté
            if (Math.random() < 0.005) { // Zpomaleno z 0.02
                fish.vx += (Math.random() - 0.5) * 0.3; // Menší změny
                fish.vy += (Math.random() - 0.5) * 0.1;
                
                // Omezení rychlosti - pomalejší maximum
                fish.vx = Math.max(-1, Math.min(1, fish.vx));
                fish.vy = Math.max(-0.5, Math.min(0.5, fish.vy));
            }
            
            // Zjednodušené odstranění ryb - jen na okrajích obrazovky
            if (fish.isLeaving) {
                const screenMargin = 200;
                const isOffScreen = fish.x < -screenMargin || fish.x > this.canvas.width + screenMargin;
                
                if (isOffScreen) {
                    this.fishes.splice(i, 1);
                    this.spawnFish(); // Okamžitě spawn novou
                    continue;
                }
            }
        }
        
        // Kontrola maximálního počtu ryb (sníženo)
        if (this.fishes.length > 20) {
            // Odstranit nejstarší ryby
            this.fishes.sort((a, b) => a.birthTime - b.birthTime);
            this.fishes = this.fishes.slice(-18);
        }

        // Nápověda šipkou: pokud je zapnuto a dlouho nic nechyceno
        if (this.preferences.hints && (!this.lastCatchAt || Date.now() - this.lastCatchAt > 5000)) {
            this.drawHintArrow();
        }
    }

    drawHintArrow() {
        const target = this.findNearestFish();
        if (!target) return;
        const x = target.x;
        const y = target.y;
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
        this.ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - 30);
        this.ctx.lineTo(x - 10, y - 50);
        this.ctx.lineTo(x + 10, y - 50);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    }
    
    render() {
        // Vyčištění canvasu
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Kreslení pozadí
        this.drawBackground();
        
        // Kreslení ryb (seřazené podle hloubky)
        const sortedFishes = [...this.fishes].sort((a, b) => a.depth - b.depth);
        
        let fishDrawn = 0;
        for (let fish of sortedFishes) {
            if (fish.imageLoaded && fish.imageElement) {
                this.drawFish(fish);
                fishDrawn++;
            } else {
                this.drawFishPlaceholder(fish);
                fishDrawn++;
            }
        }
        
        // Kreslení háčku
        this.drawHook();
        
        // Debug info v rohu
        this.ctx.fillStyle = 'white';
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`Ryby: ${this.fishes.length} (kresleno: ${fishDrawn})`, 10, 30);
        this.ctx.fillText(`Háček: ${this.hookPosition.x.toFixed(0)}, ${this.hookPosition.y.toFixed(0)}`, 10, 50);

        // Overlay pauzy na závěr
        if (this.isPaused) {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(0,0,0,0.35)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            // Ikona pauzy uprostřed
            this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
            const w = 18; const h = 60; const gap = 14;
            const cx = this.canvas.width / 2; const cy = this.canvas.height / 2;
            this.ctx.fillRect(cx - gap - w, cy - h/2, w, h);
            this.ctx.fillRect(cx + gap, cy - h/2, w, h);
            this.ctx.restore();
        }
        // Vignette toggle přes preferenci
        const vignetteEl = document.querySelector('.vignette');
        if (vignetteEl) {
            vignetteEl.style.display = this.preferences.vignette ? 'block' : 'none';
        }
    }

    startCountdown(onFinish) {
        const overlay = document.getElementById('countdown');
        const num = document.getElementById('countdownNumber');
        if (!overlay || !num) { onFinish?.(); return; }
        overlay.classList.add('show');
        let n = 3;
        const tick = () => {
            num.textContent = String(n);
            if (n <= 0) {
                overlay.classList.remove('show');
                onFinish?.();
                return;
            }
            n -= 1;
            setTimeout(tick, 800);
        };
        tick();
    }

    // --- Preferences ---
    loadPreferences() {
        try {
            const raw = localStorage.getItem('prefs');
            return raw ? JSON.parse(raw) : { sound: true, music: true, vignette: true, sparkles: true, silhouettes: true, rays: true, particles: true, sandbox: false, autopilot: false, hints: true, timer: true, rareMG: true };
        } catch {
            return { sound: true, music: true, vignette: true, sparkles: true, silhouettes: true, rays: true, particles: true, sandbox: false, autopilot: false, hints: true, timer: true, rareMG: true };
        }
    }
    savePreferences() {
        localStorage.setItem('prefs', JSON.stringify(this.preferences));
    }
    renderPreferences() {
        const modal = document.getElementById('prefsModal');
        if (!modal) return;
        modal.querySelectorAll('.toggle-btn').forEach(btn => {
            const key = btn.getAttribute('data-key');
            const on = !!this.preferences[key];
            btn.classList.toggle('active', on);
            btn.addEventListener('click', () => {
                this.preferences[key] = !this.preferences[key];
                btn.classList.toggle('active', !!this.preferences[key]);
                if (key === 'sound') this.soundEnabled = !!this.preferences[key];
                if (key === 'music') {
                    this.musicEnabled = !!this.preferences[key];
                    if (this.musicEnabled) this.startMusic(); else this.stopMusic();
                }
                if (key === 'sandbox') this.sandboxMode = !!this.preferences[key];
                if (key === 'autopilot') {
                    this.autopilot = !!this.preferences[key];
                    if (this.autopilot) this.startAutopilot(); else this.stopAutopilot();
                }
                this.savePreferences();
            }, { once: false });
        });
    }
    applyPreferencesToUI() {
        this.soundEnabled = !!this.preferences.sound;
        this.musicEnabled = !!this.preferences.music;
        this.sandboxMode = !!this.preferences.sandbox;
        const musicIcon = document.getElementById('musicIcon');
        if (musicIcon) musicIcon.textContent = this.musicEnabled ? '🎵' : '❌';
        const soundIcon = document.getElementById('soundIcon');
        if (soundIcon) soundIcon.textContent = this.soundEnabled ? '🔊' : '🔇';
        const toggleMusicBtn = document.getElementById('toggleMusic');
        if (toggleMusicBtn) toggleMusicBtn.classList.toggle('active', this.musicEnabled);
        const toggleSoundBtn = document.getElementById('toggleSound');
        if (toggleSoundBtn) toggleSoundBtn.classList.toggle('active', this.soundEnabled);
        const toggleSandboxBtn = document.getElementById('toggleSandbox');
        if (toggleSandboxBtn) toggleSandboxBtn.classList.toggle('active', this.sandboxMode);
        const toggleAutopilotBtn = document.getElementById('toggleAutopilot');
        if (toggleAutopilotBtn) toggleAutopilotBtn.classList.toggle('active', this.autopilot);
        const toggleTimerBtn = document.getElementById('toggleTimer');
        if (toggleTimerBtn) toggleTimerBtn.classList.toggle('active', this.timerEnabled);
        const toggleRareMGBtn = document.getElementById('toggleRareMG');
        if (toggleRareMGBtn) toggleRareMGBtn.classList.toggle('active', this.rareMiniGameEnabled);
    }

    applySandboxVisibility() {
        const hide = this.sandboxMode;
        const elems = [
            document.querySelector('.controls'),
            document.getElementById('missionsPanel'),
            document.getElementById('infoPanel'),
            document.getElementById('albumModal'),
            document.getElementById('skinModal'),
            document.getElementById('rewardModal'),
            document.getElementById('reelOverlay'),
            document.getElementById('summaryModal')
        ];
        elems.forEach(el => {
            if (!el) return;
            el.classList.toggle('sandbox-overlay-hidden', hide);
        });
        // Skryj středové „score pills“ (score, ryby, best, coins)
        const pills = document.querySelector('.score-board');
        if (pills) pills.classList.toggle('sandbox-overlay-hidden', hide);
    }

    // --- 60s summary ---
    scheduleSummary() {
        if (this.summaryTimer) clearTimeout(this.summaryTimer);
        if (!this.timerEnabled) return;
        this.summaryTimer = setTimeout(() => this.showSummary(), 60000);
    }
    showSummary() {
        const modal = document.getElementById('summaryModal');
        if (!modal) return;
        document.getElementById('sumFish').textContent = String(this.fishCount);
        document.getElementById('sumCoins').textContent = String(this.coins);
        document.getElementById('sumPoints').textContent = String(this.score);
        modal.classList.add('show');
        this.isPaused = true;
        const icon = document.getElementById('pauseIcon');
        if (icon) icon.textContent = '▶️';
        const cont = document.getElementById('summaryContinue');
        if (cont) {
            cont.onclick = () => {
                modal.classList.remove('show');
                this.isPaused = false;
                const i = document.getElementById('pauseIcon');
                if (i) i.textContent = '⏸️';
                if (this.timerEnabled) this.scheduleSummary();
            };
        }
    }

    // --- Mise (piktogramy) ---
    setupMissions() {
        const species = this.fishData.slice(0, 6); // pár prvních druhů (stabilní)
        const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
        this.activeMissions = [
            { id: 'm1', icon: '🐟', type: 'count', need: 3, have: 0 },
            { id: 'm2', icon: '⭐', type: 'rarity', min: 7, need: 2, have: 0 },
            { id: 'm3', icon: '📸', type: 'species', name: rand(species)?.name, need: 1, have: 0 }
        ];
        // 60s timer
        this.missionEndAt = Date.now() + 60000;
        this.renderMissions();
    }

    renderMissions() {
        const panel = document.getElementById('missionsPanel');
        if (!panel) return;
        panel.innerHTML = '';
        for (const m of this.activeMissions) {
            const card = document.createElement('div');
            card.className = 'mission-card';
            const label = document.createElement('div');
            label.textContent = m.icon;
            const bar = document.createElement('div');
            bar.className = 'mission-progress';
            const fill = document.createElement('div');
            const ratio = Math.min(1, (m.have || 0) / m.need);
            fill.style.width = `${Math.round(ratio * 100)}%`;
            bar.appendChild(fill);
            card.appendChild(label);
            // Pokud je species, přidej mini náhled zámku/odemykáno
            if (m.type === 'species') {
                const hint = document.createElement('div');
                hint.textContent = m.have >= m.need ? '✅' : '🔍';
                card.appendChild(hint);
            }
            card.appendChild(bar);
            panel.appendChild(card);
        }

        // Kruhový timer
        const timer = document.createElement('div');
        timer.className = 'mission-timer';
        const size = 64, stroke = 6, r = (size - stroke) / 2, c = 2 * Math.PI * r;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bg.setAttribute('cx', size/2); bg.setAttribute('cy', size/2); bg.setAttribute('r', r);
        bg.setAttribute('fill', 'none'); bg.setAttribute('stroke-width', stroke); bg.setAttribute('class', 'timer-bg');
        const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        fg.setAttribute('cx', size/2); fg.setAttribute('cy', size/2); fg.setAttribute('r', r);
        fg.setAttribute('fill', 'none'); fg.setAttribute('stroke-width', stroke);
        fg.setAttribute('stroke-dasharray', c);
        fg.setAttribute('stroke-dashoffset', '0');
        fg.setAttribute('class', 'timer-fg');
        svg.appendChild(bg); svg.appendChild(fg);
        const tt = document.createElement('div'); tt.className = 'timer-text'; tt.id = 'missionTimeLeft'; tt.textContent = '60';
        timer.appendChild(svg); timer.appendChild(tt);
        panel.appendChild(timer);

        this.updateMissionTimer();
    }

    updateMissionTimer() {
        if (!this.missionEndAt) return;
        const leftMs = Math.max(0, this.missionEndAt - Date.now());
        const leftSec = Math.ceil(leftMs / 1000);
        const tt = document.getElementById('missionTimeLeft');
        if (tt) tt.textContent = String(leftSec);
        const size = 64, stroke = 6, r = (size - stroke) / 2, c = 2 * Math.PI * r;
        const fg = document.querySelector('.mission-timer .timer-fg');
        const total = 60000;
        const ratio = 1 - (leftMs / total);
        const offset = Math.max(0, Math.min(c, ratio * c));
        if (fg) fg.setAttribute('stroke-dashoffset', String(offset));

        if (leftMs <= 0) {
            this.onMissionsTimeout();
        } else {
            setTimeout(() => this.updateMissionTimer(), 200);
        }
    }

    onMissionsTimeout() {
        // vyhodnocení misí a odměna hvězdiček
        let completed = 0;
        for (const m of this.activeMissions) {
            if ((m.have || 0) >= m.need) completed++;
        }
        const reward = completed * 5; // 5 ⭐ za splněnou misi
        if (reward > 0 && !this.sandboxMode) {
            this.coins += reward;
            localStorage.setItem('coins', String(this.coins));
            this.updateScore();
            this.createFloatingPoints(80, 80, `⭐+${reward}`);
        }
        // nové mise
        this.setupMissions();
    }

    updateMissionsOnCatch(fish) {
        let changed = false;
        for (const m of this.activeMissions) {
            if (m.type === 'count') {
                m.have = Math.min(m.need, (m.have || 0) + 1);
                changed = true;
            }
            if (m.type === 'rarity' && fish.rarity >= m.min) {
                m.have = Math.min(m.need, (m.have || 0) + 1);
                changed = true;
            }
            if (m.type === 'species' && fish.name === m.name) {
                m.have = Math.min(m.need, (m.have || 0) + 1);
                changed = true;
            }
        }
        if (changed) this.renderMissions();
    }

    // --- Minihra: zdolávání ryby (rychlé ťukání) ---
    startReelMiniGame(durationMs = 1500) {
        if (this.reelActive) return;
        this.reelActive = true;
        this.reelProgress = 0;
        // Boss Sumec: občas delší a těžší minihra
        let boss = false;
        if (Math.random() < 0.07) boss = true;
        if (boss) {
            durationMs = 3800;
            this.reelTapBoost = 22;
            this.reelDecayPerFrame = 0.35;
            this.reelSuccessThreshold = 65;
        }
        const overlay = document.getElementById('reelOverlay');
        const bar = document.getElementById('reelProgress');
        const goal = document.getElementById('reelGoal');
        if (!overlay || !bar) return;
        overlay.classList.add('show');
        if (goal) {
            // Posunout zelenou zónu do závěrečné části lišty (70–85 %), pevná šířka 20 %
            const leftPct = 70 + Math.random() * 15;
            const widthPct = 20;
            const clampedLeft = Math.min(100 - widthPct, leftPct);
            goal.style.left = clampedLeft + '%';
            goal.style.width = widthPct + '%';
        }

        const onTap = () => {
            this.reelProgress = Math.min(100, this.reelProgress + (this.reelTapBoost || 18));
            bar.style.width = `${this.reelProgress}%`;
        };
        const tapHandler = (e) => { e.preventDefault(); onTap(); };
        overlay.addEventListener('click', onTap);
        overlay.addEventListener('touchstart', tapHandler, { passive: false });

        const start = Date.now();
        const tick = () => {
            const elapsed = Date.now() - start;
            // postupný úbytek
            const decay = (this.reelDecayPerFrame || 0.6);
            this.reelProgress = Math.max(0, this.reelProgress - decay);
            bar.style.width = `${this.reelProgress}%`;
            if (elapsed >= durationMs || this.reelProgress >= 100) {
                overlay.removeEventListener('click', onTap);
                overlay.removeEventListener('touchstart', tapHandler);
                overlay.classList.remove('show');
                this.reelActive = false;
                if (boss && this.reelProgress >= this.reelSuccessThreshold) {
                    // veliký ohňostroj
                    const cx = this.canvas.width / 2; const cy = this.canvas.height * 0.4;
                    for (let k = 0; k < 4; k++) this.launchConfetti(cx + k*10, cy + k*10, 48);
                }
                return;
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }
    
    drawHook() {
        this.ctx.save();
        
        // Kreslení vlasce
        this.ctx.strokeStyle = 'rgba(139, 69, 19, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        const fishermanY = this.canvas.height * 0.15; // Pozice rybáře
        this.ctx.moveTo(this.hookPosition.x, fishermanY);
        this.ctx.lineTo(this.hookPosition.x, this.hookPosition.y);
        this.ctx.stroke();
        
        // Kreslení háčku
        this.ctx.fillStyle = '#C0C0C0';
        this.ctx.strokeStyle = '#808080';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.arc(this.hookPosition.x, this.hookPosition.y, 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Hrot háčku
        this.ctx.strokeStyle = '#404040';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(this.hookPosition.x - 5, this.hookPosition.y + 5);
        this.ctx.lineTo(this.hookPosition.x + 5, this.hookPosition.y + 8);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    drawFish(fish) {
        this.ctx.save();
        
        // Stabilní průhlednost - ryby nejsou průhledné, jen odcházející ryby postupně zmizí
        if (fish.isLeaving) {
            // Plynulé mizení pro odcházející ryby podle vzdálenosti od kraje
            const screenCenter = this.canvas.width / 2;
            const distanceFromCenter = Math.abs(fish.x - screenCenter);
            const maxDistance = this.canvas.width / 2 + 100;
            const fadeAlpha = Math.max(0.1, 1 - (distanceFromCenter / maxDistance));
            this.ctx.globalAlpha = fadeAlpha;
        } else {
            // Normální ryby jsou plně viditelné
            this.ctx.globalAlpha = 0.9; // Téměř neprůhledné
        }
        
        // Stabilní velikost - nezávisí na depth
        const size = 100 * fish.scale;
        
        this.ctx.translate(fish.x, fish.y);
        
        // Otočení ryby podle směru pohybu
        if (fish.vx < 0) {
            this.ctx.scale(-1, 1);
        }
        
        // Kreslení ryby se správným poměrem stran podle skutečných rozměrů obrázku
        const aspectRatio = fish.aspectRatio || 1.3; // Fallback poměr pro nepřipraveté obrázky
        const width = size;
        const height = size / aspectRatio;
        
        this.ctx.drawImage(
            fish.imageElement,
            -width / 2,
            -height / 2,
            width,
            height
        );
        // třpytky pro velmi vzácné ryby
        if ((this.preferences.sparkles !== false) && fish.rarity >= 8 && Math.random() < 0.1) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            for (let i = 0; i < 3; i++) {
                const rx = (-width/2) + Math.random() * width;
                const ry = (-height/2) + Math.random() * height;
                this.ctx.beginPath();
                this.ctx.arc(rx, ry, 1.5, 0, Math.PI*2);
                this.ctx.fill();
            }
        }
        // Duhová aura
        if (fish.isRainbow) {
            const grd = this.ctx.createRadialGradient(0, 0, Math.min(width, height) * 0.1, 0, 0, Math.max(width, height) * 0.7);
            grd.addColorStop(0, 'rgba(255,255,255,0.0)');
            grd.addColorStop(1, 'rgba(255, 105, 180, 0.15)');
            this.ctx.fillStyle = grd;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, width * 0.7, height * 0.7, 0, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }
    
    drawFishPlaceholder(fish) {
        this.ctx.save();
        
        // Stabilní průhlednost - stejná logika jako u obrázků
        if (fish.isLeaving) {
            const screenCenter = this.canvas.width / 2;
            const distanceFromCenter = Math.abs(fish.x - screenCenter);
            const maxDistance = this.canvas.width / 2 + 100;
            const fadeAlpha = Math.max(0.1, 1 - (distanceFromCenter / maxDistance));
            this.ctx.globalAlpha = fadeAlpha;
        } else {
            this.ctx.globalAlpha = 0.9; // Téměř neprůhledné
        }
        
        // Stabilní velikost - nezávisí na depth
        const size = 100 * fish.scale;
        
        // Výraznější tvar ryby jako placeholder
        this.ctx.fillStyle = `hsl(${fish.rarity * 25}, 80%, 60%)`;
        this.ctx.strokeStyle = `hsl(${fish.rarity * 25}, 90%, 40%)`;
        this.ctx.lineWidth = 3; // Silnější obrys
        
        // Tělo ryby s přirozenějším poměrem (podobně jako u skutečných obrázků)
        const aspectRatio = 1.3; // Typický poměr pro ryby
        const width = size;
        const height = size / aspectRatio;
        
        this.ctx.beginPath();
        this.ctx.ellipse(fish.x, fish.y, width / 2, height / 2, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Ocas
        this.ctx.beginPath();
        this.ctx.ellipse(fish.x - width * 0.4, fish.y, width / 4, height / 3, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Oko - výraznější
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.arc(fish.x + width * 0.15, fish.y - height * 0.15, size * 0.08, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = 'black';
        this.ctx.beginPath();
        this.ctx.arc(fish.x + width * 0.15, fish.y - height * 0.15, size * 0.04, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Označení pusy (malý červený bod pro debug)
        if (false) { // Zapnout pro debug
            this.ctx.fillStyle = 'red';
            this.ctx.beginPath();
            this.ctx.arc(fish.x - size * 0.3, fish.y, 3, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }
    
    drawBackground() {
        this.ctx.save();
        
        // Obloha s gradienty se kreslí automaticky přes CSS
        
        // Hory v pozadí (nejdříve - nejvíc vzadu)
        this.drawMountains();
        
        // Slunce a mraky (před břehem)
        this.drawSunAndClouds();
        
        // Břeh (později - blíž k nám)
        this.drawShore();
        
        // Stromy a vegetace
        this.drawTrees();
        
        // Kameny ve vodě
        this.drawRocks();
        
        // Vodní rostliny
        this.drawWaterPlants();
        
        // Ptáci na obloze
        this.drawBirds();
        
        // Květiny na břehu
        this.drawFlowers();
        
        // Kačky na vodě
        this.drawDucks();
        
        // Písečný břeh
        this.drawSandyBeach();
        
        // Motýli
        this.drawButterflies();
        
        // Houby a lesní detaily
        this.drawForestDetails();
        
        // Vodní kruhy kolem ryb
        this.drawFishRipples();
        
        // Světelné efekty podle času
        this.drawLightingEffects();
        
        // Létající částice ve vzduchu
        this.drawAirParticles();
        
        // Vodní plocha (vpředu - přes všechno)
        this.drawWaterSurface();
        
        // Vodní efekty (úplně vpředu)
        this.drawWaterEffects();
        
        this.ctx.restore();
    }
    
    drawSunAndClouds() {
        // Slunce
        const sunX = this.canvas.width * 0.85;
        const sunY = this.canvas.height * 0.08; // Posunuto výš pro lepší viditelnost
        const sunRadius = 40;
        
        // Sluneční paprsky
        this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
        this.ctx.lineWidth = 3;
        for (let i = 0; i < 12; i++) {
            const angle = (i * 30) * Math.PI / 180;
            this.ctx.beginPath();
            this.ctx.moveTo(
                sunX + Math.cos(angle) * (sunRadius + 10),
                sunY + Math.sin(angle) * (sunRadius + 10)
            );
            this.ctx.lineTo(
                sunX + Math.cos(angle) * (sunRadius + 25),
                sunY + Math.sin(angle) * (sunRadius + 25)
            );
            this.ctx.stroke();
        }
        
        // Slunce
        const sunGradient = this.ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius);
        sunGradient.addColorStop(0, '#FFF8DC');
        sunGradient.addColorStop(0.7, '#FFD700');
        sunGradient.addColorStop(1, '#FFA500');
        this.ctx.fillStyle = sunGradient;
        this.ctx.beginPath();
        this.ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Mraky
        this.drawClouds();
    }
    
    drawClouds() {
        const time = Date.now() * 0.0001; // Pomalý pohyb mraků
        
        // První mrak
        this.drawCloud(this.canvas.width * 0.2 + Math.sin(time) * 30, this.canvas.height * 0.12, 1.0);
        
        // Druhý mrak
        this.drawCloud(this.canvas.width * 0.5 + Math.cos(time * 0.7) * 20, this.canvas.height * 0.09, 0.8);
        
        // Třetí mrak
        this.drawCloud(this.canvas.width * 0.7 + Math.sin(time * 1.2) * 25, this.canvas.height * 0.15, 1.2);
    }
    
    drawCloud(x, y, scale) {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        
        // Několik kruhů tvoří mrak
        const circles = [
            { x: 0, y: 0, r: 25 * scale },
            { x: 20 * scale, y: -5 * scale, r: 30 * scale },
            { x: 40 * scale, y: 0, r: 25 * scale },
            { x: -15 * scale, y: -8 * scale, r: 20 * scale },
            { x: 15 * scale, y: 8 * scale, r: 22 * scale }
        ];
        
        for (let circle of circles) {
            this.ctx.beginPath();
            this.ctx.arc(x + circle.x, y + circle.y, circle.r, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }
    
    drawShore() {
        const shoreStartY = this.canvas.height * 0.20; // Břeh začíná na 20% výšky - blíž k rybářovi
        const shoreHeight = this.canvas.height * 0.20; // Břeh má pouze 20% výšky
        
        // Trávník
        const grassGradient = this.ctx.createLinearGradient(0, shoreStartY, 0, shoreStartY + shoreHeight);
        grassGradient.addColorStop(0, '#228B22');
        grassGradient.addColorStop(1, '#006400');
        this.ctx.fillStyle = grassGradient;
        this.ctx.fillRect(0, shoreStartY, this.canvas.width, shoreHeight);
        
        // Tráva detaily - různé výšky a barvy pro realističnost
        for (let i = 0; i < this.canvas.width; i += 6) {
            const seed = Math.floor(i / 10); // Statický seed pro konzistentní trávu
            const grassHeight = 8 + Math.abs(Math.sin(seed)) * 20; // Větší tráva
            const grassBend = Math.sin(seed + 1) * 4;
            
            // Různé odstíny zelené pro trávu
            const greenShades = ['#228B22', '#32CD32', '#90EE90', '#006400'];
            this.ctx.strokeStyle = greenShades[Math.floor(Math.abs(Math.sin(seed + 2)) * greenShades.length)];
            this.ctx.lineWidth = 2 + Math.abs(Math.sin(seed + 3)) * 1.5; // Tlustší čáry
            
            this.ctx.beginPath();
            this.ctx.moveTo(i, shoreStartY + shoreHeight);
            this.ctx.lineTo(i + grassBend, shoreStartY + shoreHeight - grassHeight);
            this.ctx.stroke();
        }
        
        // Hraniční čára mezi břehem a vodou
        this.ctx.strokeStyle = 'rgba(139, 69, 19, 0.5)';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        for (let i = 0; i <= this.canvas.width; i += 20) {
            const waveHeight = Math.sin(i * 0.02 + Date.now() * 0.001) * 3;
            if (i === 0) {
                this.ctx.moveTo(i, shoreStartY + shoreHeight + waveHeight); // Na konci břehu
            } else {
                this.ctx.lineTo(i, shoreStartY + shoreHeight + waveHeight); // Na konci břehu
            }
        }
        this.ctx.stroke();
    }
    
    drawMountains() {
        // Několik vrstev hor pro hloubku
        const mountainLayers = [
            { peaks: 4, height: 0.4, color: 'rgba(75, 0, 130, 0.3)', baseY: 0.30 },
            { peaks: 5, height: 0.3, color: 'rgba(106, 90, 205, 0.4)', baseY: 0.35 },
            { peaks: 6, height: 0.25, color: 'rgba(123, 104, 238, 0.5)', baseY: 0.40 }
        ];
        
        for (let layer of mountainLayers) {
            this.drawMountainLayer(layer);
        }
    }
    
    drawMountainLayer(layer) {
        this.ctx.fillStyle = layer.color;
        this.ctx.beginPath();
        
        const baseY = this.canvas.height * layer.baseY;
        this.ctx.moveTo(0, baseY);
        
        for (let i = 0; i <= layer.peaks; i++) {
            const x = (i / layer.peaks) * this.canvas.width;
            const peakHeight = layer.height * this.canvas.height;
            const y = baseY - peakHeight * (0.5 + 0.5 * Math.sin(i * Math.PI * 2 / layer.peaks));
            
            if (i === 0) {
                this.ctx.lineTo(x, y);
            } else {
                // Jemné křivky mezi vrcholy
                const prevX = ((i - 1) / layer.peaks) * this.canvas.width;
                const controlX = (prevX + x) / 2;
                const controlY = y + 20;
                this.ctx.quadraticCurveTo(controlX, controlY, x, y);
            }
        }
        
        this.ctx.lineTo(this.canvas.width, baseY);
        this.ctx.lineTo(this.canvas.width, 0);
        this.ctx.lineTo(0, 0);
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    drawSandyBeach() {
        // Písečný břeh na některých místech
        const beachSegments = [
            { start: 0.1, end: 0.3 },
            { start: 0.6, end: 0.9 }
        ];
        
        for (let segment of beachSegments) {
            const startX = segment.start * this.canvas.width;
            const endX = segment.end * this.canvas.width;
            
            const shoreY = this.canvas.height * 0.20; // Nová pozice břehu
            
            // Písek
            this.ctx.fillStyle = '#F4A460'; // Sandy brown
            this.ctx.beginPath();
            this.ctx.moveTo(startX, shoreY);
            this.ctx.lineTo(endX, shoreY);
            this.ctx.lineTo(endX, shoreY + 15);
            this.ctx.lineTo(startX, shoreY + 15);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Písečné detaily - statické pozice
            this.ctx.fillStyle = '#DEB887'; // Burlywood
            for (let i = 0; i < 15; i++) {
                const seed = Math.floor(startX / 10) + i;
                const x = startX + Math.abs(Math.sin(seed)) * (endX - startX);
                const y = shoreY + 2 + Math.abs(Math.cos(seed + 1)) * 10;
                const size = 1 + Math.abs(Math.sin(seed + 2)) * 2;
                
                this.ctx.beginPath();
                this.ctx.arc(x, y, size, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }
    
    drawButterflies() {
        const time = Date.now() * 0.002;
        
        // Několik motýlů poletuje kolem květin
        const butterflies = [
            { 
                baseX: 0.2, 
                baseY: 0.50, 
                radius: 0.05, 
                speed: 1.0,
                color: '#FF1493' 
            },
            { 
                baseX: 0.4, 
                baseY: 0.55, 
                radius: 0.03, 
                speed: 1.3,
                color: '#FF8C00' 
            },
            { 
                baseX: 0.8, 
                baseY: 0.48, 
                radius: 0.04, 
                speed: 0.8,
                color: '#9370DB' 
            }
        ];
        
        for (let butterfly of butterflies) {
            const x = (butterfly.baseX + Math.sin(time * butterfly.speed) * butterfly.radius) * this.canvas.width;
            const y = (butterfly.baseY + Math.cos(time * butterfly.speed * 0.7) * butterfly.radius * 0.5) * this.canvas.height;
            
            this.drawButterfly(x, y, butterfly.color, time * butterfly.speed);
        }
    }
    
    drawButterfly(x, y, color, wingPhase) {
        this.ctx.save();
        
        const wingSpan = Math.abs(Math.sin(wingPhase * 8)) * 0.5 + 0.5; // Rychlé třepotání křídel
        
        // Tělo motýla
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - 4);
        this.ctx.lineTo(x, y + 4);
        this.ctx.stroke();
        
        // Křídla
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = 0.7;
        
        // Horní křídla
        this.ctx.beginPath();
        this.ctx.ellipse(x - 3, y - 2, 3 * wingSpan, 2, -0.3, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.beginPath();
        this.ctx.ellipse(x + 3, y - 2, 3 * wingSpan, 2, 0.3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Dolní křídla
        this.ctx.beginPath();
        this.ctx.ellipse(x - 2, y + 1, 2 * wingSpan, 1.5, -0.5, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.beginPath();
        this.ctx.ellipse(x + 2, y + 1, 2 * wingSpan, 1.5, 0.5, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawForestDetails() {
        // Houby
        this.drawMushrooms();
        
        // Spadlé listy
        this.drawFallenLeaves();
        
        // Lesní zvířata
        this.drawForestAnimals();
        
        // Kamínky na břehu
        this.drawPebbles();
    }
    
    drawMushrooms() {
        // Statické pozice hub
        if (!this.mushroomPositions) {
            this.mushroomPositions = [
                { x: this.canvas.width * 0.08, scale: 0.8, color: '#8B0000' },
                { x: this.canvas.width * 0.18, scale: 1.2, color: '#FF4500' },
                { x: this.canvas.width * 0.27, scale: 0.6, color: '#8B0000' },
                { x: this.canvas.width * 0.72, scale: 1.0, color: '#FF6347' },
                { x: this.canvas.width * 0.88, scale: 0.9, color: '#8B0000' }
            ];
        }
        
        for (let mushroom of this.mushroomPositions) {
            this.drawMushroom(mushroom.x, mushroom.scale, mushroom.color);
        }
    }
    
    drawMushroom(x, scale, color) {
        const shoreY = this.canvas.height * 0.20; // Nová pozice břehu
        const mushroomY = shoreY - 2; // Posunuto dolů na břeh
        
        // Stopka
        this.ctx.fillStyle = '#F5F5DC'; // Beige
        this.ctx.fillRect(x - 2 * scale, mushroomY, 4 * scale, 8 * scale);
        
        // Klobouk
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, mushroomY, 6 * scale, 0, Math.PI, true);
        this.ctx.fill();
        
        // Bílé tečky na klobouku
        this.ctx.fillStyle = '#FFFFFF';
        const spots = Math.floor(3 * scale);
        for (let i = 0; i < spots; i++) {
            const spotX = x + (Math.sin(i * 2.1) * 3 * scale);
            const spotY = mushroomY - 2 - Math.abs(Math.cos(i * 2.1)) * 2 * scale;
            this.ctx.beginPath();
            this.ctx.arc(spotX, spotY, 0.8 * scale, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    drawFallenLeaves() {
        // Spadlé listy na zemi - statické pozice
        if (!this.leafPositions) {
            this.leafPositions = [];
            const shoreY = this.canvas.height * 0.20; // Nová pozice břehu
            for (let i = 0; i < 20; i++) {
                const seed = i * 17; // Statický seed pro každý list
                this.leafPositions.push({
                    x: Math.abs(Math.sin(seed)) * this.canvas.width,
                    y: shoreY - 5 + Math.abs(Math.cos(seed + 1)) * 8,
                    rotation: Math.abs(Math.sin(seed + 2)) * Math.PI * 2,
                    color: ['#8B4513', '#CD853F', '#D2691E', '#A0522D'][Math.floor(Math.abs(Math.sin(seed + 3)) * 4)]
                });
            }
        }
        
        for (let leaf of this.leafPositions) {
            this.drawLeaf(leaf.x, leaf.y, leaf.rotation, leaf.color);
        }
    }
    
    drawLeaf(x, y, rotation, color) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(rotation);
        
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 3, 1.5, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Žilka listu
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 0.5;
        this.ctx.beginPath();
        this.ctx.moveTo(-2, 0);
        this.ctx.lineTo(2, 0);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    drawForestAnimals() {
        const time = Date.now() * 0.0001;
        
        const shoreY = this.canvas.height * 0.20; // Nová pozice břehu
        
        // Veverka na stromě
        if (Math.sin(time) > 0.5) { // Občas se ukáže
            this.drawSquirrel(this.canvas.width * 0.12, shoreY - 20);
        }
        
        // Žába na břehu
        if (Math.cos(time * 1.3) > 0.3) {
            this.drawFrog(this.canvas.width * 0.45, shoreY + 8);
        }
    }
    
    drawSquirrel(x, y) {
        // Jednoduchá veverka na stromě
        this.ctx.fillStyle = '#8B4513';
        
        // Tělo
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, 4, 6, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Hlava
        this.ctx.beginPath();
        this.ctx.arc(x - 2, y - 4, 3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Ocas
        this.ctx.beginPath();
        this.ctx.ellipse(x + 4, y - 2, 6, 3, 0.3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Oko
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(x - 3, y - 4, 0.5, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawFrog(x, y) {
        // Žába na břehu
        this.ctx.fillStyle = '#228B22';
        
        // Tělo
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, 5, 3, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Hlava
        this.ctx.beginPath();
        this.ctx.ellipse(x - 2, y - 2, 3, 2.5, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Oči
        this.ctx.fillStyle = '#32CD32';
        this.ctx.beginPath();
        this.ctx.arc(x - 3, y - 3, 1, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.beginPath();
        this.ctx.arc(x - 1, y - 3, 1, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Zorničky
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(x - 3, y - 3, 0.3, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.beginPath();
        this.ctx.arc(x - 1, y - 3, 0.3, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawPebbles() {
        // Malé kamínky podél břehu - statické pozice
        if (!this.pebblePositions) {
            this.pebblePositions = [];
            const shoreY = this.canvas.height * 0.20; // Nová pozice břehu
            for (let i = 0; i < 30; i++) {
                const seed = i * 23; // Statický seed pro každý kamínek
                this.pebblePositions.push({
                    x: Math.abs(Math.sin(seed)) * this.canvas.width,
                    y: shoreY + 2 + Math.abs(Math.cos(seed + 1)) * 15,
                    size: 1 + Math.abs(Math.sin(seed + 2)) * 3,
                    color: ['#696969', '#778899', '#A9A9A9', '#808080'][Math.floor(Math.abs(Math.sin(seed + 3)) * 4)]
                });
            }
        }
        
        for (let pebble of this.pebblePositions) {
            this.ctx.fillStyle = pebble.color;
            this.ctx.beginPath();
            this.ctx.arc(pebble.x, pebble.y, pebble.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    drawFishRipples() {
        // Jemné vodní kruhy kolem některých ryb
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        
        for (let fish of this.fishes) {
            // Statické rozhodnutí založené na ID ryby
            const hasRipples = (fish.id.charCodeAt(0) % 10) < 3; // 30% ryb má kruhy
            if (hasRipples) {
                const rippleSize = 20 + Math.sin(Date.now() * 0.005 + fish.id.charCodeAt(0)) * 5;
                this.ctx.beginPath();
                this.ctx.arc(fish.x, fish.y, rippleSize, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        }
        
        this.ctx.restore();
    }
    
    drawLightingEffects() {
        const time = Date.now() * 0.0001;
        const dayPhase = Math.sin(time) * 0.5 + 0.5; // 0-1 hodnota pro den/noc
        
        // Jemný denní/noční overlay
        if (dayPhase < 0.3) {
            // Noční efekt
            this.ctx.fillStyle = `rgba(25, 25, 112, ${(0.3 - dayPhase) * 0.4})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Hvězdy
            this.drawStars(dayPhase);
        } else if (dayPhase > 0.7) {
            // Zlatá hodinka - teplé světlo
            this.ctx.fillStyle = `rgba(255, 215, 0, ${(dayPhase - 0.7) * 0.1})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Jemné světelné paprsky
        this.drawLightRays(dayPhase);
    }
    
    drawStars(nightIntensity) {
        if (nightIntensity < 0.2) {
            // Statické pozice hvězd
            if (!this.starPositions) {
                this.starPositions = [];
                for (let i = 0; i < 15; i++) {
                    const seed = i * 31;
                    this.starPositions.push({
                        x: Math.abs(Math.sin(seed)) * this.canvas.width,
                        y: Math.abs(Math.cos(seed + 1)) * this.canvas.height * 0.3,
                        twinkle: seed
                    });
                }
            }
            
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            for (let star of this.starPositions) {
                const brightness = Math.abs(Math.sin(Date.now() * 0.003 + star.twinkle)) * 0.5 + 0.5;
                this.ctx.globalAlpha = brightness * (0.2 - nightIntensity) * 5;
                this.ctx.beginPath();
                this.ctx.arc(star.x, star.y, 1, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.globalAlpha = 1;
        }
    }
    
    drawLightRays(dayPhase) {
        // Boží paprsky pronikající vodou
        this.ctx.save();
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${dayPhase * 0.05})`;
        this.ctx.lineWidth = 1;
        
        for (let i = 0; i < 12; i++) {
            const x = (i / 12) * this.canvas.width + Math.sin(Date.now() * 0.001 + i) * 30;
            const startY = this.canvas.height * 0.25;
            const endY = this.canvas.height;
            
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x + 20, endY);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }
    
    drawAirParticles() {
        // Jemné částice ve vzduchu - polen, prach
        const time = Date.now() * 0.0005;
        
        // Statické pozice částic
        if (!this.airParticles) {
            this.airParticles = [];
            for (let i = 0; i < 25; i++) {
                const seed = i * 41;
                this.airParticles.push({
                    baseX: Math.abs(Math.sin(seed)) * this.canvas.width,
                    baseY: Math.abs(Math.cos(seed + 1)) * this.canvas.height * 0.6,
                    driftSpeed: 0.3 + Math.abs(Math.sin(seed + 2)) * 0.4,
                    size: 0.5 + Math.abs(Math.cos(seed + 3)) * 1.5,
                    opacity: 0.1 + Math.abs(Math.sin(seed + 4)) * 0.3,
                    phase: seed
                });
            }
        }
        
        this.ctx.save();
        for (let particle of this.airParticles) {
            const x = particle.baseX + Math.sin(time * particle.driftSpeed + particle.phase) * 30;
            const y = particle.baseY + Math.cos(time * particle.driftSpeed * 0.7 + particle.phase) * 15;
            
            this.ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();
    }
    
    drawTrees() {
        // Stromy na břehu - různé pozice a velikosti
        const trees = [
            { x: this.canvas.width * 0.05, scale: 1.2 },
            { x: this.canvas.width * 0.15, scale: 0.8 },
            { x: this.canvas.width * 0.88, scale: 1.0 },
            { x: this.canvas.width * 0.95, scale: 0.9 }
        ];
        
        for (let tree of trees) {
            this.drawTree(tree.x, tree.scale);
        }
        
        // Keře
        const bushes = [
            { x: this.canvas.width * 0.25, scale: 0.6 },
            { x: this.canvas.width * 0.35, scale: 0.8 },
            { x: this.canvas.width * 0.65, scale: 0.7 },
            { x: this.canvas.width * 0.75, scale: 0.5 }
        ];
        
        for (let bush of bushes) {
            this.drawBush(bush.x, bush.scale);
        }
    }
    
    drawTree(x, scale) {
        const treeHeight = 60 * scale;
        const trunkWidth = 8 * scale;
        const trunkHeight = 25 * scale;
        const shoreY = this.canvas.height * 0.20; // Nová pozice břehu
        
        // Kmen
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(x - trunkWidth/2, shoreY - trunkHeight, trunkWidth, trunkHeight);
        
        // Koruna - více kruhů pro realističnost s jemným vlněním
        const crownRadius = 20 * scale;
        const windSway = Math.sin(Date.now() * 0.001 + x * 0.001) * 2; // Jemné vlnění ve větru
        
        this.ctx.fillStyle = '#228B22';
        
        // Hlavní koruna
        this.ctx.beginPath();
        this.ctx.arc(x + windSway, shoreY - trunkHeight - crownRadius/2, crownRadius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Dodatečné kulaté části koruny
        this.ctx.beginPath();
        this.ctx.arc(x - crownRadius * 0.6 + windSway * 0.8, shoreY - trunkHeight - crownRadius/3, crownRadius * 0.7, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.beginPath();
        this.ctx.arc(x + crownRadius * 0.6 + windSway * 0.8, shoreY - trunkHeight - crownRadius/3, crownRadius * 0.7, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Tmavší stíny pro hloubku
        this.ctx.fillStyle = '#006400';
        this.ctx.beginPath();
        this.ctx.arc(x + crownRadius * 0.3 + windSway * 0.6, shoreY - trunkHeight - crownRadius/2 + crownRadius * 0.3, crownRadius * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawBush(x, scale) {
        const bushHeight = 15 * scale;
        const shoreY = this.canvas.height * 0.20; // Nová pozice břehu
        
        // Statické pozice částí keře (založené na x pozici)
        const seed = Math.floor(x / 10);
        
        // Keř je složen z několika malých kruhů
        this.ctx.fillStyle = '#32CD32';
        
        for (let i = 0; i < 3; i++) {
            const offsetX = (i - 1) * 8 * scale;
            const offsetY = (Math.sin(seed + i) * 3) * scale; // Statický offset
            const radius = (8 + Math.abs(Math.sin(seed + i * 2)) * 4) * scale; // Statický radius
            
            this.ctx.beginPath();
            this.ctx.arc(x + offsetX, shoreY - bushHeight/2 + offsetY, radius, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    drawRocks() {
        // Kameny částečně ponořené ve vodě - kolem vodní hladiny
        const waterLevel = this.canvas.height * 0.6; // Pozice vodní hladiny
        const rocks = [
            { x: this.canvas.width * 0.2, y: waterLevel + 10, scale: 1.0 },
            { x: this.canvas.width * 0.4, y: waterLevel + 25, scale: 0.7 },
            { x: this.canvas.width * 0.6, y: waterLevel + 15, scale: 1.2 },
            { x: this.canvas.width * 0.85, y: waterLevel + 30, scale: 0.8 }
        ];
        
        for (let rock of rocks) {
            this.drawRock(rock.x, rock.y, rock.scale);
        }
    }
    
    drawRock(x, y, scale) {
        const rockWidth = 25 * scale;
        const rockHeight = 15 * scale;
        
        // Stín kamene
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.beginPath();
        this.ctx.ellipse(x + 2, y + rockHeight + 2, rockWidth * 0.6, rockHeight * 0.3, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Kámen - gradient pro 3D efekt
        const rockGradient = this.ctx.createRadialGradient(x - rockWidth * 0.3, y - rockHeight * 0.3, 0, x, y, rockWidth);
        rockGradient.addColorStop(0, '#A9A9A9');
        rockGradient.addColorStop(0.6, '#808080');
        rockGradient.addColorStop(1, '#696969');
        
        this.ctx.fillStyle = rockGradient;
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, rockWidth * 0.7, rockHeight, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Detaily kamene
        this.ctx.strokeStyle = '#555555';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, rockWidth * 0.7, rockHeight, 0, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    
    drawWaterPlants() {
        // Vodní rostliny - rákos a řasy
        const plants = [
            { x: this.canvas.width * 0.1, type: 'reed' },
            { x: this.canvas.width * 0.3, type: 'algae' },
            { x: this.canvas.width * 0.7, type: 'reed' },
            { x: this.canvas.width * 0.9, type: 'algae' }
        ];
        
        for (let plant of plants) {
            if (plant.type === 'reed') {
                this.drawReed(plant.x);
            } else {
                this.drawAlgae(plant.x);
            }
        }
    }
    
    drawReed(x) {
        // Rákos - vysoké tenké rostliny
        this.ctx.strokeStyle = '#228B22';
        this.ctx.lineWidth = 3;
        
        const seed = Math.floor(x / 20); // Statický seed pro konzistentní výšky
        
        for (let i = 0; i < 4; i++) {
            const reedX = x + (i - 1.5) * 8;
            const reedHeight = 30 + Math.abs(Math.sin(seed + i)) * 20; // Statická výška
            const bend = Math.sin(Date.now() * 0.002 + i) * 3; // Jemné vlání
            
            const shoreY = this.canvas.height * 0.35; // Pozice vodní hladiny - rákos roste z vody, výš k rybářovi
            
            this.ctx.beginPath();
            this.ctx.moveTo(reedX, shoreY + 5);
            this.ctx.quadraticCurveTo(reedX + bend, shoreY - 15, reedX + bend * 2, shoreY + 5 - reedHeight);
            this.ctx.stroke();
            
            // Vrchol rákosu
            this.ctx.fillStyle = '#8B4513';
            this.ctx.beginPath();
            this.ctx.ellipse(reedX + bend * 2, shoreY + 5 - reedHeight, 2, 5, 0, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
        drawAlgae(x) {
        // Řasy - pod vodou
        this.ctx.strokeStyle = 'rgba(0, 128, 0, 0.6)';
        this.ctx.lineWidth = 2;
        
        const seed = Math.floor(x / 15); // Statický seed pro konzistentní délky
        
        for (let i = 0; i < 6; i++) {
            const algaeX = x + (i - 2.5) * 6;
            const algaeLength = 40 + Math.abs(Math.sin(seed + i)) * 30; // Statická délka
            const wave = Math.sin(Date.now() * 0.003 + i * 0.5) * 8; // Vlnění pod vodou
            
            this.ctx.beginPath();
            this.ctx.moveTo(algaeX, this.canvas.height);
            
            // Křivka řasy
            for (let j = 0; j <= algaeLength; j += 5) {
                const y = this.canvas.height - j;
                const bend = Math.sin(j * 0.1 + Date.now() * 0.003) * wave;
                this.ctx.lineTo(algaeX + bend, y);
            }
            
            this.ctx.stroke();
        }
    }
     
     drawBirds() {
         const time = Date.now() * 0.0003;
         
         // Letící ptáci v "V" formaci
         const birds = [
             { x: 0.3 + Math.sin(time) * 0.4, y: 0.05, phase: 0 },
             { x: 0.32 + Math.sin(time) * 0.4, y: 0.08, phase: 0.5 },
             { x: 0.28 + Math.sin(time) * 0.4, y: 0.08, phase: -0.5 },
             { x: 0.34 + Math.sin(time) * 0.4, y: 0.11, phase: 1 },
             { x: 0.26 + Math.sin(time) * 0.4, y: 0.11, phase: -1 }
         ];
         
         this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
         this.ctx.lineWidth = 2;
         
         for (let bird of birds) {
             const x = bird.x * this.canvas.width;
             const y = bird.y * this.canvas.height;
             const wingFlap = Math.sin(Date.now() * 0.01 + bird.phase) * 3;
             
             // Jednoduchý tvar ptáka - "V"
             this.ctx.beginPath();
             this.ctx.moveTo(x - 8, y + wingFlap);
             this.ctx.lineTo(x, y);
             this.ctx.lineTo(x + 8, y + wingFlap);
             this.ctx.stroke();
         }
     }
     
     drawFlowers() {
         // Statické pozice květin (aby se neměnily při každém frame)
         if (!this.flowerPositions) {
             this.flowerPositions = [
                 { x: this.canvas.width * 0.12, color: '#FF69B4' },
                 { x: this.canvas.width * 0.22, color: '#FFD700' },
                 { x: this.canvas.width * 0.38, color: '#FF4500' },
                 { x: this.canvas.width * 0.58, color: '#9370DB' },
                 { x: this.canvas.width * 0.68, color: '#FF1493' },
                 { x: this.canvas.width * 0.82, color: '#32CD32' }
             ];
         }
         
         for (let flower of this.flowerPositions) {
             this.drawFlower(flower.x, flower.color);
         }
     }
     
         drawFlower(x, color) {
        const shoreY = this.canvas.height * 0.20; // Nová pozice břehu
        const flowerY = shoreY - 5; // Posunuto dolů na břeh
         const petalSize = 4;
         
         // Stonek
         this.ctx.strokeStyle = '#228B22';
         this.ctx.lineWidth = 2;
         this.ctx.beginPath();
         this.ctx.moveTo(x, flowerY + 5);
         this.ctx.lineTo(x, flowerY - 8);
         this.ctx.stroke();
         
         // Okvětní lístky
         this.ctx.fillStyle = color;
         for (let i = 0; i < 5; i++) {
             const angle = (i * 72) * Math.PI / 180;
             const petalX = x + Math.cos(angle) * petalSize;
             const petalY = flowerY - 8 + Math.sin(angle) * petalSize;
             
             this.ctx.beginPath();
             this.ctx.arc(petalX, petalY, 3, 0, Math.PI * 2);
             this.ctx.fill();
         }
         
         // Střed květu
         this.ctx.fillStyle = '#FFD700';
         this.ctx.beginPath();
                   this.ctx.arc(x, flowerY - 8, 2, 0, Math.PI * 2);
          this.ctx.fill();
      }
      
      drawDucks() {
          const time = Date.now() * 0.0002;
          
          // Pomalu se pohybující kačky - na vodní hladině
          const ducks = [
              { 
                  x: 0.15 + Math.sin(time) * 0.1, 
                  y: 0.65, 
                  phase: 0,
                  size: 1.0 
              },
              { 
                  x: 0.7 + Math.sin(time * 0.8 + 2) * 0.08, 
                  y: 0.68, 
                  phase: 2,
                  size: 0.8 
              }
          ];
          
        for (let duck of ducks) {
            const dx = duck.x * this.canvas.width;
            const dy = duck.y * this.canvas.height;
            this.drawDuck(dx, dy, duck.size, duck.phase);
            // občasná bublina reakce
            if (!this.lastDuckBubbleAt || Date.now() - this.lastDuckBubbleAt > 3000) {
                if (Math.random() < 0.002) {
                    this.spawnDuckBubble(dx, dy - 40);
                    this.lastDuckBubbleAt = Date.now();
                }
            }
        }
      }
      
      drawDuck(x, y, size, phase) {
          this.ctx.save();
          
          // Vodní kruhy kolem kačky
          const rippleTime = Date.now() * 0.003 + phase;
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.arc(x, y, 15 + Math.sin(rippleTime) * 3, 0, Math.PI * 2);
          this.ctx.stroke();
          
          // Tělo kačky
          this.ctx.fillStyle = '#8B4513'; // Hnědá barva
          this.ctx.beginPath();
          this.ctx.ellipse(x, y, 12 * size, 8 * size, 0, 0, Math.PI * 2);
          this.ctx.fill();
          
          // Hlava
          this.ctx.fillStyle = '#654321'; // Tmavší hnědá
          this.ctx.beginPath();
          this.ctx.arc(x + 8 * size, y - 3 * size, 6 * size, 0, Math.PI * 2);
          this.ctx.fill();
          
          // Zobák
          this.ctx.fillStyle = '#FFD700'; // Žlutý zobák
          this.ctx.beginPath();
          this.ctx.ellipse(x + 12 * size, y - 3 * size, 3 * size, 1.5 * size, 0, 0, Math.PI * 2);
          this.ctx.fill();
          
          // Oko
          this.ctx.fillStyle = '#000000';
          this.ctx.beginPath();
          this.ctx.arc(x + 10 * size, y - 5 * size, 1 * size, 0, Math.PI * 2);
          this.ctx.fill();
          
          this.ctx.restore();
      }
  
    drawWaterSurface() {
        // Modrá vodní plocha pod břehem
        const waterStartY = this.canvas.height * 0.35; // Voda začíná pod břehem - výš k rybářovi
        const waterGradient = this.ctx.createLinearGradient(0, waterStartY, 0, this.canvas.height);
        waterGradient.addColorStop(0, '#1E90FF'); // Dodger blue
        waterGradient.addColorStop(0.5, '#4169E1'); // Royal blue
        waterGradient.addColorStop(1, '#0000CD'); // Medium blue
        
        this.ctx.fillStyle = waterGradient;
        this.ctx.fillRect(0, waterStartY, this.canvas.width, this.canvas.height - waterStartY);
    }

    drawWaterEffects() {
        // Kreslení vodních efektů (bubliny, světelné paprsky)
        this.ctx.save();
        
        // Světelné paprsky ve vodě - začínají od vodní hladiny
        if (this.preferences.rays !== false) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            this.ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
                const x = (i * this.canvas.width / 8) + Math.sin(Date.now() * 0.001 + i) * 20;
                this.ctx.beginPath();
                this.ctx.moveTo(x, this.canvas.height * 0.6);
                this.ctx.lineTo(x + 10, this.canvas.height);
                this.ctx.stroke();
            }
        }
        
        // Bubliny - perzistentní částice, pomalé stoupání
        if (this.preferences.particles !== false) {
            // Spawn s omezenou rychlostí
            if (!this.lastBubbleSpawn || Date.now() - this.lastBubbleSpawn > 600) {
                this.lastBubbleSpawn = Date.now();
                this.waterBubbles.push({
                    x: Math.random() * this.canvas.width,
                    y: this.canvas.height * (0.7 + Math.random() * 0.25),
                    r: 1.5 + Math.random() * 2.5,
                    vy: -0.15 - Math.random() * 0.2,
                    life: 6000
                });
                if (this.waterBubbles.length > 40) this.waterBubbles.shift();
            }
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            for (const b of this.waterBubbles) {
                b.y += b.vy;
                b.life -= 16;
                this.ctx.beginPath();
                this.ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.waterBubbles = this.waterBubbles.filter(b => b.life > 0 && b.y > this.canvas.height * 0.35);
        }
        
        // Vodní vlnky na povrchu - pod břehem
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            this.ctx.beginPath();
            const baseY = this.canvas.height * 0.50 + i * 5; // Na vodní hladině - pod břehem
            for (let x = 0; x <= this.canvas.width; x += 10) {
                const waveY = baseY + Math.sin(x * 0.02 + Date.now() * 0.003 + i) * 3;
                if (x === 0) {
                    this.ctx.moveTo(x, waveY);
                } else {
                    this.ctx.lineTo(x, waveY);
                }
            }
            this.ctx.stroke();
        }
        
        // Sluneční odlesky na vodě
        this.drawSunReflections();
        
        this.ctx.restore();

        // Občasná pokladová bublina (klikni pro ⭐)
        if (Math.random() < 0.002 && !this.isPaused) {
            this.spawnTreasureBubble();
        }

        // Siluety velkých ryb v hloubce (parallax)
        if (this.preferences.silhouettes !== false) {
            this.drawDeepFishSilhouettes();
        }
    }

    drawDeepFishSilhouettes() {
        const count = 3;
        this.ctx.save();
        this.ctx.globalAlpha = 0.12;
        this.ctx.fillStyle = '#000000';
        for (let i = 0; i < count; i++) {
            const baseY = this.canvas.height * 0.85 + Math.sin(Date.now()*0.0005 + i) * 10;
            const baseX = (i * this.canvas.width / count + (Date.now()*0.02 % this.canvas.width)) % this.canvas.width;
            this.ctx.beginPath();
            this.ctx.ellipse(baseX, baseY, 80, 24, 0, 0, Math.PI*2);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.ellipse(baseX-70, baseY, 24, 16, 0, 0, Math.PI*2);
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    spawnTreasureBubble() {
        const x = Math.random() * this.canvas.width;
        const y = this.canvas.height * 0.8; // start níže
        const el = document.createElement('div');
        el.className = 'treasure-bubble';
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        const container = this.canvas.parentNode;
        container.appendChild(el);
        const cleanup = () => el.remove();
        const reward = 1 + Math.floor(Math.random() * 3);
        el.addEventListener('click', () => {
            el.classList.add('pop');
            this.coins += reward;
            localStorage.setItem('coins', String(this.coins));
            this.updateScore();
            this.createFloatingPoints(x, y - 10, `⭐+${reward}`);
            setTimeout(cleanup, 160);
        }, { once: true });
        setTimeout(cleanup, 6000);
    }

    spawnDuckBubble(x, y) {
        const phrases = ['👍', '🎉', '🐟', '✨', '👏'];
        const el = document.createElement('div');
        el.className = 'duck-bubble';
        el.textContent = phrases[Math.floor(Math.random() * phrases.length)];
        el.style.left = (x - 10) + 'px';
        el.style.top = (y - 10) + 'px';
        this.canvas.parentNode.appendChild(el);
        setTimeout(() => el.remove(), 1200);
    }
    
    drawSunReflections() {
        const time = Date.now() * 0.001;
        
        // Několik třpytivých odlesků na vodní hladině
        for (let i = 0; i < 8; i++) {
            const x = (this.canvas.width * 0.3) + (i * this.canvas.width * 0.1) + Math.sin(time + i) * 50;
            const y = this.canvas.height * 0.55 + Math.sin(time * 1.5 + i * 0.5) * 10; // Níž a menší vlnění
            const intensity = Math.abs(Math.sin(time * 2 + i)) * 0.6;
            
            // Třpytivý efekt
            this.ctx.fillStyle = `rgba(255, 255, 255, ${intensity})`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 3 + intensity * 2, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Rozptýlený lesk kolem
            this.ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.3})`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 8 + intensity * 3, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    gameLoop() {
        if (this.gameStarted) {
            if (!this.isPaused) {
                this.updateFish();
            }
            this.render();
        }
        
        requestAnimationFrame(() => this.gameLoop());
    }

    // --- Autopilot ---
    startAutopilot() {
        this.stopAutopilot();
        const shoot = () => {
            if (!this.autopilot) return;
            if (this.isPaused || this.reelActive || this.isHookAnimating) {
                this.autoTimer = setTimeout(shoot, 600);
                return;
            }
            // vyber cíl: nejbližší rybu nebo střed vody
            const target = this.findBestAutoTarget() || { x: this.canvas.width * 0.5, y: this.canvas.height * 0.6 };
            // posuň rybáře směrem k cíli (rychleji) a házej z blízka
            const step = 36; // rychlejší posun
            const dx = target.x - this.hookPosition.x;
            if (Math.abs(dx) > step) {
                this.moveFishermanTo(this.hookPosition.x + Math.sign(dx) * step);
            }
            const near = Math.abs(target.x - this.hookPosition.x) < 20;
            if (near) {
                const rect = this.canvas.getBoundingClientRect();
                const evt = { clientX: rect.left + target.x, clientY: rect.top + target.y };
                this.startFishing(evt);
            }
            this.autoTimer = setTimeout(shoot, 1400);
        };
        this.autoTimer = setTimeout(shoot, 1200);
    }
    stopAutopilot() {
        if (this.autoTimer) clearTimeout(this.autoTimer);
        this.autoTimer = null;
    }
    findNearestFish() {
        if (!this.fishes.length) return null;
        let best = null; let bestD = Infinity;
        for (const f of this.fishes) {
            const dx = f.x - this.hookPosition.x;
            const dy = f.y - this.hookPosition.y;
            const d = Math.hypot(dx, dy);
            if (d < bestD) { bestD = d; best = f; }
        }
        return best ? { x: best.x, y: best.y } : null;
    }

    findBestAutoTarget() {
        if (!this.fishes.length) return null;
        let best = null; let bestScore = Infinity;
        for (const f of this.fishes) {
            const dx = Math.abs(f.x - this.hookPosition.x);
            // upřednostni ryby, které neodplouvají
            const leavingPenalty = f.isLeaving ? 200 : 0;
            const score = dx + leavingPenalty;
            if (score < bestScore) { bestScore = score; best = f; }
        }
        return best ? { x: best.x, y: best.y } : null;
    }
}

// Spuštění hry po načtení stránky
document.addEventListener('DOMContentLoaded', () => {
    new FishingGame();
}); 