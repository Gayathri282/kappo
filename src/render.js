/* ==========================================================================
   CANVAS RENDER ENGINE - KAPPO CHIP PACKETS
   10 cols × 20 rows, 1:1 square cells, 1:2 board aspect ratio
   Authentic packet PNG images, retina DPR scaling, Hold & Next previews
   JS is the SINGLE SOURCE OF TRUTH for all board/cell dimensions.
   ========================================================================== */

import { GRID_COLS, GRID_ROWS } from './tetris.js';

// Preload exact Kappo packet PNG images and dynamically crop empty canvas margins for 95% cell-filling render
const PACKET_IMAGES = {};
const TRIMMED_PACKET_CANVASES = {};
const PACKET_ASPECT_RATIOS = {};

const FLAVOR_IMAGE_MAP = {
  salted:   '/assets/packet_salted.png',
  chilli:   '/assets/packet_chilli.png',
  tomato:   '/assets/packet_tomato.png',
  dynamite: '/assets/packet_dynamite.png',
};

function trimImageWhitespace(flavorId, img) {
  try {
    const tempCanvas = document.createElement('canvas');
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return;
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Helper: Is pixel background padding (transparent, near-white, or near-black)?
    function isBgColor(idx) {
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      return a < 20 || (r > 230 && g > 230 && b > 230) || (r < 25 && g < 25 && b < 25);
    }

    // Flood-fill background pixels starting from outer borders to make them 100% transparent
    const visited = new Uint8Array(w * h);
    const queue = [];

    // Push all border pixels that match background color
    for (let x = 0; x < w; x++) {
      let topIdx = (0 * w + x) * 4;
      if (isBgColor(topIdx)) { visited[0 * w + x] = 1; queue.push(x, 0); }
      let botIdx = ((h - 1) * w + x) * 4;
      if (isBgColor(botIdx)) { visited[(h - 1) * w + x] = 1; queue.push(x, h - 1); }
    }
    for (let y = 0; y < h; y++) {
      let leftIdx = (y * w + 0) * 4;
      if (isBgColor(leftIdx) && !visited[y * w + 0]) { visited[y * w + 0] = 1; queue.push(0, y); }
      let rightIdx = (y * w + (w - 1)) * 4;
      if (isBgColor(rightIdx) && !visited[y * w + (w - 1)]) { visited[y * w + (w - 1)] = 1; queue.push(w - 1, y); }
    }

    let head = 0;
    while (head < queue.length) {
      const qx = queue[head++];
      const qy = queue[head++];
      const pIdx = (qy * w + qx) * 4;
      data[pIdx + 3] = 0; // Make transparent!

      // 4-neighbor expansion
      const neighbors = [
        [qx + 1, qy], [qx - 1, qy], [qx, qy + 1], [qx, qy - 1]
      ];
      for (let i = 0; i < 4; i++) {
        const nx = neighbors[i][0];
        const ny = neighbors[i][1];
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const nPos = ny * w + nx;
          if (!visited[nPos]) {
            visited[nPos] = 1;
            const nIdx = nPos * 4;
            if (isBgColor(nIdx)) {
              queue.push(nx, ny);
            }
          }
        }
      }
    }

    // Put cleaned transparent image data back to tempCanvas
    ctx.putImageData(imgData, 0, 0);

    // Locate exact bounding box of non-transparent artwork pixels
    let minX = w, maxX = 0, minY = h, maxY = 0;
    let found = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = data[(y * w + x) * 4 + 3];
        if (a > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (!found) {
      minX = 0; maxX = w - 1; minY = 0; maxY = h - 1;
    }

    const cropW = Math.max(10, maxX - minX + 1);
    const cropH = Math.max(10, maxY - minY + 1);
    // Standardized 600x800px (3:4 portrait ratio) tile canvas matching true packet proportions
    const TARGET_CANVAS_W = 600;
    const TARGET_CANVAS_H = 800; // Exact 3:4 ratio (600x800px)
    const normalizedCanvas = document.createElement('canvas');
    normalizedCanvas.width = TARGET_CANVAS_W;
    normalizedCanvas.height = TARGET_CANVAS_H;
    const normCtx = normalizedCanvas.getContext('2d');

    // Scale trimmed artwork using CONTAIN fit so 100% of the complete packet artwork is fully visible inside 600x800 canvas without cropping
    const scale = Math.min(TARGET_CANVAS_W / cropW, TARGET_CANVAS_H / cropH);
    const drawW = cropW * scale;
    const drawH = cropH * scale;
    const drawX = (TARGET_CANVAS_W - drawW) / 2;
    const drawY = (TARGET_CANVAS_H - drawH) / 2;

    normCtx.clearRect(0, 0, TARGET_CANVAS_W, TARGET_CANVAS_H);
    normCtx.drawImage(tempCanvas, minX, minY, cropW, cropH, drawX, drawY, drawW, drawH);

    TRIMMED_PACKET_CANVASES[flavorId] = normalizedCanvas;
    PACKET_ASPECT_RATIOS[flavorId] = 1.3333;
    console.log(`[Full Packet Canvas] ${flavorId}: 100% complete packet artwork centered in 600x800px cell (3:4 Ratio, Zero Cropping)`);
  } catch (e) {
    console.warn(`[Packet Trim Warning] ${flavorId}:`, e);
    if (img.naturalWidth && img.naturalHeight) {
      PACKET_ASPECT_RATIOS[flavorId] = 1.3333;
    }
  }
}

