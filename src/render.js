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

    function isBgPixel(x, y) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      // Transparent pixel OR pure white background padding pixel
      return a < 15 || (r > 245 && g > 245 && b > 245);
    }

    // Edge-inward scan to locate the exact bounding box of the chip bag artwork
    let minY = 0;
    topLoop: for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!isBgPixel(x, y)) {
          minY = y;
          break topLoop;
        }
      }
    }

    let maxY = h - 1;
    bottomLoop: for (let y = h - 1; y >= 0; y--) {
      for (let x = 0; x < w; x++) {
        if (!isBgPixel(x, y)) {
          maxY = y;
          break bottomLoop;
        }
      }
    }

    let minX = 0;
    leftLoop: for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (!isBgPixel(x, y)) {
          minX = x;
          break leftLoop;
        }
      }
    }

    let maxX = w - 1;
    rightLoop: for (let x = w - 1; x >= 0; x--) {
      for (let y = 0; y < h; y++) {
        if (!isBgPixel(x, y)) {
          maxX = x;
          break rightLoop;
        }
      }
    }

    // Safety margin of 2 pixels around the packet artwork
    const finalMinX = Math.max(0, minX - 2);
    const finalMinY = Math.max(0, minY - 2);
    const finalMaxX = Math.min(w - 1, maxX + 2);
    const finalMaxY = Math.min(h - 1, maxY + 2);

    const cropW = Math.max(10, finalMaxX - finalMinX + 1);
    const cropH = Math.max(10, finalMaxY - finalMinY + 1);

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = cropW;
    trimmedCanvas.height = cropH;
    const trimmedCtx = trimmedCanvas.getContext('2d');
    trimmedCtx.drawImage(tempCanvas, finalMinX, finalMinY, cropW, cropH, 0, 0, cropW, cropH);

    TRIMMED_PACKET_CANVASES[flavorId] = trimmedCanvas;
    PACKET_ASPECT_RATIOS[flavorId] = cropH / cropW;
    console.log(`[Packet Trim Success] ${flavorId}: Original ${w}x${h} -> Trimmed ${cropW}x${cropH}, Aspect Ratio (H/W): ${(cropH / cropW).toFixed(3)}`);
  } catch (e) {
    console.warn(`[Packet Trim Warning] ${flavorId}:`, e);
    if (img.naturalWidth && img.naturalHeight) {
      PACKET_ASPECT_RATIOS[flavorId] = img.naturalHeight / img.naturalWidth;
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
    this.cellHeight = 30; // Square cells: cellWidth === cellHeight
    this.cellSize   = 30;
    this.dpr = window.devicePixelRatio || 1;

    this.visualPieceY = 0;
    this.lastPieceKey = null;
  }

  // ─── Resize: JS is the SINGLE SOURCE OF TRUTH for board dimensions ───────
  // Board = 7 cols × 15 rows (Large, clearly legible packet branding first)
  // Width is computed directly from viewport — NOT read from CSS/DOM.
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
    //    Mobile (≤768px): ~75% of viewport width, capped at 440px
    //    Desktop (>768px): ~55% of viewport width, capped at 600px
    const isMobile = viewportW <= 768;
    const targetW = isMobile
      ? Math.min(viewportW * 0.75, 440)
      : Math.min(viewportW * 0.55, 600);

    // 3. Grid dimensions: 7 columns × 15 rows for large chunky packet cells
    const cols = game ? game.cols : GRID_COLS;
    const rows = game ? game.rows : GRID_ROWS;

    // 4. Option A Aspect Ratio Clamping: Clamp cell height-to-width ratio within [1.0, 1.20]
    // Prevents distortion across tall screens (e.g. Vivo) vs shorter/wider screens (e.g. iPhone)
    const MIN_CELL_ASPECT = 1.0;
    const MAX_CELL_ASPECT = 1.20;

    const rawCellW = targetW / cols;
    const rawCellH = availH / rows;
    const naturalAspect = rawCellH / rawCellW;
    const clampedAspect = Math.max(MIN_CELL_ASPECT, Math.min(MAX_CELL_ASPECT, naturalAspect));

    let cellW = targetW / cols;
    let cellH = cellW * clampedAspect;

    // Height constraint: if board would exceed available height, scale down maintaining clamped aspect
    if (cellH * rows > availH) {
      cellH = availH / rows;
      cellW = cellH / clampedAspect;
    }

    this.cellWidth  = cellW;
    this.cellHeight = cellH;
    this.cellSize   = cellW;

    this.boardWidth  = Math.floor(cellW * cols);
    this.boardHeight = Math.floor(cellH * rows);

    if (game && typeof game.setDimensions === 'function') {
      game.setDimensions(cols, rows);
    }

    // 5. Set container dimensions via inline style (overflow: visible allows top packet overflow)
    container.style.width  = `${this.boardWidth}px`;
    container.style.height = `${this.boardHeight}px`;
    container.style.overflow = 'visible';
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

  // ─── Draw 3D packet block tile (Chunky 96% Full-Width Packets) ─────
  drawTile(ctx, x, y, cellSize, flavor, isGhost = false, isActiveFalling = false, alpha = 1.0, offsetX = 0, offsetY = 0, customCellH = null, customPy = null, customScale = null) {
    const cW = cellSize;
    const cH = customCellH != null ? customCellH : (this.cellHeight || cellSize);
    const baseScale = customScale != null ? customScale : 1.0;

    const flavorId = flavor ? flavor.id : 'salted';
    const trimmedCanvas = TRIMMED_PACKET_CANVASES[flavorId];
    const rawImg = PACKET_IMAGES[flavorId];
    const spriteSource = trimmedCanvas || rawImg;
    if (!spriteSource) return;

    // True natural height-to-width ratio of the trimmed chip bag
    const aspectRatio = PACKET_ASPECT_RATIOS[flavorId] || (rawImg && rawImg.naturalWidth ? rawImg.naturalHeight / rawImg.naturalWidth : 1.25);

    // Render packet width to fill ~96% of cell width (matching Lay's Stacks reference!)
    const fillRatio = 0.96;
    const blockW = Math.ceil(cW * fillRatio * baseScale);
    const blockH = Math.ceil(blockW * aspectRatio);

    // Center horizontally inside cell column
    const px = Math.floor(offsetX + x * cW + (cW - blockW) / 2);

    // Align base of packet inside grid cell foot, letting top overflow naturally per true aspect ratio
    const defaultPy = offsetY + y * cH - (blockH - cH);
    const py = Math.floor(customPy != null ? (customPy - (blockH - cH)) : defaultPy);

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

    // Clip outer board boundary allowing top overflow up to -1.5x cell height so top row packets aren't clipped
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(0, -this.cellHeight * 1.5, width, height + this.cellHeight * 1.5);
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
      const flavorId = piece.flavor ? piece.flavor.id : 'salted';

      // Subtle Dynamic Laser Beam Gradient matching exact packet flavor
      const FLAVOR_BEAM_COLORS = {
        salted:   { start: 'rgba(250, 204, 21, 0.16)', mid: 'rgba(234, 179, 8, 0.06)',  end: 'rgba(250, 204, 21, 0)' },
        chilli:   { start: 'rgba(34, 197, 94, 0.16)',  mid: 'rgba(22, 163, 74, 0.06)',  end: 'rgba(34, 197, 94, 0)' },
        tomato:   { start: 'rgba(239, 68, 68, 0.16)',  mid: 'rgba(220, 38, 38, 0.06)',  end: 'rgba(239, 68, 68, 0)' },
        dynamite: { start: 'rgba(168, 85, 247, 0.16)', mid: 'rgba(217, 70, 239, 0.06)', end: 'rgba(168, 85, 247, 0)' }
      };
      const beamColors = FLAVOR_BEAM_COLORS[flavorId] || FLAVOR_BEAM_COLORS.salted;

      // 1. Ghost Piece
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

      // 2. Dynamic Laser Beam Drop Guide Line
      const ghostYPixel = ghostY * this.cellHeight;
      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c]) {
            const colIndex = piece.x + c;
            const beamX = colIndex * this.cellWidth;
            const activeCellTopY = (piece.y + r) * this.cellHeight;
            const beamHeight = ghostYPixel - activeCellTopY;

            if (beamHeight > 4) {
              const beamGrad = this.ctx.createLinearGradient(beamX, activeCellTopY, beamX, ghostYPixel);
              beamGrad.addColorStop(0.0, beamColors.start);
              beamGrad.addColorStop(0.5, beamColors.mid);
              beamGrad.addColorStop(1.0, beamColors.end);

              this.ctx.fillStyle = beamGrad;
              this.ctx.fillRect(beamX, activeCellTopY, this.cellWidth, beamHeight);

              this.ctx.strokeStyle = beamColors.start;
              this.ctx.lineWidth = 1.0;
              this.ctx.beginPath();
              this.ctx.moveTo(beamX + 0.5, activeCellTopY);
              this.ctx.lineTo(beamX + 0.5, ghostYPixel);
              this.ctx.moveTo(beamX + this.cellWidth - 0.5, activeCellTopY);
              this.ctx.lineTo(beamX + this.cellWidth - 0.5, ghostYPixel);
              this.ctx.stroke();
            }
          }
        }
      }

      // 3. Active Falling Piece (Rendered with continuous free-fall smooth Y motion)
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
