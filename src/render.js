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

// Chip packet aspect ratio: 1.04 ratio for maximum screen space & fill
const PACKET_RATIO = 1.04;

export class CanvasRenderer {
  constructor(gameCanvas, holdCanvasDesktop, nextCanvasDesktop, holdCanvasMobile, nextCanvasMobile) {
    this.canvas = gameCanvas;
    this.ctx = gameCanvas.getContext('2d');

    this.holdCanvasDesktop = holdCanvasDesktop;
    this.nextCanvasDesktop = nextCanvasDesktop;
    this.holdCanvasMobile = holdCanvasMobile;
    this.nextCanvasMobile = nextCanvasMobile;

    this.cellWidth  = 40;
    this.cellHeight = Math.round(40 * PACKET_RATIO);
    this.cellSize   = 40; // backward compat alias
    this.dpr = window.devicePixelRatio || 1;
  }

  // ─── Resize to fit parent container with target 350px width ───────────────
  resizeToContainer(container) {
    if (!container) return;
    const section = container.parentElement;
    const rect = section
      ? section.getBoundingClientRect()
      : container.getBoundingClientRect();

    const maxW = Math.floor(rect.width);
    const maxH = Math.floor(rect.height);

    // Target 35px per cell for 10 columns -> exactly 350px board width!
    // Scale cell size down only if viewport width is less than 350px.
    const targetCellW = 35; // 35px × 10 cols = 350px width
    const maxCellByW  = Math.floor(maxW / GRID_COLS);
    const maxCellByH  = Math.floor(maxH / GRID_ROWS);

    // Default to 35px for 350px width, clamped to fit screen if needed
    const cellW = Math.min(targetCellW, Math.max(28, maxCellByW));
    const cellH = Math.min(cellW, Math.max(28, maxCellByH));

    // Force cellWidth = 35px (350px board width) whenever available width allows
    const finalCellW = maxW >= 350 ? 35 : cellW;
    const finalCellH = maxH >= (finalCellW * GRID_ROWS) ? finalCellW : cellH;

    this.cellWidth  = finalCellW;
    this.cellHeight = finalCellH;
    this.cellSize   = finalCellW;

    this.boardWidth  = finalCellW * GRID_COLS; // 35px * 10 = 350px!
    this.boardHeight = finalCellH * GRID_ROWS;

    container.style.width  = `${this.boardWidth}px`;
    container.style.height = `${this.boardHeight}px`;

    this.offsetX = 0;
    this.offsetY = 0;

    this.canvas.width  = Math.floor(this.boardWidth  * this.dpr);
    this.canvas.height = Math.floor(this.boardHeight * this.dpr);

    this.ctx.resetTransform();
    this.ctx.scale(this.dpr, this.dpr);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
  }

  // ─── Grid background (White overlay with low opacity over red background) ─
  drawGrid(width, height) {
    this.ctx.clearRect(0, 0, width, height);

    // Clean white overlay background with low opacity
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
    this.ctx.fillRect(0, 0, width, height);

    // Warm subtle grid lines
    this.ctx.strokeStyle = 'rgba(217, 119, 6, 0.20)';
    this.ctx.lineWidth = 1.0;

    for (let c = 0; c <= GRID_COLS; c++) {
      const x = c * this.cellWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }

    for (let r = 0; r <= GRID_ROWS; r++) {
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

  // ─── Draw one packet block tile ───────────────────────────────────────────
  // x, y        : grid column / row indices
  // cellSize    : cellWidth for this cell
  // customCellH : override cellHeight (used in preview canvases)
  drawTile(ctx, x, y, cellSize, flavor, isGhost = false, alpha = 1.0, offsetX = 0, offsetY = 0, customCellH = null) {
    const cW = cellSize;
    const cH = customCellH != null ? customCellH : (cellSize * (this.cellHeight / this.cellWidth));

    // 2px bleed so packets butt up edge-to-edge with zero gap
    const blockW = cW + 2;
    const blockH = cH + 2;
    const bleedX = 1;
    const bleedY = 1;

    const px = offsetX + x * cW - bleedX;
    const py = offsetY + y * cH - bleedY;

    const flavorId = flavor ? flavor.id : 'salted';
    const img = PACKET_IMAGES[flavorId];

    if (isGhost) {
      if (img && img.complete && img.naturalWidth) {
        ctx.save();
        ctx.globalAlpha = 0.32;
        ctx.drawImage(img, px, py, blockW, blockH);
        ctx.restore();
      }
      return;
    }

    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, px, py, blockW, blockH);
    }
  }

