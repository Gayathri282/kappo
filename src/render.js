/* ==========================================================================
   CANVAS RENDER ENGINE - KAPPO CHIP PACKETS
   Supports dynamic responsive sizing, retina DPR scaling, desktop & mobile
   Hold & Next preview canvases.
   ========================================================================== */

import { GRID_COLS, GRID_ROWS } from './tetris.js';

export class CanvasRenderer {
  constructor(gameCanvas, holdCanvasDesktop, nextCanvasDesktop, holdCanvasMobile, nextCanvasMobile) {
    this.canvas = gameCanvas;
    this.ctx = gameCanvas.getContext('2d');

    this.holdCanvasDesktop = holdCanvasDesktop;
    this.nextCanvasDesktop = nextCanvasDesktop;
    this.holdCanvasMobile = holdCanvasMobile;
    this.nextCanvasMobile = nextCanvasMobile;

    this.cellSize = 30;
    this.dpr = window.devicePixelRatio || 1;
  }

  // Handle dynamic container resize with High-DPI devicePixelRatio
  resizeToContainer(container) {
    if (!container) return;
    const section = container.parentElement;
    const rect = section ? section.getBoundingClientRect() : container.getBoundingClientRect();

    const maxW = rect.width;
    const maxH = rect.height;

    // Calculate maximum cell size fitting 10 columns x 20 rows into parent container area
    this.cellSize = Math.min(maxW / GRID_COLS, maxH / GRID_ROWS);

    this.boardWidth = Math.floor(GRID_COLS * this.cellSize);
    this.boardHeight = Math.floor(GRID_ROWS * this.cellSize);

    // Apply exact board dimensions to container element so background image & grid wrap 1:1
    container.style.width = `${this.boardWidth}px`;
    container.style.height = `${this.boardHeight}px`;

    this.offsetX = 0;
    this.offsetY = 0;

    // Apply High-DPI scaling
    this.canvas.width = Math.floor(this.boardWidth * this.dpr);
    this.canvas.height = Math.floor(this.boardHeight * this.dpr);

    this.ctx.resetTransform();
    this.ctx.scale(this.dpr, this.dpr);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
  }

