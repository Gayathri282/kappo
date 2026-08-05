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
    const rect = container.getBoundingClientRect();

    const displayWidth = rect.width;
    const displayHeight = rect.height;

    this.cellSize = displayHeight / GRID_ROWS;

    // Apply High-DPI scaling
    this.canvas.width = Math.floor(displayWidth * this.dpr);
    this.canvas.height = Math.floor(displayHeight * this.dpr);

    this.ctx.resetTransform();
    this.ctx.scale(this.dpr, this.dpr);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
  }

  drawGrid(width, height) {
    this.ctx.fillStyle = 'rgba(5, 15, 11, 0.95)';
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.strokeStyle = 'rgba(233, 196, 106, 0.08)';
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

  drawTile(ctx, x, y, cellSize, flavor, isGhost = false, alpha = 1.0) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const px = x * cellSize;
    const py = y * cellSize;
    const padding = 1.2;
    const size = cellSize - padding * 2;
    const radius = Math.max(3, cellSize * 0.15);

    if (isGhost) {
      ctx.strokeStyle = flavor.mainColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(px + padding, py + padding, size, size);
      ctx.fillStyle = flavor.mainColor;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(px + padding, py + padding, size, size);
      ctx.restore();
      return;
    }

    // Base Gradient
    const grad = ctx.createLinearGradient(px, py, px + size, py + size);
    grad.addColorStop(0, flavor.accentColor);
    grad.addColorStop(0.5, flavor.mainColor);
    grad.addColorStop(1, '#111');

    ctx.fillStyle = grad;
    ctx.beginPath();
    this.drawRoundRectPath(ctx, px + padding, py + padding, size, size, radius);
    ctx.fill();

    // Metallic Sheen
    const shineGrad = ctx.createLinearGradient(px, py, px + size / 2, py + size / 2);
    shineGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    shineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shineGrad;
    ctx.beginPath();
    this.drawRoundRectPath(ctx, px + padding, py + padding, size, size / 2, radius);
    ctx.fill();

    // Bevel Shadow
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    this.drawRoundRectPath(ctx, px + padding, py + padding, size, size, radius);
    ctx.stroke();

    // Center Badge
    ctx.font = `${Math.floor(cellSize * 0.45)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
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