  adjustColorBrightness(hex, percent) {
    let num = parseInt(hex.replace('#', ''), 16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00FF) + percent;
    let b = (num & 0x0000FF) + percent;
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  // ─── Render main playfield ────────────────────────────────────────────────
  renderPlayfield(game, shakeOffset = { x: 0, y: 0 }) {
    const width  = this.canvas.width  / this.dpr;
    const height = this.canvas.height / this.dpr;

    this.ctx.save();
    this.ctx.translate(shakeOffset.x, shakeOffset.y);

    this.clear();
    this.drawGrid(width, height);

    // 1. Locked blocks
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = game.grid[r][c];
        if (cell) {
          this.drawTile(this.ctx, c, r, this.cellWidth, cell.flavor);
        }
      }
    }

    if (game.currentPiece && !game.gameOver) {
      const piece = game.currentPiece;

      // 2. Ghost piece
      const ghostY = game.getGhostY();
      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c]) {
            const gx = piece.x + c;
            const gy = ghostY + r;
            if (gy >= 0) {
              this.drawTile(this.ctx, gx, gy, this.cellWidth, piece.flavor, true);
            }
          }
        }
      }

      // 3. Active falling piece
      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c]) {
            const px = piece.x + c;
            const py = piece.y + r;
            if (py >= 0) {
              this.drawTile(this.ctx, px, py, this.cellWidth, piece.flavor);
            }
          }
        }
      }
    }

    this.ctx.restore();
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

  // ─── Next queue preview ───────────────────────────────────────────────────
  renderNextQueue(nextQueueTypes, createPieceFn) {
    // Desktop: 3 upcoming pieces stacked vertically
    if (this.nextCanvasDesktop) {
      const ctx = this.nextCanvasDesktop.getContext('2d');
      ctx.clearRect(0, 0, this.nextCanvasDesktop.width, this.nextCanvasDesktop.height);
      const miniCellW = 22;
      const miniCellH = Math.round(miniCellW * PACKET_RATIO);

      for (let i = 0; i < Math.min(3, nextQueueTypes.length); i++) {
        const piece = createPieceFn(nextQueueTypes[i]);
        const matrix = piece.matrix;
        const cols = matrix[0].length;
        const rows = matrix.length;
        const blockGroupH = rows * miniCellH;
        const startX = (this.nextCanvasDesktop.width - cols * miniCellW) / 2;
        const startY = i * (blockGroupH + 10) + 6;

        const flavorId = piece.flavor ? piece.flavor.id : 'salted';
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
      }
    }

    // Mobile: first upcoming piece only
    if (this.nextCanvasMobile && nextQueueTypes.length > 0) {
      const ctx = this.nextCanvasMobile.getContext('2d');
      ctx.clearRect(0, 0, this.nextCanvasMobile.width, this.nextCanvasMobile.height);
      const miniCellW = 16;
      const miniCellH = Math.round(miniCellW * PACKET_RATIO);
      const piece = createPieceFn(nextQueueTypes[0]);
      const matrix = piece.matrix;
      const cols = matrix[0].length;
      const rows = matrix.length;
      const startX = (this.nextCanvasMobile.width  - cols * miniCellW) / 2;
      const startY = (this.nextCanvasMobile.height - rows * miniCellH) / 2;

      const flavorId = piece.flavor ? piece.flavor.id : 'salted';
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
    }
  }
}