  drawGrid(width, height) {
    // Candy Crush translucent board background overlay
    this.ctx.fillStyle = 'rgba(255, 253, 247, 0.76)';
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.strokeStyle = 'rgba(255, 165, 0, 0.16)';
    this.ctx.lineWidth = 1;

    for (let c = 0; c <= GRID_COLS; c++) {
      this.ctx.beginPath();
      this.ctx.moveTo(c * this.cellSize, 0);
      this.ctx.lineTo(c * this.cellSize, height);
      this.ctx.stroke();
    }

    for (let r = 0; r <= GRID_ROWS; r++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, r * this.cellSize);
      this.ctx.lineTo(width, r * this.cellSize);
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

  // Squishy, Glossy, Kids-Oriented Block Renderer
  drawTile(ctx, x, y, cellSize, flavor, isGhost = false, alpha = 1.0, offsetX = 0, offsetY = 0) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const px = offsetX + x * cellSize;
    const py = offsetY + y * cellSize;
    const padding = 1.5;
    const size = cellSize - padding * 2;
    const radius = Math.max(5, cellSize * 0.28); // Extra soft rounded squishy corners!

    if (isGhost) {
      ctx.strokeStyle = flavor.mainColor;
      ctx.lineWidth = 2.0;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      this.drawRoundRectPath(ctx, px + padding, py + padding, size, size, radius);
      ctx.stroke();
      ctx.fillStyle = flavor.mainColor;
      ctx.globalAlpha = 0.18;
      ctx.fill();
      ctx.restore();
      return;
    }

    // 1. Bottom 3D Drop Shadow / Rim (Squishy toy feel)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.beginPath();
    this.drawRoundRectPath(ctx, px + padding + 1, py + padding + 2, size, size, radius);
    ctx.fill();

    // 2. Base Bright Pop Gradient
    const grad = ctx.createLinearGradient(px, py, px, py + size);
    grad.addColorStop(0, flavor.accentColor);
    grad.addColorStop(1, flavor.mainColor);

    ctx.fillStyle = grad;
    ctx.beginPath();
    this.drawRoundRectPath(ctx, px + padding, py + padding, size, size, radius);
    ctx.fill();

    // 3. Cute Glossy White Pill Sheen (Top-left candy highlight)
    const shineGrad = ctx.createLinearGradient(px, py, px, py + size * 0.45);
    shineGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
    shineGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
    ctx.fillStyle = shineGrad;
    ctx.beginPath();
    this.drawRoundRectPath(ctx, px + padding + 2, py + padding + 2, size - 4, size * 0.42, Math.max(3, radius * 0.7));
    ctx.fill();

    // 4. White Crisp Outline Highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    this.drawRoundRectPath(ctx, px + padding, py + padding, size, size, radius);
    ctx.stroke();

    // 5. Playful Center Emoji Badge
    ctx.font = `${Math.floor(cellSize * 0.46)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 4;
    ctx.fillText(flavor.badge, px + cellSize / 2, py + cellSize / 2 + 1);

    ctx.restore();
  }

  renderPlayfield(game, shakeOffset = { x: 0, y: 0 }) {
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;

    this.ctx.save();
    this.ctx.translate(shakeOffset.x, shakeOffset.y);

    this.clear();
    this.drawGrid(width, height);

    // 1. Locked Blocks
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = game.grid[r][c];
        if (cell) {
          this.drawTile(this.ctx, c, r, this.cellSize, cell.flavor);
        }
      }
    }

    if (game.currentPiece && !game.gameOver) {
      const piece = game.currentPiece;

      // 2. Ghost Piece
      const ghostY = game.getGhostY();
      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c]) {
            const gx = piece.x + c;
            const gy = ghostY + r;
            if (gy >= 0) {
              this.drawTile(this.ctx, gx, gy, this.cellSize, piece.flavor, true);
            }
          }
        }
      }

      // 3. Active Falling Piece
      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c]) {
            const px = piece.x + c;
            const py = piece.y + r;
            if (py >= 0) {
              this.drawTile(this.ctx, px, py, this.cellSize, piece.flavor);
            }
          }
        }
      }
    }

    this.ctx.restore();
  }

  renderHold(holdPiece) {
    const drawToCanvas = (canvas, miniCell) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!holdPiece) return;

      const matrix = holdPiece.matrix;
      const N = matrix.length;
      const offsetX = (canvas.width - N * miniCell) / 2 / miniCell;
      const offsetY = (canvas.height - N * miniCell) / 2 / miniCell;

      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (matrix[r][c]) {
            this.drawTile(ctx, offsetX + c, offsetY + r, miniCell, holdPiece.flavor);
          }
        }
      }
    };

    drawToCanvas(this.holdCanvasDesktop, 24);
    drawToCanvas(this.holdCanvasMobile, 14);
  }

  renderNextQueue(nextQueueTypes, createPieceFn) {
    // Desktop preview
    if (this.nextCanvasDesktop) {
      const ctx = this.nextCanvasDesktop.getContext('2d');
      ctx.clearRect(0, 0, this.nextCanvasDesktop.width, this.nextCanvasDesktop.height);
      const miniCell = 22;

      for (let i = 0; i < Math.min(3, nextQueueTypes.length); i++) {
        const piece = createPieceFn(nextQueueTypes[i]);
        const matrix = piece.matrix;
        const N = matrix.length;
        const offsetX = (this.nextCanvasDesktop.width - N * miniCell) / 2 / miniCell;
        const offsetY = (i * 90 + 20) / miniCell;

        for (let r = 0; r < N; r++) {
          for (let c = 0; c < N; c++) {
            if (matrix[r][c]) {
              this.drawTile(ctx, offsetX + c, offsetY + r, miniCell, piece.flavor);
            }
          }
        }
      }
    }

    // Mobile preview (first upcoming piece)
    if (this.nextCanvasMobile && nextQueueTypes.length > 0) {
      const ctx = this.nextCanvasMobile.getContext('2d');
      ctx.clearRect(0, 0, this.nextCanvasMobile.width, this.nextCanvasMobile.height);
      const miniCell = 14;
      const piece = createPieceFn(nextQueueTypes[0]);
      const matrix = piece.matrix;
      const N = matrix.length;
      const offsetX = (this.nextCanvasMobile.width - N * miniCell) / 2 / miniCell;
      const offsetY = (this.nextCanvasMobile.height - N * miniCell) / 2 / miniCell;

      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (matrix[r][c]) {
            this.drawTile(ctx, offsetX + c, offsetY + r, miniCell, piece.flavor);
          }
        }
      }
    }
  }
}
