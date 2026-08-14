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

// Chip packet aspect ratio: 1:1 Square Grid Cells
const PACKET_RATIO = 1.0;

export class CanvasRenderer {
  constructor(gameCanvas, holdCanvasDesktop, nextCanvasDesktop, holdCanvasMobile, nextCanvasMobile) {
    this.canvas = gameCanvas;
    this.ctx = gameCanvas.getContext('2d');

    this.holdCanvasDesktop = holdCanvasDesktop;
    this.nextCanvasDesktop = nextCanvasDesktop;
    this.holdCanvasMobile = holdCanvasMobile;
    this.nextCanvasMobile = nextCanvasMobile;

    this.cellWidth  = 55;
    this.cellHeight = 55;
    this.cellSize   = 55; // backward compat alias
    this.dpr = window.devicePixelRatio || 1;
  }

  // ─── Resize to fit parent container (7x14 grid, 1:1 Square Cells) ───────────────
  resizeToContainer(container) {
    if (!container) return;
    const section = container.parentElement;
    const availW = section ? section.getBoundingClientRect().width : container.getBoundingClientRect().width;
    const availH = section ? section.getBoundingClientRect().height : container.getBoundingClientRect().height;

    // Fit grid cells cleanly within available width (10 cols) and height (16 rows matching left HUD sidebar)
    const maxCellWFromWidth  = availW / GRID_COLS;
    const maxCellWFromHeight = availH > 0 ? availH / GRID_ROWS : maxCellWFromWidth;

    const cellW = Math.max(16, Math.floor(Math.min(maxCellWFromWidth, maxCellWFromHeight)));
    const cellH = cellW; // 1:1 Square cells matching edge-to-edge block rendering

    this.cellWidth  = cellW;
    this.cellHeight = cellH;
    this.cellSize   = cellW;

    this.boardWidth  = cellW * GRID_COLS;
    this.boardHeight = cellH * GRID_ROWS;

    container.style.width  = `${this.boardWidth}px`;
    container.style.height = `${this.boardHeight}px`;

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
  drawGrid(width, height) {
    this.ctx.clearRect(0, 0, width, height);

    // 100% Solid Opaque Dark Navy/Black playfield container (#03050e - alpha 1.0, zero bleed-through)
    this.ctx.fillStyle = '#03050e';
    this.ctx.fillRect(0, 0, width, height);

    // Subtle Grid Lines (Blended into dark background)
    this.ctx.strokeStyle = 'rgba(0, 195, 255, 0.05)';
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

  // ─── Draw one 3D neon packet block tile (100% cell slot fill, 0px horizontal gaps) ─────
  drawTile(ctx, x, y, cellSize, flavor, isGhost = false, isActiveFalling = false, alpha = 1.0, offsetX = 0, offsetY = 0, customCellH = null) {
    const cW = cellSize;
    const cH = customCellH != null ? customCellH : Math.round(cellSize * PACKET_RATIO);

    // Fill 100% width and height + 1.2px overlap extension (0px seams for solid edge-to-edge colors)
    const blockW = cW + 1.2;
    const blockH = cH + 1.2;

    const px = offsetX + x * cW;
    const py = offsetY + y * cH;

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
      ctx.globalAlpha = alpha;
      if (typeof ctx.filter !== 'undefined') {
        ctx.filter = 'none';
      }
      if (isActiveFalling) {
        // Glowing neon outline aura around active falling piece
        ctx.shadowColor = 'rgba(255, 45, 85, 0.9)';
        ctx.shadowBlur = 10;
      }
      ctx.drawImage(img, px, py, blockW, blockH);
      ctx.restore();
    }
  }

  // ─── Render main playfield with vertical light trail animation ───────────
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
          this.drawTile(this.ctx, c, r, this.cellWidth, cell.flavor, false, false);
        }
      }
    }

    if (game.currentPiece && !game.gameOver) {
      const piece = game.currentPiece;
      const flavorId = piece.flavor ? piece.flavor.id : 'salted';

      // Dynamic Laser Beam Gradient matching exact packet flavor (Yellow -> Yellow, Green -> Green, Red -> Red, Purple -> Purple)
      const FLAVOR_BEAM_COLORS = {
        salted:   { start: 'rgba(250, 204, 21, 0.65)', mid: 'rgba(234, 179, 8, 0.30)',  end: 'rgba(250, 204, 21, 0)' },
        chilli:   { start: 'rgba(34, 197, 94, 0.65)',  mid: 'rgba(22, 163, 74, 0.30)',  end: 'rgba(34, 197, 94, 0)' },
        tomato:   { start: 'rgba(239, 68, 68, 0.65)',  mid: 'rgba(220, 38, 38, 0.30)',  end: 'rgba(239, 68, 68, 0)' },
        dynamite: { start: 'rgba(168, 85, 247, 0.65)', mid: 'rgba(217, 70, 239, 0.30)', end: 'rgba(168, 85, 247, 0)' }
      };
      const beamColors = FLAVOR_BEAM_COLORS[flavorId] || FLAVOR_BEAM_COLORS.salted;

      // 2a. Dynamic glowing vertical laser beam rising behind active falling piece
      this.ctx.save();
      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c]) {
            const bx = (piece.x + c) * this.cellWidth;
            const by = (piece.y + r) * this.cellHeight;
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

      // 2b. Ghost piece
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

      // 3. Active falling piece (with glowing neon outline)
      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c]) {
            const px = piece.x + c;
            const py = piece.y + r;
            if (py >= 0) {
              this.drawTile(this.ctx, px, py, this.cellWidth, piece.flavor, false, true);
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
