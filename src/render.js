/* ==========================================================================
   CANVAS RENDER ENGINE - KAPPO CHIP PACKETS
   Dark Arcade Cyber Theme (Inspired by LAY STACKS UI)
   Supports dynamic responsive sizing, retina DPR scaling, desktop & mobile
   Hold & Next preview canvases, authentic packet images & toon vector rendering.
   ========================================================================== */

import { GRID_COLS, GRID_ROWS } from './tetris.js';

// Preload 3D Kappo packet block images from /assets/
const PACKET_IMAGES = {};
const FLAVOR_IMAGE_MAP = {
  salted: '/assets/kappo_salted_block.png',
  dynamite: '/assets/kappo_dynamite_block.png',
  chilli: '/assets/kappo_chilli_block.png',
  tomato: '/assets/kappo_tomato_block.png'
};

// Fallback to original packet images if generated block PNGs are loading
const FALLBACK_IMAGE_MAP = {
  salted: '/assets/packet_salted.png',
  dynamite: '/assets/packet_dynamite.png',
  chilli: '/assets/packet_chilli.png',
  tomato: '/assets/packet_tomato.png'
};

Object.keys(FLAVOR_IMAGE_MAP).forEach(flavorId => {
  const img = new Image();
  img.src = FLAVOR_IMAGE_MAP[flavorId];
  img.onerror = () => {
    img.src = FALLBACK_IMAGE_MAP[flavorId];
  };
  PACKET_IMAGES[flavorId] = img;
});

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

    // Apply exact board dimensions to container element
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

  // Clean Light Warm Playfield Grid
  drawGrid(width, height) {
    // Warm Light Background
    this.ctx.fillStyle = '#FFFDF7';
    this.ctx.fillRect(0, 0, width, height);

    // Subtle Soft Warm Grid Lines
    this.ctx.strokeStyle = 'rgba(235, 220, 195, 0.65)';
    this.ctx.lineWidth = 1.0;

    for (let c = 0; c <= GRID_COLS; c++) {
      const x = c * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }

    for (let r = 0; r <= GRID_ROWS; r++) {
      const y = r * this.cellSize;
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

  // Pure Tile Renderer: One block is an entire single Kappo chips packet filling the 1x1 grid cell
  drawTile(ctx, x, y, cellSize, flavor, isGhost = false, alpha = 1.0, offsetX = 0, offsetY = 0) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const px = offsetX + x * cellSize;
    const py = offsetY + y * cellSize;
    const padding = 0.5;
    const size = cellSize - padding * 2;

    if (isGhost) {
      ctx.strokeStyle = flavor ? flavor.mainColor : '#00F0FF';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      this.drawRoundRectPath(ctx, px + padding, py + padding, size, size, 4);
      ctx.stroke();
      ctx.fillStyle = flavor ? flavor.mainColor : '#00F0FF';
      ctx.globalAlpha = 0.15;
      ctx.fill();
      ctx.restore();
      return;
    }

    const flavorId = flavor ? flavor.id : 'salted';
    const packetImg = PACKET_IMAGES[flavorId];

    if (packetImg && packetImg.complete && packetImg.naturalWidth !== 0) {
      // Draw the ENTIRE Kappo chips packet filling the single grid cell directly with no background or extra div!
      ctx.drawImage(packetImg, px + padding, py + padding, size, size);
    } else {
      // Toon packet fallback filling the cell
      this.drawToonPacketFallback(ctx, px + padding, py + padding, size, flavorId, flavor);
    }

    ctx.restore();
  }

  // Toon packet vector fallback filling the single cell tile
  drawToonPacketFallback(ctx, px, py, size, flavorId, flavor) {
    const radius = Math.max(3, size * 0.15);
    ctx.save();

    // Fill packet background color
    ctx.fillStyle = flavor ? flavor.mainColor : '#FFA502';
    ctx.beginPath();
    this.drawRoundRectPath(ctx, px, py, size, size, radius);
    ctx.fill();

    // Clip inner packet area for artwork
    ctx.save();
    ctx.beginPath();
    this.drawRoundRectPath(ctx, px, py, size, size, radius);
    ctx.clip();

    const centerX = px + size / 2;
    const centerY = py + size / 2;

    if (flavorId === 'salted') {
      ctx.fillStyle = '#D63031';
      ctx.beginPath();
      ctx.arc(centerX, centerY - size * 0.05, size * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0984E3';
      ctx.beginPath();
      ctx.arc(centerX, centerY - size * 0.05, size * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2ED573';
      ctx.beginPath();
      ctx.arc(centerX, centerY + size * 0.2, size * 0.18, 0, Math.PI);
      ctx.fill();
    } else if (flavorId === 'dynamite') {
      ctx.fillStyle = '#2ED573';
      ctx.fillRect(px, py, size * 0.45, size);
      ctx.fillStyle = '#FF4757';
      ctx.beginPath();
      ctx.arc(centerX + size * 0.15, centerY, size * 0.48, 0, Math.PI * 2);
      ctx.fill();
    } else if (flavorId === 'tomato') {
      ctx.fillStyle = '#6C5CE7';
      ctx.fillRect(px, py, size * 0.48, size);
      ctx.fillStyle = '#FF6B4A';
      ctx.beginPath();
      ctx.arc(centerX + size * 0.2, centerY + size * 0.15, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#FF4757';
      ctx.fillRect(px, py, size, size);
      ctx.fillStyle = '#2ED573';
      ctx.beginPath();
      ctx.arc(centerX, centerY, size * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Top and bottom foil crimp ridges
    const crimpH = Math.max(2, size * 0.1);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(px, py, size, crimpH);
    ctx.fillRect(px, py + size - crimpH, size, crimpH);

    // Subtle foil sheen
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    this.drawRoundRectPath(ctx, px + 1, py + crimpH, size - 2, size * 0.35, radius);
    ctx.fill();

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

    drawToCanvas(this.holdCanvasDesktop, 28);
    drawToCanvas(this.holdCanvasMobile, 16);
  }

  renderNextQueue(nextQueueTypes, createPieceFn) {
    // Desktop preview
    if (this.nextCanvasDesktop) {
      const ctx = this.nextCanvasDesktop.getContext('2d');
      ctx.clearRect(0, 0, this.nextCanvasDesktop.width, this.nextCanvasDesktop.height);
      const miniCell = 26;

      for (let i = 0; i < Math.min(3, nextQueueTypes.length); i++) {
        const piece = createPieceFn(nextQueueTypes[i]);
        const matrix = piece.matrix;
        const N = matrix.length;
        const offsetX = (this.nextCanvasDesktop.width - N * miniCell) / 2 / miniCell;
        const offsetY = (i * 85 + 15) / miniCell;

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
      const miniCell = 16;
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

