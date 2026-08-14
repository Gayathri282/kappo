/* ==========================================================================
   MAIN GAME CONTROLLER & LOOP - KAPPO CRUNCH STACK
   Mobile-first game loop, resize listeners, score sync, & touch events
   ========================================================================== */

import { TetrisGame, FLAVORS, GRID_COLS } from './tetris.js';
import { CanvasRenderer } from './render.js';
import { ParticleSystem } from './particles.js';
import { sound } from './audio.js';
import { TouchController } from './touch.js';

// DOM Elements
const playfieldContainer = document.getElementById('playfield-container');
const gameCanvas = document.getElementById('game-canvas');
const particleCanvas = document.getElementById('particle-canvas');

const holdCanvasDesktop = document.getElementById('hold-canvas');
const nextCanvasDesktop = document.getElementById('next-canvas');
const holdCanvasMobile = document.getElementById('hold-canvas-mobile');
const nextCanvasMobile = document.getElementById('next-canvas-mobile');

// Score Elements
const scoreValEl = document.getElementById('score-val');
const levelValEl = document.getElementById('level-val');
const linesValEl = document.getElementById('lines-val');
const highScoreValEl = document.getElementById('high-score-val');

// Mobile Header Score Elements
const scoreHeaderEl = document.getElementById('score-val-header');
const levelHeaderEl = document.getElementById('level-val-header');
const highScoreMobileEl = document.getElementById('high-score-val-mobile');

const eventOverlay = document.getElementById('event-overlay');
const eventTextEl = document.getElementById('event-text');
const startOverlay = document.getElementById('start-overlay');
const gameOverModal = document.getElementById('game-over-modal');
const pauseModal = document.getElementById('pause-modal');
const helpModal = document.getElementById('help-modal');
const toastContainer = document.getElementById('toast-container');

// Final Stats Elements
const finalScoreEl = document.getElementById('final-score-val');
const finalLevelEl = document.getElementById('final-level-val');
const finalLinesEl = document.getElementById('final-lines-val');
const finalBestEl = document.getElementById('final-best-val');

// Buttons
const btnStart = document.getElementById('btn-start');
const btnSound = document.getElementById('btn-sound');
const btnPause = document.getElementById('btn-pause');
const btnHelp = document.getElementById('btn-help');
const btnResume = document.getElementById('btn-resume');
const btnRestart = document.getElementById('btn-restart');
const btnRestartPause = document.getElementById('btn-restart-pause');
const btnCloseHelp = document.getElementById('btn-close-help');
const btnGotIt = document.getElementById('btn-got-it');

// Speed Boost Elements
const btnSpeedBoostMobile = document.getElementById('btn-speed-boost-mobile');
const btnSpeedBoostDesktop = document.getElementById('btn-speed-boost-desktop');

// Tutorial Carousel Elements
const tutorialModal = document.getElementById('tutorial-modal');
const btnCloseTutorial = document.getElementById('btn-close-tutorial');
const btnTutorialStart = document.getElementById('btn-tutorial-start');
const carouselTrack = document.getElementById('carousel-track');
const btnCarouselPrev = document.getElementById('btn-carousel-prev');
const btnCarouselNext = document.getElementById('btn-carousel-next');
const carouselDotsContainer = document.getElementById('carousel-dots');

let currentSlide = 0;
const totalSlides = 3;

// Instantiate Engines
const game = new TetrisGame();
const renderer = new CanvasRenderer(
  gameCanvas,
  holdCanvasDesktop,
  nextCanvasDesktop,
  holdCanvasMobile,
  nextCanvasMobile
);
const particles = new ParticleSystem(particleCanvas);

// Game Loop Timing & High Score State
let lastTime = 0;
let dropCounter = 0;
let pieceVisualRow = 0;
let lastPieceKey = null;
let gameStarted = false;
let bestScore = parseInt(localStorage.getItem('kappo_best_stack') || '0', 10);
let lastFactScoreMilestone = 0;

