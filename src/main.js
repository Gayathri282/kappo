/* ==========================================================================
   MAIN GAME CONTROLLER & LOOP - KAPPO CRUNCH STACK
   Mobile-first game loop, resize listeners, score sync, & touch events
   ========================================================================== */

import { TetrisGame, FLAVORS } from './tetris.js';
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
function moveLeftAction() {
  if (game.moveLeft()) sound.playRotate();
}

function moveRightAction() {
  if (game.moveRight()) sound.playRotate();
}

function rotateCWAction() {
  if (game.rotate(1)) sound.playRotate();
}

function rotateCCWAction() {
  if (game.rotate(-1)) sound.playRotate();
}

function softDropAction() {
  if (game.softDrop()) sound.playDrop();
}

function hardDropAction() {
  const dropDist = game.hardDrop();
  if (dropDist > 0) {
    sound.playDrop();
    particles.shake(6, 6);
    processLineClears();
  }
}

function holdAction() {
  if (game.hold()) sound.playHold();
}

// Touch Controls Engine with Direct Screen Sensitivity & Touch Ripples
const touchController = new TouchController({
  onLeft: () => moveLeftAction(),
  onRight: () => moveRightAction(),
  onRotateCW: () => rotateCWAction(),
  onRotateCCW: () => rotateCCWAction(),
  onSoftDrop: () => softDropAction(),
  onHardDrop: () => hardDropAction(),
  onHold: () => holdAction(),
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
    particles.spawnLineClearFX(result.lines, renderer.cellSize, renderer.cellSize, flavorColors);
    touchController.vibrate(25 + result.count * 10);

    if (result.monoCount > 0) {
      // Enhanced Mono-Flavor ("Full Batch Clear") special effect
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
    } else if (result.count === 4) {
      sound.playFullCrunch();
      particles.spawnFullCrunchFX();
      triggerEventBanner("⚡ FULL CRUNCH! ⚡");
    } else {
      sound.playCrunch(result.count);
      const labels = ["", "CRUNCH COMBO!", "DOUBLE CRUNCH!", "TRIPLE CRUNCH!"];
      triggerEventBanner(labels[result.count]);
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

  if (levelValEl) levelValEl.textContent = game.level;
  if (levelHeaderEl) levelHeaderEl.textContent = game.level;

  if (linesValEl) linesValEl.textContent = game.lines;

  const bestStr = bestScore.toLocaleString();
  if (highScoreValEl) highScoreValEl.textContent = bestStr;
  if (highScoreMobileEl) highScoreMobileEl.textContent = bestStr;
}

function updateSoundButtonUI() {
  btnSound.querySelector('.sound-icon').textContent = sound.isMuted() ? '🔇' : '🔊';
}

// Render Update Loop
function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;

  if (gameStarted && !game.paused && !game.gameOver) {
    dropCounter += deltaTime;

    handleKeyHolding(time);

    if (dropCounter > game.getDropSpeed()) {
      const moved = game.tick();
      if (!moved) {
        sound.playDrop();
        processLineClears();
        if (!game.gameOver) {
          game.spawnPiece();
        }
      }
      dropCounter = 0;
    }

    if (game.gameOver) {
      handleGameOver();
    }
  }

  const shakeOffset = particles.getShakeOffset();
  renderer.renderPlayfield(game, shakeOffset);
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

  ['ArrowDown', 'KeyS'].forEach(key => {
    if (keysState[key] && currentTime - keysState[key].lastRepeat > 50) {
      softDropAction();
      keysState[key].lastRepeat = currentTime;
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
    case 'ArrowDown':
    case 'KeyS':
      softDropAction();
      break;
    case 'Space':
      hardDropAction();
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
});

// Tap anywhere on Start Overlay or Playfield to start game instantly
startOverlay.addEventListener('click', () => {
  if (!gameStarted) startGame();
});
startOverlay.addEventListener('touchstart', (e) => {
  if (!gameStarted) {
    if (e.cancelable) e.preventDefault();
    startGame();
  }
}, { passive: false });

btnStart.addEventListener('click', startGame);

btnSound.addEventListener('click', () => {
  sound.toggleMute();
  updateSoundButtonUI();
});

btnPause.addEventListener('click', () => {
  if (game.paused) resumeGame();
  else pauseGame();
});

btnResume.addEventListener('click', resumeGame);

btnRestart.addEventListener('click', startGame);
btnRestartPause.addEventListener('click', startGame);

btnHelp.addEventListener('click', () => {
  if (gameStarted && !game.paused) pauseGame();
  helpModal.classList.remove('hidden');
});

btnCloseHelp.addEventListener('click', () => helpModal.classList.add('hidden'));
btnGotIt.addEventListener('click', () => helpModal.classList.add('hidden'));

// Auto-start game immediately on page load so game is active right away
startGame();

// Run Loop
requestAnimationFrame(update);
