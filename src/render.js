/* ==========================================================================
   CANVAS RENDER ENGINE - KAPPO CHIP PACKETS
   Portrait packet blocks (7 cols × 15 rows), 1.55:1 height:width ratio
   Authentic packet JPG images, retina DPR scaling, Hold & Next previews
   ========================================================================== */

import { GRID_COLS, GRID_ROWS } from './tetris.js';

// Preload exact Kappo packet PNG images
const PACKET_IMAGES = {};
const FLAVOR_IMAGE_MAP = {
  salted:   '/assets/packet_salted.png',
  chilli:   '/assets/packet_chilli.png',
  tomato:   '/assets/packet_tomato.png',
  dynamite: '/assets/packet_dynamite.png',
};

Object.entries(FLAVOR_IMAGE_MAP).forEach(([flavorId, src]) => {
  const img = new Image();
  img.src = src;
  PACKET_IMAGES[flavorId] = img;
});

// Chip packet aspect ratio: 1:1.10 proportion (slightly taller than wide)
const PACKET_RATIO = 1.10;

export class CanvasRenderer {
  constructor(gameCanvas, holdCanvasDesktop, nextCanvasDesktop, holdCanvasMobile, nextCanvasMobile) {
    this.canvas = gameCanvas;
    this.ctx = gameCanvas.getContext('2d');

    this.holdCanvasDesktop = holdCanvasDesktop;
    this.nextCanvasDesktop = nextCanvasDesktop;
    this.holdCanvasMobile = holdCanvasMobile;
    this.nextCanvasMobile = nextCanvasMobile;

    this.cellWidth  = 50;
    this.cellHeight = Math.round(50 * PACKET_RATIO);
    this.cellSize   = 50; // backward compat alias
    this.dpr = window.devicePixelRatio || 1;

    this.visualPieceY = 0;
    this.lastPieceKey = null;
  }

  // ─── Resize to fit parent container (Strictly 9 cols × 16 rows) ───────────────
  resizeToContainer(container, game = null) {
    if (!container) return;

    // 1. Measure header & control deck heights using actual measured heights via getBoundingClientRect()
    const headerEl = document.querySelector('.game-header');
    const controlsEl = document.getElementById('touch-controls-deck');
    const gameLayout = document.querySelector('.game-layout') || container.parentElement;

    const headerH = headerEl ? headerEl.getBoundingClientRect().height : 95;
    const controlsH = controlsEl ? controlsEl.getBoundingClientRect().height : 70;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // App container max width constraint
    const appContainer = document.querySelector('.app-container');
    const maxAppW = appContainer ? appContainer.getBoundingClientRect().width : Math.min(viewportW, 600);

    // Measure layout space available between header and controls
    const layoutRect = gameLayout ? gameLayout.getBoundingClientRect() : { width: maxAppW, height: viewportH - headerH - controlsH };
    
    // Reserve safety margin for borders and padding
    const availH = Math.max(100, Math.floor((layoutRect.height || (viewportH - headerH - controlsH)) - 16));

    // 2. Measure actual rendered width from CSS calc(100% - 16px) !important rule
    const containerRect = container.getBoundingClientRect();
    const measuredW = (containerRect.width && containerRect.width > 50) 
      ? containerRect.width 
      : Math.max(100, Math.floor((layoutRect.width || (maxAppW - 16)) - 16));

    // 3. Grid dimensions: strictly 9 columns wide × 16 rows high
    const cols = game ? game.cols : 9;
    const rows = game ? game.rows : 16;

    // 4. Exact square cell ratio (both cell width & cell height scale together uniformly)
    const PACKET_RATIO = 1.0;

    // Calculate dynamic cell size = availableGridWidth / 9
    let cellW = measuredW / cols;
    let cellH = cellW * PACKET_RATIO;

    // Safety guard: ensure total board height never exceeds available layout height
    if (cellH * rows > availH) {
      cellH = availH / rows;
      cellW = cellH / PACKET_RATIO;
    }

    this.cellWidth  = cellW;
    this.cellHeight = cellH;
    this.cellSize   = cellW;

    this.boardWidth  = Math.floor(cellW * cols);
    this.boardHeight = Math.floor(cellH * rows);

    if (game && typeof game.setDimensions === 'function') {
      game.setDimensions(cols, rows);
    }

    // Set height dynamically based on computed boardHeight; width is driven by CSS calc(100% - 16px) !important
    container.style.height = `${this.boardHeight}px`;
    container.style.overflow = 'hidden';

    // Center board horizontally and vertically in available space
    container.style.marginLeft = 'auto';
    container.style.marginRight = 'auto';
    container.style.marginTop = 'auto';
    container.style.marginBottom = 'auto';

    this.offsetX = 0;
    this.offsetY = 0;

    this.canvas.width  = Math.floor(this.boardWidth  * this.dpr);
    this.canvas.height = Math.floor(this.boardHeight * this.dpr);

    const particleCanvas = document.getElementById('particle-canvas');
    if (particleCanvas) {
      particleCanvas.width = this.canvas.width;
      particleCanvas.height = this.canvas.height;
      particleCanvas.style.width = `${this.boardWidth}px`;
      particleCanvas.style.height = `${this.boardHeight}px`;
    }

    this.ctx.resetTransform();
    this.ctx.scale(this.dpr, this.dpr);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
  }