// Kappo Facts
const BRAND_FACTS = [
  "Fried in rice bran oil for a cleaner finish.",
  "A Kerala classic.",
  "From farm to crunch.",
  "Authentic Kerala Cassava & Sun-Ripened Banana Chips.",
  "Crunch You Can Trust — Zero Trans Fat, Zero Cholesterol."
];

// Initialize UI
updateSoundButtonUI();
updateHUD();

// Resize Handler for Mobile & Desktop Canvas Scaling
function handleResize() {
  renderer.resizeToContainer(playfieldContainer);
  particles.resize(gameCanvas.width / renderer.dpr, gameCanvas.height / renderer.dpr);
}
window.addEventListener('resize', handleResize);
handleResize();

// Keyboard DAS State
const keysState = {};
const dasDelay = 150;
const arrRate = 40;

// Action Helpers
function checkLandingClamp() {
  if (!game.currentPiece || game.gameOver) return;
  const landingRow = game.getGhostY();
  if (pieceVisualRow >= landingRow) {
    pieceVisualRow = landingRow;
    game.currentPiece.y = landingRow;
    sound.playBagLanding();
    game.lockPiece();
    processLineClears();
    if (!game.gameOver) {
      game.spawnPiece();
      if (game.currentPiece) {
        lastPieceKey = `${game.currentPiece.type}_${game.currentPiece.flavor ? game.currentPiece.flavor.id : 'salted'}`;
        pieceVisualRow = game.currentPiece.y;
      }
    }
  }
}

function moveLeftAction() {
  if (game.moveLeft()) {
    sound.playRotate();
    checkLandingClamp();
  }
}

function moveRightAction() {
  if (game.moveRight()) {
    sound.playRotate();
    checkLandingClamp();
  }
}

function rotateCWAction() {
  if (game.rotate(1)) {
    sound.playRotate();
    dropCounter = 0;
    checkLandingClamp();
  }
}

function rotateCCWAction() {
  if (game.rotate(-1)) {
    sound.playRotate();
    dropCounter = 0;
    checkLandingClamp();
  }
}

function holdAction() {
  if (game.hold()) sound.playHold();
}

function setSpeedBoost(active) {
  game.isSpeedBoosted = !!active;
  const turboBtn = document.getElementById('btn-touch-turbo') || document.getElementById('btn-touch-soft-drop');
  if (turboBtn) {
    if (active) turboBtn.classList.add('active');
    else turboBtn.classList.remove('active');
  }
}

// Attach TURBO Speed Boost Listeners (Hold & Click Support)
const btnSpeedBoost = document.getElementById('btn-touch-turbo') || document.getElementById('btn-touch-soft-drop');
if (btnSpeedBoost) {
  btnSpeedBoost.addEventListener('mousedown', (e) => {
    e.preventDefault();
    setSpeedBoost(true);
  });
  window.addEventListener('mouseup', () => setSpeedBoost(false));

  btnSpeedBoost.addEventListener('touchstart', (e) => {
    if (e.cancelable) e.preventDefault();
    setSpeedBoost(true);
  }, { passive: false });
  window.addEventListener('touchend', () => setSpeedBoost(false));

  btnSpeedBoost.addEventListener('click', (e) => {
    if (e.cancelable) e.preventDefault();
    setSpeedBoost(!game.isSpeedBoosted);
  });
}

// Touch Controls Engine with Direct Screen Touch Zones & Bottom Deck Buttons
const touchController = new TouchController({
  onLeft: () => moveLeftAction(),
  onRight: () => moveRightAction(),
  onRotateCW: () => rotateCWAction(),
  onRotateCCW: () => rotateCCWAction(),
  onHold: () => holdAction(),
  onSpeedBoost: (active) => setSpeedBoost(active),
  onSoftDrop: () => setSpeedBoost(true),
  getPieceY: () => (game.currentPiece ? game.currentPiece.y : 0)
}, particles);