Object.entries(FLAVOR_IMAGE_MAP).forEach(([flavorId, src]) => {
  const img = new Image();
  img.onload = () => {
    trimImageWhitespace(flavorId, img);
  };
  img.src = src;
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

    this.cellWidth  = 30;
    this.cellHeight = 40; // 3:4 portrait aspect ratio
    this.cellSize   = 30;
    this.dpr = window.devicePixelRatio || 1;

    this.visualPieceY = 0;
    this.lastPieceKey = null;
  }

  // ─── Resize: JS is the SINGLE SOURCE OF TRUTH for board dimensions ───────
  resizeToContainer(container, game = null) {
    if (!container) return;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // 1. Measure header & control deck heights
    const headerEl = document.querySelector('.game-header');
    const controlsEl = document.getElementById('touch-controls-deck');
    const headerH = headerEl ? headerEl.getBoundingClientRect().height : 80;
    const controlsH = controlsEl ? controlsEl.getBoundingClientRect().height : 90;

    // Available vertical space for the board (viewport minus header, controls, margins)
    const verticalMargin = 20;
    const availH = Math.max(100, viewportH - headerH - controlsH - verticalMargin);

    // 2. Compute target board width DIRECTLY from viewport (not from DOM measurement)
    const isMobile = viewportW <= 768;
    const targetW = isMobile
      ? Math.min(viewportW * 0.75, 440)
      : Math.min(viewportW * 0.55, 600);

    // 3. Grid dimensions: 7 columns × 15 rows
    const cols = game ? game.cols : GRID_COLS;
    const rows = game ? game.rows : GRID_ROWS;

    // 4. Match CELL ASPECT RATIO exactly to packet's 3:4 portrait aspect ratio (1.3333)
    const PACKET_ASPECT = 1.3333; // 4/3 height-to-width ratio

    let cellW = targetW / cols;
    let cellH = cellW * PACKET_ASPECT;

    // Height constraint: if board exceeds available height, scale down maintaining exact 3:4 aspect ratio
    if (cellH * rows > availH) {
      cellH = availH / rows;
      cellW = cellH / PACKET_ASPECT;
    }

    this.cellWidth  = cellW;
    this.cellHeight = cellH;
    this.cellSize   = cellW;

    this.boardWidth  = Math.floor(cellW * cols);
    this.boardHeight = Math.floor(cellH * rows);

    if (game && typeof game.setDimensions === 'function') {
      game.setDimensions(cols, rows);
    }

    // 5. Set container dimensions via inline style
    container.style.width  = `${this.boardWidth}px`;
    container.style.height = `${this.boardHeight}px`;
    container.style.overflow = 'hidden';
    container.style.marginLeft = 'auto';
    container.style.marginRight = 'auto';

    this.offsetX = 0;
    this.offsetY = 0;

    // 6. Set canvas resolution (retina-aware)
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
  drawGrid(width, height, cols = 7, rows = 15) {
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

  // ─── Draw 3D packet block tile (Strict No-Overlap Model: packetWidth = cellWidth, packetHeight = cellHeight) ─────
  drawTile(ctx, x, y, cellSize, flavor, isGhost = false, isActiveFalling = false, alpha = 1.0, offsetX = 0, offsetY = 0, customCellH = null, customPy = null, customScale = null) {
    const cW = cellSize;
    const cH = customCellH != null ? customCellH : (this.cellHeight || cellSize);
    const baseScale = customScale != null ? customScale : 1.0;

    const flavorId = flavor ? flavor.id : 'salted';
    const trimmedCanvas = TRIMMED_PACKET_CANVASES[flavorId];
    const rawImg = PACKET_IMAGES[flavorId];
    const spriteSource = trimmedCanvas || rawImg;
    if (!spriteSource) return;

    // Exact 1:1 Cell Footprint — 1 full complete packet per cell
    const blockW = Math.ceil(cW * baseScale);
    const blockH = Math.ceil(cH * baseScale);

    const px = Math.floor(offsetX + x * cW);
    const py = Math.floor(customPy != null ? customPy : (offsetY + y * cH));

    const srcW = spriteSource.width || spriteSource.naturalWidth;
    const srcH = spriteSource.height || spriteSource.naturalHeight;

    if (isGhost) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.drawImage(spriteSource, 0, 0, srcW, srcH, px, py, blockW, blockH);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1.0, alpha));
    if (typeof ctx.filter !== 'undefined') {
      ctx.filter = 'none';
    }
    ctx.drawImage(spriteSource, 0, 0, srcW, srcH, px, py, blockW, blockH);
    ctx.restore();
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

    // Clip outer board boundary to exact playfield dimensions (No vertical overflow into outer space)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(0, 0, width, height);
    this.ctx.clip();

    this.drawGrid(width, height, cols, rows);

    const now = performance.now();

    // Single Unified Grid Render Pass (Stationary & Falling Blocks drawn from 1 authoritative source)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = game.grid[r] ? game.grid[r][c] : null;
        if (!cell) continue;

        let drawRow = r;
        let alpha = 1.0;
        let scale = 1.0;

        // 1. Continuous falling interpolation (Single source of truth per block)
        if (cell.animStartTime !== undefined && cell.startRow !== undefined && cell.targetRow !== undefined) {
          const blockDuration = cell.animDuration || 350;
          const blockElapsed = Math.max(0, now - cell.animStartTime);
          const progress = Math.min(1.0, blockElapsed / blockDuration);
          const easeInGravity = Math.pow(progress, 1.8);

          drawRow = cell.startRow + easeInGravity * (cell.targetRow - cell.startRow);

          // Once block reaches destination, finalize position
          if (progress >= 1.0) {
            delete cell.animStartTime;
            delete cell.startRow;
            delete cell.targetRow;
            delete cell.animDuration;
            drawRow = r;
          }
        } else if (cell.popStartTime !== undefined) {
          // Balloon pop break animation
          const elapsed = now - cell.popStartTime;
          const popDuration = 180;
          if (elapsed < popDuration) {
            const t = elapsed / popDuration;
            if (t < 0.25) {
              scale = 1.0 + (t / 0.25) * 0.12;
            } else {
              const shrinkT = (t - 0.25) / 0.75;
              scale = 1.12 * (1.0 - shrinkT);
              alpha = 1.0 - shrinkT;
            }
          } else {
            continue; // Popped block finished, skip drawing
          }
        }

        const visualY = drawRow * this.cellHeight;
        this.drawTile(this.ctx, c, 0, this.cellWidth, cell.flavor, false, false, Math.max(0, alpha), 0, 0, null, visualY, scale);
      }
    }

    if (game.currentPiece && !game.gameOver) {
      const piece = game.currentPiece;

      // 1. Ghost Landing Preview (Only drawn when active piece is falling above landing spot)
      const ghostY = game.getGhostY();
      if (ghostY !== piece.y) {
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
      }

      // 2. Active Falling Piece (Rendered with continuous free-fall smooth Y motion)
      const activePieceBaseY = (continuousRow != null ? continuousRow : piece.y) * this.cellHeight;
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

      const flavorId = holdPiece.flavor ? holdPiece.flavor.id : 'salted';
      const trimmedCanvas = TRIMMED_PACKET_CANVASES[flavorId];
      const rawImg = PACKET_IMAGES[flavorId];
      const spriteSource = trimmedCanvas || rawImg;
      if (!spriteSource) return;

      const aspectRatio = PACKET_ASPECT_RATIOS[flavorId] || (rawImg && rawImg.naturalWidth ? rawImg.naturalHeight / rawImg.naturalWidth : 1.25);
      const miniCellH = Math.round(miniCellW * aspectRatio);
      const matrix = holdPiece.matrix;
      const cols = matrix[0].length;
      const rows = matrix.length;
      const startX = (canvas.width  - cols * miniCellW) / 2;
      const startY = (canvas.height - rows * miniCellH) / 2;

      const srcW = spriteSource.width || spriteSource.naturalWidth;
      const srcH = spriteSource.height || spriteSource.naturalHeight;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (matrix[r][c]) {
            const px = startX + c * miniCellW;
            const py = startY + r * miniCellH;
            ctx.drawImage(spriteSource, 0, 0, srcW, srcH, px, py, miniCellW, miniCellH);
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
      if (!canvas) return;
      if (!nextQueueTypes || nextQueueTypes.length === 0) return;
      const ctx = canvas.getContext('2d');
      const canvasW = canvas.width;
      const canvasH = canvas.height;
      ctx.clearRect(0, 0, canvasW, canvasH);

      const piece = createPieceFn(nextQueueTypes[0]);
      if (!piece) return;

      const flavorId = piece.flavor ? piece.flavor.id : 'salted';
      const trimmedCanvas = TRIMMED_PACKET_CANVASES[flavorId];
      const rawImg = PACKET_IMAGES[flavorId];
      const spriteSource = trimmedCanvas || rawImg;
      if (!spriteSource) return;

      const aspectRatio = PACKET_ASPECT_RATIOS[flavorId] || (rawImg && rawImg.naturalWidth ? rawImg.naturalHeight / rawImg.naturalWidth : 1.25);
      const matrix = piece.matrix;
      const cols = matrix[0].length;
      const rows = matrix.length;

      const miniCellW = Math.min(Math.floor(canvasW / (cols + 0.5)), Math.floor(canvasH / (rows * aspectRatio)));
      const miniCellH = Math.round(miniCellW * aspectRatio);

      const startX = (canvasW - cols * miniCellW) / 2;
      const startY = (canvasH - rows * miniCellH) / 2;

      const srcW = spriteSource.width || spriteSource.naturalWidth;
      const srcH = spriteSource.height || spriteSource.naturalHeight;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (matrix[r][c]) {
            const px = startX + c * miniCellW;
            const py = startY + r * miniCellH;
            ctx.drawImage(spriteSource, 0, 0, srcW, srcH, px, py, miniCellW + 0.8, miniCellH + 0.8);
          }
        }
      }
    };

    drawHorizontalQueue(this.nextCanvasDesktop);
    drawHorizontalQueue(this.nextCanvasMobile);
  }
}
