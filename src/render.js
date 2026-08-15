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

  // ─── Resize to fit parent container (Dynamic Cols & Rows) ───────────────
  resizeToContainer(container, game = null) {
    if (!container) return;

    // 1. Measure header & control deck heights to reserve their space first
    const headerEl = document.querySelector('.game-header');
    const controlsEl = document.getElementById('touch-controls-deck');

    const headerH = headerEl ? headerEl.getBoundingClientRect().height : 85;
    const controlsH = controlsEl ? controlsEl.getBoundingClientRect().height : 70;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // App container max width constraint
    const appContainer = document.querySelector('.app-container');
    const maxAppW = appContainer ? appContainer.getBoundingClientRect().width : Math.min(viewportW, 500);

    const availW = Math.max(240, Math.floor(maxAppW - 12));
    // availableHeightForBoard = 100dvh viewport - headerHeight - controlsHeight - spacing
    const availH = Math.max(160, Math.floor(viewportH - headerH - controlsH - 12));

    // 2. Calculate columns & cell width from available screen width (min 10 cols, max 18 cols)
    const targetCellW = 38;
    let naturalCols = Math.floor(availW / targetCellW);
    let cols = Math.max(10, Math.min(18, naturalCols));

    const cellW = availW / cols;

    // 3. Cell height calculation: target ~40px for maximum vertical row density
    const minComfortableCellH = 40;
    let cellH = Math.max(minComfortableCellH, Math.round(cellW * PACKET_RATIO));

    const safetyBuffer = 8; // minimal 8px total vertical buffer

    // 4. Maximize row count naturally from available screen height (availH)
    let rows = Math.floor(availH / cellH);

    // Height Safety Loop Verification: Ensure header + board + controls strictly fits viewportH
    while (rows > 8 && (headerH + (rows * cellH) + controlsH + safetyBuffer) > viewportH) {
      rows--;
    }

    // Sensible floor to prevent an unusably short game (never below 8 rows)
    if (rows < 8) {
      rows = 8;
      cellH = Math.max(16, Math.floor((viewportH - headerH - controlsH - safetyBuffer) / 8));
    }

    this.cellWidth  = cellW;
    this.cellHeight = cellH;
    this.cellSize   = cellW;

    this.boardWidth  = cellW * cols;
    this.boardHeight = cellH * rows;

    if (game && typeof game.setDimensions === 'function') {
      game.setDimensions(cols, rows);
    }

    container.style.width  = `${this.boardWidth}px`;
    container.style.height = `${this.boardHeight}px`;

    // Distribute small leftover remainder as equal padding on both sides
    const leftoverW = availW - this.boardWidth;
    if (leftoverW > 0) {
      container.style.marginLeft = `${Math.floor(leftoverW / 2)}px`;
      container.style.marginRight = `${Math.ceil(leftoverW / 2)}px`;
    } else {
      container.style.marginLeft = 'auto';
      container.style.marginRight = 'auto';
    }

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

  // ─── Grid background (Solid Opaque Dark #03050e with Faint Subtle Grid Lines) ───
  drawGrid(width, height, cols = 8, rows = 14) {
    this.ctx.clearRect(0, 0, width, height);

    this.ctx.fillStyle = '#03050e';
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.strokeStyle = 'rgba(0, 195, 255, 0.03)';
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

  // ─── Draw one 3D neon packet block tile ("Stuffed" 1.08x scale overflow rendering) ─────
  drawTile(ctx, x, y, cellSize, flavor, isGhost = false, isActiveFalling = false, alpha = 1.0, offsetX = 0, offsetY = 0, customCellH = null, customPy = null, customScale = null) {
    const cW = cellSize;
    const cH = customCellH != null ? customCellH : (this.cellHeight || Math.round(cellSize * PACKET_RATIO));

    // Stuffed packet visual overflow: 108% scale factor (consistent 8% bulge on all sides)
    const overflowScale = customScale != null ? customScale : (isGhost ? 1.0 : 1.08);

    const blockW = cW * overflowScale;
    const blockH = cH * overflowScale;

    const extraW = (blockW - cW) / 2;
    const extraH = (blockH - cH) / 2;

    const px = (offsetX + x * cW) - extraW;
    const py = (customPy != null ? customPy : (offsetY + y * cH)) - extraH;

    const flavorId = flavor ? flavor.id : 'salted';
    const img = PACKET_IMAGES[flavorId];

    if (isGhost) {
      if (img && img.complete && img.naturalWidth) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.drawImage(img, px + extraW, py + extraH, cW, cH);
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
      if (isActiveFalling) {
        ctx.shadowColor = 'rgba(255, 45, 85, 0.25)';
        ctx.shadowBlur = 4;
      }
      ctx.drawImage(img, px, py, blockW, blockH);
      ctx.restore();
    }
  }

  // ─── Render main playfield with continuous free-fall smooth Y motion ───────────
  renderPlayfield(game, shakeOffset = { x: 0, y: 0 }, continuousRow = null) {
    const width  = this.canvas.width  / this.dpr;
    const height = this.canvas.height / this.dpr;
    const cols = game.cols || 8;
    const rows = game.rows || 14;

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

    // 1. Locked blocks (Top-to-bottom row order for natural overlapping seam z-index)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r}_${c}`;

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