// Toast Manager
function showToast(text, icon = '🥔') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-text">${text}</span>
  `;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function checkBrandFactsMilestone() {
  if (game.score >= lastFactScoreMilestone + 1000 && game.score > 0) {
    lastFactScoreMilestone = Math.floor(game.score / 1000) * 1000;
    const fact = BRAND_FACTS[Math.floor(Math.random() * BRAND_FACTS.length)];
    showToast(fact, '🌟');
  }
}

function processLineClears() {
  const result = game.clearLines();
  if (result.count > 0) {
    const flavorColors = FLAVORS.map(f => f.mainColor);
    
    // 1. Sequential plastic packet pop SFX & particles across columns
    sound.playSequentialPacketPops(GRID_COLS, 35);
    const cellW = renderer.cellWidth || renderer.cellSize;
    const cellH = renderer.cellHeight || Math.round(cellW * 1.55);
    particles.spawnLineClearFX(result.lines, cellH, cellW, flavorColors);
    
    // 2. Candy Crush chain reaction explosion on filled row and nearby row blocks!
    if (result.blastedCells && result.blastedCells.length > 0) {
      particles.spawnCandyCrushBlastFX(result.blastedCells, cellW, cellH);
    }

    touchController.vibrate(30 + result.count * 15);

    if (result.monoCount > 0) {
      sound.playMonoCrunch(result.monoCount, result.monoFlavor);
      particles.spawnMonoFlavorFX(result.clearedDetails, renderer.cellSize, renderer.cellSize);

      let bannerText = "";
      if (result.monoCount === 1) {
        const flavorName = result.monoFlavor ? result.monoFlavor.name : "Full Batch";
        bannerText = `Full Batch Clear: ${flavorName}!`;
      } else if (result.monoCount === 2) {
        bannerText = "Double Batch Clear! ⚡⚡";
      } else if (result.monoCount === 3) {
        bannerText = "Triple Batch Clear! 🔥⚡";
      } else {
        bannerText = "Full Batch Jackpot! 🏆🔥";
      }
      triggerEventBanner(bannerText);
    } else if (result.count >= 4) {
      sound.playFullCrunch();
      particles.spawnFullCrunchFX();
      triggerEventBanner("⚡ FULL CRUNCH! ⚡");
    } else {
      sound.playCrunch(result.count);
      const labels = ["", "CANDY CRUNCH POP!", "DOUBLE CANDY POP!", "TRIPLE CANDY POP!"];
      triggerEventBanner(labels[result.count] || "CANDY CRUNCH BLAST!");
    }

    if (result.leveledUp) {
      sound.playLevelUp();
      showToast(`BATCH LEVEL ${game.level} REACHED!`, '🚀');
    }

    if (game.score > bestScore) {
      bestScore = game.score;
      localStorage.setItem('kappo_best_stack', bestScore.toString());
    }

    checkBrandFactsMilestone();
  }

  updateHUD();
}

function triggerEventBanner(text) {
  eventTextEl.textContent = text;
  eventOverlay.classList.remove('hidden');
  eventTextEl.style.animation = 'none';
  eventTextEl.offsetHeight;
  eventTextEl.style.animation = 'popInBounce 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';

  setTimeout(() => {
    eventOverlay.classList.add('hidden');
  }, 900);
}

function updateHUD() {
  const scoreStr = game.score.toLocaleString();
  if (scoreValEl) scoreValEl.textContent = scoreStr;
  if (scoreHeaderEl) scoreHeaderEl.textContent = scoreStr;

  const levelStr = String(game.level).padStart(2, '0');
  if (levelValEl) levelValEl.textContent = levelStr;
  if (levelHeaderEl) levelHeaderEl.textContent = game.level;

  // Survival Timer Format (MM:SS)
  const minutes = Math.floor(game.survivalTime / 60);
  const seconds = Math.floor(game.survivalTime % 60);
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const timeValEl = document.getElementById('time-val');
  if (timeValEl) timeValEl.textContent = timeStr;

  const bestStr = bestScore.toLocaleString();
  if (highScoreValEl) highScoreValEl.textContent = bestStr;

  const headerBestEl = document.getElementById('high-score-val-header');
  if (headerBestEl) headerBestEl.textContent = bestStr;

  // Goal Progress (Inspired by LAY STACKS UI - Image 5)
  const goalTarget = 10;
  const currentGoalLines = game.lines % goalTarget;
  const goalPercent = Math.min(100, Math.floor((currentGoalLines / goalTarget) * 100));

  const goalBarDesktop = document.getElementById('goal-bar-fill-desktop');
  const goalTxtDesktop = document.getElementById('goal-progress-txt-desktop');
  const goalBarMobile = document.getElementById('goal-bar-fill-mobile');
  const goalTxtMobile = document.getElementById('goal-progress-txt-mobile');

  if (goalBarDesktop) goalBarDesktop.style.width = `${goalPercent}%`;
  if (goalTxtDesktop) goalTxtDesktop.textContent = `${currentGoalLines}/${goalTarget}`;
  if (goalBarMobile) goalBarMobile.style.width = `${goalPercent}%`;
  if (goalTxtMobile) goalTxtMobile.textContent = `${currentGoalLines}/${goalTarget}`;
}

function updateSoundButtonUI() {
  if (!btnSound) return;
  const icon = btnSound.querySelector('.sound-icon');
  if (icon) {
    icon.textContent = sound.isMuted() ? '🔇' : '🔊';
  }
}

// Render Update Loop
function update(time = 0) {
  if (!lastTime) lastTime = time;
  const deltaTime = time - lastTime;
  lastTime = time;
  const deltaSeconds = Math.min(0.1, Math.max(0.001, deltaTime / 1000));

  if (gameStarted && !game.paused && !game.gameOver) {
    // 1. Real-time master survival clock updates continuously every single frame
    const leveledUp = game.updateTime(deltaSeconds);
    if (leveledUp) {
      sound.playLevelUp();
      showToast(`FALL SPEED INCREASED! (LEVEL ${game.level})`, '⚡');
    }

    handleKeyHolding(time);

    // 2. Per-frame continuous true free-fall physics with pre-render boundary & stack clamping
    if (game.currentPiece) {
      const piece = game.currentPiece;
      const pieceId = `${piece.type}_${piece.flavor ? piece.flavor.id : 'salted'}_rot${piece.rotation}_x${piece.x}`;

      if (lastPieceKey !== pieceId) {
        lastPieceKey = pieceId;
        pieceVisualRow = piece.y;
      }

      // Calculate exact maximum allowed landing row for current column(s) & multi-cell shape
      const landingRow = game.getGhostY();

      const rowsPerSec = game.getFallSpeedRowsPerSec();
      const nextVisualRow = pieceVisualRow + rowsPerSec * deltaSeconds;

      // Pre-frame collision & boundary check
      if (nextVisualRow >= landingRow) {
        // CLAMP TO EXACT LANDING ROW BEFORE RENDERING (0px clipping, 0px gap!)
        pieceVisualRow = landingRow;
        piece.y = landingRow;

        sound.playBagLanding();
        game.lockPiece();
        processLineClears();

        if (!game.gameOver) {
          game.spawnPiece();
          if (game.currentPiece) {
            lastPieceKey = `${game.currentPiece.type}_${game.currentPiece.flavor ? game.currentPiece.flavor.id : 'salted'}_rot${game.currentPiece.rotation}_x${game.currentPiece.x}`;
            pieceVisualRow = game.currentPiece.y;
          }
        }
      } else {
        // Continuous smooth descent (strictly capped below landingRow)
        pieceVisualRow = nextVisualRow;
        piece.y = Math.floor(pieceVisualRow);
      }
    }

    if (game.gameOver) {
      handleGameOver();
    }
  }

  updateHUD();

  const shakeOffset = particles.getShakeOffset();
  renderer.renderPlayfield(game, shakeOffset, pieceVisualRow);
  renderer.renderHold(game.holdPiece);
  renderer.renderNextQueue(game.nextQueue, (type) => game.createPiece(type));

  particles.updateAndDraw();

  requestAnimationFrame(update);
}

function handleKeyHolding(currentTime) {
  ['ArrowLeft', 'KeyA'].forEach(key => {
    if (keysState[key] && currentTime - keysState[key].startTime > dasDelay) {
      if (currentTime - keysState[key].lastRepeat > arrRate) {
        moveLeftAction();
        keysState[key].lastRepeat = currentTime;
      }
    }
  });

  ['ArrowRight', 'KeyD'].forEach(key => {
    if (keysState[key] && currentTime - keysState[key].startTime > dasDelay) {
      if (currentTime - keysState[key].lastRepeat > arrRate) {
        moveRightAction();
        keysState[key].lastRepeat = currentTime;
      }
    }
  });
}

function startGame() {
  sound.initContext();
  game.reset();
  particles.clear();
  gameStarted = true;
  lastFactScoreMilestone = 0;

  startOverlay.classList.add('hidden');
  gameOverModal.classList.add('hidden');
  pauseModal.classList.add('hidden');

  updateHUD();
  showToast("Crunch Stack Started!", '📦');
}

function pauseGame() {
  if (!gameStarted || game.gameOver) return;
  game.paused = true;
  pauseModal.classList.remove('hidden');
}

function resumeGame() {
  game.paused = false;
  pauseModal.classList.add('hidden');
}

function handleGameOver() {
  sound.playGameOver();
  finalScoreEl.textContent = game.score.toLocaleString();
  finalLevelEl.textContent = game.level;
  finalLinesEl.textContent = game.lines;
  finalBestEl.textContent = bestScore.toLocaleString();

  gameOverModal.classList.remove('hidden');
}

// Carousel Navigation Logic
function updateCarouselSlide(slideIndex) {
  currentSlide = (slideIndex + totalSlides) % totalSlides;
  carouselTrack.style.transform = `translateX(-${currentSlide * 100}%)`;

  const slides = carouselTrack.querySelectorAll('.carousel-slide');
  slides.forEach((s, idx) => {
    if (idx === currentSlide) s.classList.add('active');
    else s.classList.remove('active');
  });

  const dots = carouselDotsContainer.querySelectorAll('.dot');
  dots.forEach((d, idx) => {
    if (idx === currentSlide) d.classList.add('active');
    else d.classList.remove('active');
  });
}

if (btnCarouselPrev) {
  btnCarouselPrev.addEventListener('click', () => updateCarouselSlide(currentSlide - 1));
}
if (btnCarouselNext) {
  btnCarouselNext.addEventListener('click', () => {
    if (currentSlide === totalSlides - 1) {
      closeTutorialModal();
    } else {
      updateCarouselSlide(currentSlide + 1);
    }
  });
}

if (carouselDotsContainer) {
  const dotsList = carouselDotsContainer.querySelectorAll('.dot');
  dotsList.forEach((dot, idx) => {
    dot.addEventListener('click', () => updateCarouselSlide(idx));
  });
}

// Interactive Kappo Product Showcase Switcher (Desktop Right Sidebar)
const PRODUCT_SHOWCASE_LIST = [
  { name: 'Classic Salted', img: '/assets/packet_salted.png', tag: '100% Real Sun-Ripened Banana Chips' },
  { name: 'Cassava Dynamite', img: '/assets/packet_dynamite.png', tag: 'Spicy Dynamite Cassava Crunch' },
  { name: 'Chili Garlic', img: '/assets/packet_chilli.png', tag: 'Authentic Kerala Chili Garlic Wave' },
  { name: 'Tangy Tomato', img: '/assets/packet_tomato.png', tag: 'Zesty Tangy Tomato Cassava Chips' }
];
let currentProductIndex = 0;

const productShowcaseCard = document.querySelector('.product-showcase-card');
const productShowcaseImg = document.getElementById('product-showcase-img');
const productFlavorTitle = document.getElementById('product-flavor-title');

if (productShowcaseCard) {
  productShowcaseCard.addEventListener('click', () => {
    currentProductIndex = (currentProductIndex + 1) % PRODUCT_SHOWCASE_LIST.length;
    const prod = PRODUCT_SHOWCASE_LIST[currentProductIndex];
    if (productShowcaseImg) productShowcaseImg.src = prod.img;
    if (productFlavorTitle) productFlavorTitle.textContent = prod.name;
    showToast(`Kappo ${prod.name}`, '🍌');
  });
}

function openTutorialModal() {
  if (!tutorialModal) return;
  if (gameStarted && !game.paused) pauseGame();
  updateCarouselSlide(0);
  tutorialModal.classList.remove('hidden');
}

function closeTutorialModal() {
  if (!tutorialModal) return;
  tutorialModal.classList.add('hidden');
  localStorage.setItem('kappo_tutorial_seen', 'true');
  if (!gameStarted) {
    startGame();
  } else if (game.paused) {
    resumeGame();
  }
}

if (btnCloseTutorial) btnCloseTutorial.addEventListener('click', closeTutorialModal);
if (btnTutorialStart) btnTutorialStart.addEventListener('click', closeTutorialModal);

// Window Keyboard Controls
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'Space', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }

  if (e.repeat) return;

  if (!keysState[e.code]) {
    keysState[e.code] = { startTime: performance.now(), lastRepeat: performance.now() };
  }

  if (!gameStarted) {
    if (e.code === 'Enter' || e.code === 'Space') {
      startGame();
    }
    return;
  }

  if (game.gameOver) return;

  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (game.paused) resumeGame();
    else pauseGame();
    return;
  }

  if (e.code === 'Space' || e.code === 'ArrowDown') {
    setSpeedBoost(true);
    return;
  }

  if (game.paused) return;

  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      moveLeftAction();
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRightAction();
      break;
    case 'ArrowUp':
    case 'KeyW':
    case 'KeyX':
      rotateCWAction();
      break;
    case 'KeyZ':
      rotateCCWAction();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdAction();
      break;
  }
});

window.addEventListener('keyup', (e) => {
  delete keysState[e.code];
  if (e.code === 'Space' || e.code === 'ArrowDown') {
    setSpeedBoost(false);
  }
});

// Tap anywhere on Start Overlay to start game instantly
startOverlay.addEventListener('click', () => {
  if (!gameStarted) startGame();
});
startOverlay.addEventListener('touchstart', (e) => {
  if (!gameStarted) {
    if (e.cancelable) e.preventDefault();
    startGame();
  }
}, { passive: false });

if (btnStart) btnStart.addEventListener('click', startGame);

if (btnSound) {
  btnSound.addEventListener('click', () => {
    sound.toggleMute();
    updateSoundButtonUI();
  });
}

if (btnPause) {
  btnPause.addEventListener('click', () => {
    if (game.paused) resumeGame();
    else pauseGame();
  });
}

if (btnResume) btnResume.addEventListener('click', resumeGame);

if (btnRestart) btnRestart.addEventListener('click', startGame);
if (btnRestartPause) btnRestartPause.addEventListener('click', startGame);

// Question Mark Icon Button (❓) -> Shows Instructions Modal
if (btnHelp) btnHelp.addEventListener('click', openTutorialModal);

// SHOW INSTRUCTIONS MODAL FIRST ON LOAD IF PRESENT
if (tutorialModal) {
  openTutorialModal();
}

// Run Loop
requestAnimationFrame(update);