  // ─── Grid background (Solid Dark #03050e with Crisp Clear Grid Lines) ───
  drawGrid(width, height, cols = 9, rows = 16) {
    this.ctx.clearRect(0, 0, width, height);

    this.ctx.fillStyle = '#03050e';
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.strokeStyle = 'rgba(0, 195, 255, 0.14)';
    this.ctx.lineWidth = 1.0;

    for (let c = 0; c <= cols; c++) {
      const x = c * this.cellWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }

    for (let r = 0; r <= rows; r++) {
      const y = r * this.cellHeight;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }
  }

  drawRoundRectPath(ctx, x, y, width, height, radius) {
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, width, height, radius);
    } else {
      const r = typeof radius === 'number' ? radius : (Array.isArray(radius) ? radius[0] : 0);
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    }
  }

  // ─── Draw 3D neon packet block tile (Exact 1:1 Cell Fit bound to computed cellSize) ─────
  drawTile(ctx, x, y, cellSize, flavor, isGhost = false, isActiveFalling = false, alpha = 1.0, offsetX = 0, offsetY = 0, customCellH = null, customPy = null, customScale = null) {
    const cW = cellSize;
    const cH = customCellH != null ? customCellH : (this.cellHeight || cellSize);

    // Exact 1:1 fit bound to dynamic cell size (no overflow, no gaps)
    const baseScale = customScale != null ? customScale : 1.0;

    const blockW = Math.ceil(cW * baseScale);
    const blockH = Math.ceil(cH * baseScale);

    const px = Math.floor(offsetX + x * cW);
    const py = Math.floor(customPy != null ? customPy : (offsetY + y * cH));

    const flavorId = flavor ? flavor.id : 'salted';
    const img = PACKET_IMAGES[flavorId];

    if (isGhost) {
      if (img && img.complete && img.naturalWidth) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.drawImage(img, px, py, blockW, blockH);
        ctx.restore();
      }
      return;
    }

    if (img && img.complete && img.naturalWidth) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1.0, alpha));
      if (typeof ctx.filter !== 'undefined') {
        ctx.filter = 'none';
      }

      ctx.drawImage(img, px, py, blockW, blockH);
      ctx.restore();
    }
  }

  // ─── Render main playfield with continuous free-fall smooth Y motion ───────────
  renderPlayfield(game, shakeOffset = { x: 0, y: 0 }, continuousRow = null, settleAnimationState = null) {
    if (!this.ctx) return;

    const cols = game.cols;
    const rows = game.rows;
    const width = this.boardWidth;
    const height = this.boardHeight;

    this.ctx.save();
    this.ctx.translate(shakeOffset.x, shakeOffset.y);

    this.clear();

    // Clip outer board boundary so stuffed packet overflow stays cleanly inside playfield
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(0, 0, width, height);
    this.ctx.clip();

    this.drawGrid(width, height, cols, rows);

    const now = performance.now();

    let activeSettleKeys = null;
    let isSettlingActive = false;

    if (settleAnimationState) {
      const elapsed = now - settleAnimationState.startTime;
      const duration = settleAnimationState.duration || 200;
      if (elapsed < duration) {
        isSettlingActive = true;
        activeSettleKeys = new Set(settleAnimationState.blocks.map(b => `${b.targetRow}_${b.col}`));
      } else {
        settleAnimationState.isDone = true;
      }
    }

    // 1. Locked blocks (Top-to-bottom row order for natural overlapping seam z-index)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r}_${c}`;

        // Skip static rendering for cells currently mid-settle drop animation
        if (isSettlingActive && activeSettleKeys && activeSettleKeys.has(key)) {
          continue;
        }

        // Check if cell is in active balloon-pop break animation
        if (game.poppingCells && game.poppingCells.has(key)) {
          const popData = game.poppingCells.get(key);
          const elapsed = now - popData.popStartTime;
          const popDuration = 180; // 180ms balloon pop duration

          if (elapsed < popDuration) {
            const t = elapsed / popDuration; // 0.0 to 1.0
            let scale = 1.0;
            let alpha = 1.0;

            if (t < 0.25) {
              // Quick bulge scale up to 1.12x (0ms to 45ms)
              scale = 1.0 + (t / 0.25) * 0.12;
            } else {
              // Rapid scale down to 0x & fade out (45ms to 180ms)
              const shrinkT = (t - 0.25) / 0.75;
              scale = 1.12 * (1.0 - shrinkT);
              alpha = 1.0 - shrinkT;
            }

            this.drawTile(this.ctx, c, r, this.cellWidth, popData.flavor, false, false, Math.max(0, alpha), 0, 0, null, null, scale);
          }
          continue;
        }

        const cell = game.grid[r] ? game.grid[r][c] : null;
        if (cell) {
          if (game.brokenCells && game.brokenCells.has(key)) {
            continue; // Skip rendering broken blocks in clearing row
          }
          this.drawTile(this.ctx, c, r, this.cellWidth, cell.flavor, false, false);
        }
      }
    }

    // 1b. Smooth Gravity-Drop Row-Collapse Animated Blocks
    if (isSettlingActive && settleAnimationState && settleAnimationState.blocks) {
      const elapsed = now - settleAnimationState.startTime;
      const duration = settleAnimationState.duration || 200;
      const progress = Math.min(1.0, elapsed / duration);
      // Natural gravity ease-in (quadratic acceleration)
      const easeInGravity = progress * progress;

      settleAnimationState.blocks.forEach(b => {
        const visualRow = b.startRow + easeInGravity * b.dropDistance;
        const visualY = visualRow * this.cellHeight;
        this.drawTile(this.ctx, b.col, 0, this.cellWidth, b.flavor, false, false, 1.0, 0, 0, null, visualY);
      });
    }

    if (game.currentPiece && !game.gameOver) {
      const piece = game.currentPiece;
      const flavorId = piece.flavor ? piece.flavor.id : 'salted';

      // Subtle Dynamic Laser Beam Gradient matching exact packet flavor
      const FLAVOR_BEAM_COLORS = {
        salted:   { start: 'rgba(250, 204, 21, 0.16)', mid: 'rgba(234, 179, 8, 0.06)',  end: 'rgba(250, 204, 21, 0)' },
        chilli:   { start: 'rgba(34, 197, 94, 0.16)',  mid: 'rgba(22, 163, 74, 0.06)',  end: 'rgba(34, 197, 94, 0)' },
        tomato:   { start: 'rgba(239, 68, 68, 0.16)',  mid: 'rgba(220, 38, 38, 0.06)',  end: 'rgba(239, 68, 68, 0)' },
        dynamite: { start: 'rgba(168, 85, 247, 0.16)', mid: 'rgba(217, 70, 239, 0.06)', end: 'rgba(168, 85, 247, 0)' }
      };
      const beamColors = FLAVOR_BEAM_COLORS[flavorId] || FLAVOR_BEAM_COLORS.salted;

      // Real-time continuous free-fall Y pixel coordinate calculation
      const visualRow = (typeof continuousRow === 'number' && !isNaN(continuousRow)) ? continuousRow : piece.y;
      const activePieceBaseY = visualRow * this.cellHeight;

      // 2a. Dynamic glowing vertical laser beam rising behind active falling piece
      this.ctx.save();
      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c]) {
            const bx = (piece.x + c) * this.cellWidth;
            const by = activePieceBaseY + r * this.cellHeight;
            if (by > 0) {
              const maxBeamH = this.cellHeight * 3;
              const beamH = Math.min(maxBeamH, by);
              const startY = by - beamH;

              const beamGrad = this.ctx.createLinearGradient(bx, by, bx, startY);
              beamGrad.addColorStop(0, beamColors.start);
              beamGrad.addColorStop(0.5, beamColors.mid);
              beamGrad.addColorStop(1, beamColors.end);
              this.ctx.fillStyle = beamGrad;
              this.ctx.fillRect(bx, startY, this.cellWidth, beamH);
            }
          }
        }
      }
      this.ctx.restore();

      // 2b. Ghost piece (remains locked to exact discrete grid landing position)
      const ghostY = game.getGhostY();
      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c]) {
            const gx = piece.x + c;
            const gy = ghostY + r;
            if (gy >= 0) {
              this.drawTile(this.ctx, gx, gy, this.cellWidth, piece.flavor, true, false);
            }
          }
        }
      }

      // 3. Active falling piece (rendered at exact per-frame continuous free-fall Y coordinate)
      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c]) {
            const px = piece.x + c;
            const smoothPy = activePieceBaseY + r * this.cellHeight;
            if (smoothPy + this.cellHeight >= 0) {
              this.drawTile(this.ctx, px, 0, this.cellWidth, piece.flavor, false, true, 1.0, 0, 0, null, smoothPy);
            }
          }
        }
      }
    }

    this.ctx.restore(); // Restore clip mask
    this.ctx.restore(); // Restore shake & transform
  }

  // ─── Hold preview ─────────────────────────────────────────────────────────
  renderHold(holdPiece) {
    const drawToCanvas = (canvas, miniCellW) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!holdPiece) return;

      const miniCellH = Math.round(miniCellW * PACKET_RATIO);
      const matrix = holdPiece.matrix;
      const cols = matrix[0].length;
      const rows = matrix.length;
      const startX = (canvas.width  - cols * miniCellW) / 2;
      const startY = (canvas.height - rows * miniCellH) / 2;

      const flavorId = holdPiece.flavor ? holdPiece.flavor.id : 'salted';
      const img = PACKET_IMAGES[flavorId];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (matrix[r][c]) {
            const px = startX + c * miniCellW;
            const py = startY + r * miniCellH;
            if (img && img.complete && img.naturalWidth) {
              ctx.drawImage(img, px, py, miniCellW, miniCellH);
            }
          }
        }
      }
    };

    drawToCanvas(this.holdCanvasDesktop, 24);
    drawToCanvas(this.holdCanvasMobile,  16);
  }

  // ─── Next queue preview (horizontal strip for top header) ───────────
  renderNextQueue(nextQueueTypes, createPieceFn) {
    const drawHorizontalQueue = (canvas) => {
      if (!canvas || !nextQueueTypes || nextQueueTypes.length === 0) return;
      const ctx = canvas.getContext('2d');
      const canvasW = canvas.width;
      const canvasH = canvas.height;
      ctx.clearRect(0, 0, canvasW, canvasH);

      const piece = createPieceFn(nextQueueTypes[0]);
      if (!piece) return;

      const miniCellW = Math.min(Math.floor(canvasW / 4.5), Math.floor(canvasH / 2.8));
      const miniCellH = Math.round(miniCellW * PACKET_RATIO);
      const matrix = piece.matrix;
      const cols = matrix[0].length;
      const rows = matrix.length;

      const startX = (canvasW - cols * miniCellW) / 2;
      const startY = (canvasH - rows * miniCellH) / 2;

      const flavorId = piece.flavor ? piece.flavor.id : 'salted';
      const img = PACKET_IMAGES[flavorId];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (matrix[r][c]) {
            const px = startX + c * miniCellW;
            const py = startY + r * miniCellH;
            if (img && img.complete && img.naturalWidth) {
              ctx.drawImage(img, px, py, miniCellW + 0.8, miniCellH + 0.8);
            }
          }
        }
      }
    };

    drawHorizontalQueue(this.nextCanvasDesktop);
    drawHorizontalQueue(this.nextCanvasMobile);
  }
}
