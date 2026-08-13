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
    // Translucent seamless playfield atmosphere overlay — Grid lines are completely INVISIBLE!
    this.ctx.fillStyle = 'rgba(255, 253, 247, 0.72)';
    this.ctx.fillRect(0, 0, width, height);
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

  // 3D Toon Authentic Kappo Chip Packet Renderer
  drawTile(ctx, x, y, cellSize, flavor, isGhost = false, alpha = 1.0, offsetX = 0, offsetY = 0) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const px = offsetX + x * cellSize;
    const py = offsetY + y * cellSize;
    const padding = 1.0;
    const size = cellSize - padding * 2;
    const radius = Math.max(5, size * 0.22); // 3D puffed packet pillow radius

    if (isGhost) {
      ctx.strokeStyle = flavor.mainColor;
      ctx.lineWidth = 2.0;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      this.drawRoundRectPath(ctx, px + padding, py + padding, size, size, radius);
      ctx.stroke();
      ctx.fillStyle = flavor.mainColor;
      ctx.globalAlpha = 0.16;
      ctx.fill();
      ctx.restore();
      return;
    }

    const centerX = px + cellSize / 2;
    const centerY = py + cellSize / 2;
    const flavorId = flavor ? flavor.id : 'salted';

    // 1. Soft 3D Drop Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    this.drawRoundRectPath(ctx, px + padding + 1.5, py + padding + 2.5, size, size, radius);
    ctx.fill();

    // 2. Base 3D Puffed Bag Fill (Inflated Snack Bag Volume)
    const bgGrad = ctx.createRadialGradient(
      centerX - size * 0.15, centerY - size * 0.15, size * 0.06,
      centerX, centerY, size * 0.72
    );

    if (flavorId === 'salted') {
      bgGrad.addColorStop(0, '#FFEAA7');
      bgGrad.addColorStop(0.65, '#FFA502');
      bgGrad.addColorStop(1, '#D97706');
    } else if (flavorId === 'dynamite') {
      bgGrad.addColorStop(0, '#FF7F50');
      bgGrad.addColorStop(0.65, '#FF4757');
      bgGrad.addColorStop(1, '#C0392B');
    } else if (flavorId === 'tomato') {
      bgGrad.addColorStop(0, '#FFA07A');
      bgGrad.addColorStop(0.65, '#FF6B4A');
      bgGrad.addColorStop(1, '#D35400');
    } else {
      bgGrad.addColorStop(0, '#7BED9F');
      bgGrad.addColorStop(0.65, '#2ED573');
      bgGrad.addColorStop(1, '#10AC84');
    }

    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    this.drawRoundRectPath(ctx, px + padding, py + padding, size, size, radius);
    ctx.fill();

    // 3. Authentic Kathakali Mandala & Pattern Artwork (Matching uploaded images!)
    ctx.save();
    // Clip inner bag area so artwork stays inside puffed packet
    ctx.beginPath();
    this.drawRoundRectPath(ctx, px + padding, py + padding, size, size, radius);
    ctx.clip();

    if (flavorId === 'salted') {
      // Golden Yellow Bag: Red & Blue Kathakali Mandala Ring + Green Kathakali Face
      ctx.fillStyle = '#D63031';
      ctx.beginPath();
      ctx.arc(centerX, centerY - size * 0.05, size * 0.38, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0984E3';
      ctx.beginPath();
      ctx.arc(centerX, centerY - size * 0.05, size * 0.28, 0, Math.PI * 2);
      ctx.fill();

      // Kathakali Green Face Artwork at lower center
      ctx.fillStyle = '#2ED573';
      ctx.beginPath();
      ctx.arc(centerX, centerY + size * 0.22, size * 0.20, 0, Math.PI);
      ctx.fill();

      // Kathakali Eyes & Lips
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(centerX - size * 0.08, centerY + size * 0.16, size * 0.04, 0, Math.PI * 2);
      ctx.arc(centerX + size * 0.08, centerY + size * 0.16, size * 0.04, 0, Math.PI * 2);
      ctx.fill();
    } else if (flavorId === 'dynamite') {
      // Cassava Dynamite: Dual Split Green & Red Bag
      ctx.fillStyle = '#2ED573';
      ctx.fillRect(px + padding, py + padding, size * 0.5, size);

      // Red Kathakali Wave
      ctx.fillStyle = '#FF4757';
      ctx.beginPath();
      ctx.arc(centerX + size * 0.1, centerY, size * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else if (flavorId === 'tomato') {
      // Tangy Tomato: Sunburst Rays Mandala
      ctx.fillStyle = 'rgba(255, 234, 167, 0.35)';
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, size * 0.45, angle, angle + Math.PI / 8);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // Chili Garlic: Deep Emerald Green Mandala Rings
      ctx.fillStyle = 'rgba(255, 165, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, size * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 4. Top & Bottom Metallic Foil Crimp Seals (Snack Bag Serrated Seams)
    const crimpH = Math.max(3, size * 0.13);
    const crimpGrad = ctx.createLinearGradient(px, py, px + size, py);
    crimpGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    crimpGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
    crimpGrad.addColorStop(1, 'rgba(255, 255, 255, 0.7)');

    ctx.fillStyle = crimpGrad;
    // Top foil crimp
    ctx.fillRect(px + padding + 1, py + padding + 0.5, size - 2, crimpH);
    // Bottom foil crimp
    ctx.fillRect(px + padding + 1, py + padding + size - crimpH - 0.5, size - 2, crimpH);

    // Crimp ridges lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 0.6;
    for (let rx = px + padding + 3; rx < px + padding + size - 3; rx += 3) {
      ctx.beginPath();
      ctx.moveTo(rx, py + padding + 0.5);
      ctx.lineTo(rx, py + padding + crimpH);
      ctx.moveTo(rx, py + padding + size - crimpH);
      ctx.lineTo(rx, py + padding + size - 0.5);
      ctx.stroke();
    }

    // 5. Candy Crush Glossy Foil Sheen Reflection (Top-Left Curved Pill)
    const sheenGrad = ctx.createLinearGradient(px, py, px + size * 0.8, py + size * 0.8);
    sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.70)');
    sheenGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.22)');
    sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = sheenGrad;
    ctx.beginPath();
    this.drawRoundRectPath(ctx, px + padding + 2, py + padding + crimpH + 1, size - 4, size * 0.42, Math.max(3, radius * 0.6));
    ctx.fill();

    // 6. Crisp White Outer Foil Outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    this.drawRoundRectPath(ctx, px + padding, py + padding, size, size, radius);
    ctx.stroke();

    // 7. Mini "KAPPO" Toon Brand Logo Banner
    const brandW = size * 0.72;
    const brandH = size * 0.22;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(centerX - brandW / 2, py + padding + crimpH + 2, brandW, brandH, 4);
    } else {
      ctx.rect(centerX - brandW / 2, py + padding + crimpH + 2, brandW, brandH);
    }
    ctx.fill();

    ctx.font = `900 ${Math.floor(size * 0.17)}px 'Outfit', sans-serif`;
    ctx.fillStyle = flavor ? flavor.mainColor : '#D97706';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('kappo', centerX, py + padding + crimpH + 2 + brandH / 2 + 0.5);

    // 8. Flavor Emoji & Kathakali Badge Icon
    ctx.font = `${Math.floor(size * 0.35)}px sans-serif`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 4;
    ctx.fillText(flavor ? flavor.badge : '🍌', centerX, centerY + size * 0.16);

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
