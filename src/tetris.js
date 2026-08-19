/* ==========================================================================
   TETRIS ENGINE - KAPPO CRUNCH STACK
   7x15 Grid (7 cols wide x 15 rows high), SRS Rotation System, Wall Kicks, 7-Bag Randomizer
   Bigger, clearly legible packet branding first!
   ========================================================================== */

export const GRID_COLS = 7;
export const GRID_ROWS = 15;

// 4 User Kappo Flavors (Exclusive to user provided packet PNG images)
export const FLAVORS = [
  { id: 'salted', name: 'Classic Salted', mainColor: '#FACC15', accentColor: '#FEF08A', badge: '🍌', sub: 'Classic Salted' },
  { id: 'chilli', name: 'Chilli Garlic', mainColor: '#22C55E', accentColor: '#86EFAC', badge: '🌶️', sub: 'Chilli Garlic' },
  { id: 'tomato', name: 'Tangy Tomato', mainColor: '#EF4444', accentColor: '#FCA5A5', badge: '🍅', sub: 'Tangy Tomato' },
  { id: 'dynamite', name: 'Cassava Dynamite', mainColor: '#F97316', accentColor: '#FDBA74', badge: '🔥', sub: 'Dynamite' },
];

// 7 Tetromino Definitions mapped strictly to 4 user Kappo packet images
export const SHAPES = {
  I: {
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    flavorIndex: 1 // Chilli Garlic
  },
  J: {
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    flavorIndex: 2 // Tangy Tomato
  },
  L: {
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ],
    flavorIndex: 3 // Cassava Dynamite
  },
  O: {
    matrix: [
      [1, 1],
      [1, 1]
    ],
    flavorIndex: 0 // Classic Salted
  },
  S: {
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    flavorIndex: 1 // Chilli Garlic
  },
  T: {
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    flavorIndex: 2 // Tangy Tomato
  },
  Z: {
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ],
    flavorIndex: 3 // Cassava Dynamite
  }
};

// SRS Wall Kick Offsets for J, L, S, T, Z pieces
const KICK_OFFSETS_JLSTZ = [
  // 0->1
  [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  // 1->2
  [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  // 2->3
  [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  // 3->0
  [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
];

// SRS Wall Kick Offsets for I piece
const KICK_OFFSETS_I = [
  // 0->1
  [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  // 1->2
  [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  // 2->3
  [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  // 3->0
  [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
];

export class TetrisGame {
  constructor(initialCols = 7, initialRows = 15) {
    this.cols = 7;
    this.rows = 15;
    this.grid = this.createGrid();
    this.bag = [];
    this.currentPiece = null;
    this.holdPiece = null;
    this.canHold = true;
    this.nextQueue = [];

    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.survivalTime = 0;
    this.scoreAccumulator = 0;
    this.gameOver = false;
    this.paused = false;
    this.isSpeedBoosted = false;

    this.initQueue();
    this.spawnPiece();
  }

  setDimensions(cols = 7, rows = 15) {
    this.cols = 7;
    this.rows = 15;
  }

  createGrid() {
    const grid = [];
    for (let r = 0; r < this.rows; r++) {
      grid.push(new Array(this.cols).fill(null));
    }
    return grid;
  }

  reset() {
    this.grid = this.createGrid();
    this.bag = [];
    this.currentPiece = null;
    this.holdPiece = null;
    this.canHold = true;
    this.nextQueue = [];
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.survivalTime = 0; // Survival time counter in seconds
    this.scoreAccumulator = 0;
    this.gameOver = false;
    this.paused = false;
    this.isSpeedBoosted = false;
    this.isLocking = false;

    this.initQueue();
    this.spawnPiece();
  }

  // Centralized score addition
  addScore(points) {
    if (this.gameOver || !points || points <= 0) return this.score;
    this.score += points;
    return this.score;
  }

  // Update survival timer & time-based gravity acceleration + minor background score trickle (+1 pt every 4s)
  updateTime(deltaSeconds) {
    if (this.gameOver || this.paused) return false;
    this.survivalTime += deltaSeconds;
    this.timeSinceLastPlacement = (this.timeSinceLastPlacement || 0) + deltaSeconds;

    // Minor background time trickle (+1 point every 4s), capped if no piece locked in last 12s
    if (this.timeSinceLastPlacement <= 12.0) {
      this.scoreAccumulator += deltaSeconds * 0.25;
      if (this.scoreAccumulator >= 1.0) {
        const pts = Math.floor(this.scoreAccumulator);
        this.scoreAccumulator -= pts;
        this.addScore(pts);
      }
    }

    // Every 15 seconds, level increases & fall speed accelerates!
    const newLevel = Math.floor(this.survivalTime / 15) + 1;
    const leveledUp = newLevel > this.level;
    this.level = newLevel;
    return leveledUp;
  }

  // 7-Bag Randomizer
  refillBag() {
    const types = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    // Shuffle array
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    this.bag.push(...types);
  }

  getNextType() {
    if (this.bag.length < 7) {
      this.refillBag();
    }
    return this.bag.shift();
  }

  initQueue() {
    while (this.nextQueue.length < 4) {
      this.nextQueue.push(this.getNextType());
    }
  }

  createPiece(type) {
    const shapeDef = SHAPES[type];
    const flavor = FLAVORS[shapeDef.flavorIndex];

    return {
      type: type,
      matrix: shapeDef.matrix.map(row => [...row]),
      rotation: 0,
      flavor: flavor,
      x: Math.floor((this.cols - shapeDef.matrix[0].length) / 2),
      y: type === 'I' ? -1 : 0
    };
  }

  spawnPiece() {
    const nextType = this.nextQueue.shift();
    this.nextQueue.push(this.getNextType());

    this.currentPiece = this.createPiece(nextType);
    this.canHold = true;

    // Game Over check on spawn collision
    if (this.checkCollision(this.currentPiece.x, this.currentPiece.y, this.currentPiece.matrix)) {
      this.gameOver = true;
    }
  }

  checkCollision(px, py, matrix) {
    const intX = Math.floor(px);
    const intY = Math.floor(py);

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const gridX = intX + c;
          const gridY = intY + r;

          // Boundary checks
          if (gridX < 0 || gridX >= this.cols || gridY >= this.rows) {
            return true;
          }
          // Grid block collision (ignore above top grid)
          if (gridY >= 0 && this.grid[gridY] && this.grid[gridY][gridX] !== null) {
            return true;
          }
        }
      }
    }
    return false;
  }

  moveLeft() {
    if (this.gameOver || this.paused || !this.currentPiece) return false;
    if (!this.checkCollision(this.currentPiece.x - 1, this.currentPiece.y, this.currentPiece.matrix)) {
      this.currentPiece.x--;
      return true;
    }
    return false;
  }

  moveRight() {
    if (this.gameOver || this.paused || !this.currentPiece) return false;
    if (!this.checkCollision(this.currentPiece.x + 1, this.currentPiece.y, this.currentPiece.matrix)) {
      this.currentPiece.x++;
      return true;
    }
    return false;
  }

  rotateMatrix(matrix, dir) {
    const N = matrix.length;
    const result = Array.from({ length: N }, () => new Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (dir > 0) {
          result[c][N - 1 - r] = matrix[r][c]; // CW
        } else {
          result[N - 1 - c][r] = matrix[r][c]; // CCW
        }
      }
    }
    return result;
  }

  validatePieceIntegrity(piece) {
    if (!piece || !piece.matrix || !Array.isArray(piece.matrix)) {
      console.error('[CRITICAL SHAPE CORRUPTION] Piece matrix is invalid or not an array!', piece);
      return false;
    }

    let cellCount = 0;
    for (let r = 0; r < piece.matrix.length; r++) {
      if (!Array.isArray(piece.matrix[r])) {
        console.error(`[CRITICAL SHAPE CORRUPTION] Piece matrix row ${r} is not an array!`, piece.matrix);
        return false;
      }
      for (let c = 0; c < piece.matrix[r].length; c++) {
        if (piece.matrix[r][c] === 1) {
          cellCount++;
        }
      }
    }

    if (cellCount !== 4) {
      console.error(`[CRITICAL SHAPE CORRUPTION] Invalid cell count in piece shape matrix! Expected 4 cells, found ${cellCount}. Matrix:`, JSON.stringify(piece.matrix));
      return false;
    }

    return true;
  }

  rotate(dir = 1) {
    if (this.gameOver || this.paused || this.isClearing || this.isLocking || !this.currentPiece) return false;

    const piece = this.currentPiece;
    if (piece.type === 'O') return false; // O piece doesn't rotate

    // Deep clone initial state for 100% safe fallback rollback
    const origX = piece.x;
    const origY = piece.y;
    const origMatrix = piece.matrix.map(row => [...row]);
    const origRotation = piece.rotation;

    const rotatedMatrix = this.rotateMatrix(piece.matrix, dir);
    const newRotation = (origRotation + dir + 4) % 4;

    // Pre-rotation shape matrix integrity validation
    const tempPiece = { matrix: rotatedMatrix };
    if (!this.validatePieceIntegrity(tempPiece)) {
      console.error('[Tetris] Rotated matrix failed shape integrity validation! Rejecting rotation.');
      return false;
    }

    // SRS Wall kick test + Extended Floor Kick offsets so rotation works all the way down to the last grid!
    const kickIndex = dir > 0 ? origRotation : newRotation;
    const kickTable = piece.type === 'I' ? KICK_OFFSETS_I : KICK_OFFSETS_JLSTZ;
    const baseOffsets = kickTable[kickIndex] || [[0, 0]];

    const extendedOffsets = [
      ...baseOffsets,
      [0, -1], [-1, 0], [1, 0], [0, -2],
      [-1, -1], [1, -1], [-1, -2], [1, -2],
      [-2, 0], [2, 0], [0, -3], [-2, -1], [2, -1]
    ];

    for (let i = 0; i < extendedOffsets.length; i++) {
      const [dx, dy] = extendedOffsets[i];
      const testX = origX + (dir > 0 ? dx : -dx);
      const testY = origY + (dir > 0 ? -dy : dy);

      if (!this.checkCollision(testX, testY, rotatedMatrix)) {
        piece.matrix = rotatedMatrix;
        piece.x = testX;
        piece.y = testY;
        piece.rotation = newRotation;

        // Post-rotation Integrity Guard: Verify state is 100% valid & collision-free
        if (this.checkCollision(piece.x, piece.y, piece.matrix) || !this.validatePieceIntegrity(piece)) {
          console.warn('[Tetris] Post-rotation collision or shape corruption detected! Reverting rotation state.');
          piece.x = origX;
          piece.y = origY;
          piece.matrix = origMatrix;
          piece.rotation = origRotation;
          return false;
        }

        return true;
      }
    }

    // No valid wall-kick offset found: silently reject and guarantee exact rollback
    piece.x = origX;
    piece.y = origY;
    piece.matrix = origMatrix;
    piece.rotation = origRotation;
    return false;
  }

  softDrop() {
    if (this.gameOver || this.paused || this.isClearing || this.isLocking || !this.currentPiece) return false;
    if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.matrix)) {
      this.currentPiece.y++;
      this.score += 1;
      return true;
    }
    this.lockPiece();
    return false;
  }

  hardDrop() {
    if (this.gameOver || this.paused || this.isClearing || this.isLocking || !this.currentPiece) return 0;
    let dropDistance = 0;
    while (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.matrix)) {
      this.currentPiece.y++;
      dropDistance++;
    }
    this.score += dropDistance * 2;
    this.lockPiece();
    return dropDistance;
  }

  hold() {
    if (this.gameOver || this.paused || !this.canHold || this.isClearing || this.isLocking || !this.currentPiece) return false;

    const currentType = this.currentPiece.type;
    if (this.holdPiece === null) {
      this.holdPiece = this.createPiece(currentType);
      this.spawnPiece();
    } else {
      const tempType = this.holdPiece.type;
      this.holdPiece = this.createPiece(currentType);
      this.currentPiece = this.createPiece(tempType);
    }
    this.canHold = false;
    return true;
  }

  getGhostY() {
    if (!this.currentPiece) return 0;
    let ghostY = Math.floor(this.currentPiece.y);
    while (!this.checkCollision(this.currentPiece.x, ghostY + 1, this.currentPiece.matrix)) {
      ghostY++;
    }
    return ghostY;
  }

  validatePhysicsNoGaps() {
    let floatingCount = 0;
    for (let r = 0; r < this.rows - 1; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] !== null && this.grid[r + 1][c] === null) {
          floatingCount++;
          console.error(`[CRITICAL PHYSICS BUG] Floating block detected at Row ${r}, Col ${c} with empty gap at Row ${r + 1}!`);
        }
      }
    }
    return floatingCount;
  }

  validateLockConnectivity() {
    if (!this.lastPlacedCells || this.lastPlacedCells.length === 0) return true;

    // Check BFS orthogonal connectivity among all newly placed cells
    const placedSet = new Set(this.lastPlacedCells.map(cell => `${cell.r}_${cell.c}`));
    const visited = new Set();
    const queue = [this.lastPlacedCells[0]];
    visited.add(`${this.lastPlacedCells[0].r}_${this.lastPlacedCells[0].c}`);

    while (queue.length > 0) {
      const { r, c } = queue.shift();
      const neighbors = [
        { r: r - 1, c: c },
        { r: r + 1, c: c },
        { r: r, c: c - 1 },
        { r: r, c: c + 1 }
      ];

      neighbors.forEach(n => {
        const key = `${n.r}_${n.c}`;
        if (placedSet.has(key) && !visited.has(key)) {
          visited.add(key);
          queue.push(n);
        }
      });
    }

    if (visited.size !== this.lastPlacedCells.length) {
      console.error(`[CRITICAL SHAPE DISCONNECTION BUG] Locked piece cells are DISCONNECTED! Placed count: ${this.lastPlacedCells.length}, Connected cluster: ${visited.size}`, this.lastPlacedCells);
      return false;
    }
    return true;
  }

  lockPiece() {
    if (this.isLocking || !this.currentPiece) return;
    this.isLocking = true;
    const piece = this.currentPiece;

    // Recalculate landing row dynamically for piece's exact current x and matrix
    const landingY = this.getGhostY();
    piece.y = landingY;

    const intX = Math.round(piece.x);
    const intY = Math.floor(piece.y);

    this.lastPlacedCells = [];
    let lockedAboveTop = false;

    for (let r = 0; r < piece.matrix.length; r++) {
      for (let c = 0; c < piece.matrix[r].length; c++) {
        if (piece.matrix[r][c]) {
          const gridX = intX + c;
          const gridY = intY + r;
          if (gridY < 0) {
            lockedAboveTop = true;
          } else if (gridY < this.rows && gridX >= 0 && gridX < this.cols) {
            this.grid[gridY][gridX] = {
              flavor: piece.flavor,
              type: piece.type
            };
            this.lastPlacedCells.push({ r: gridY, c: gridX });
          }
        }
      }
    }

    if (lockedAboveTop) {
      this.gameOver = true;
    }

    // Run lock connectivity validation check
    this.validateLockConnectivity();

    this.timeSinceLastPlacement = 0;
    this.currentPiece = null;
    this.isLocking = false;
  }

  // Detect completed rows & compute dynamic BFS flood-fill same-flavor chain-clear
  detectLineClears() {
    const clearedIndices = [];
    const clearedDetails = [];

    for (let r = this.rows - 1; r >= 0; r--) {
      const isFull = this.grid[r] && this.grid[r].every(cell => cell !== null);
      if (isFull) {
        const isActuallyFull = this.grid[r] && this.grid[r].every(cell => cell !== null);
        if (!isActuallyFull) {
          console.error(`[BUG CAUGHT] Row ${r} was about to be cleared but is NOT full. Contents:`, JSON.stringify(this.grid[r]));
        } else {
          clearedIndices.push(r);
          const firstFlavorId = this.grid[r][0].flavor ? this.grid[r][0].flavor.id : null;
          const isMono = this.grid[r].every(cell => cell && cell.flavor && cell.flavor.id === firstFlavorId);
          clearedDetails.push({
            lineIndex: r,
            isMono: isMono,
            flavor: this.grid[r][0].flavor
          });
        }
      }
    }

    if (clearedIndices.length === 0) {
      return { count: 0, lines: [], chainCells: [], rowSequences: [], maxSteps: 0, clearedDetails: [], allClearedKeys: new Set() };
    }

    // Detailed diagnostic logging for exact row state analysis
    clearedIndices.forEach(r => {
      const occStr = this.grid[r].map(c => c ? c.flavor.id.substring(0, 4) : '---').join('|');
      console.log(`[CLEAR TRIGGER AUDIT] Verified 100% Full Row at Row ${r}: [${occStr}]`);
    });

    const allClearedKeys = new Set();
    const chainCells = [];

    // Add ONLY cells belonging to verified 100% completed full rows
    clearedIndices.forEach(r => {
      for (let c = 0; c < this.cols; c++) {
        allClearedKeys.add(`${r}_${c}`);
      }
    });

    const monoClears = clearedDetails.filter(d => d.isMono);
    if (monoClears.length > 0) {
      const monoFlavorIds = Array.from(new Set(monoClears.map(d => d.flavor ? d.flavor.id : null).filter(Boolean)));
      console.log(`[CLEAR TRIGGER AUDIT] Mono-Flavor Full Batch Bonus Row Clear! Flavors: ${monoFlavorIds.join(', ')}`);
    }

    // Build staggered break sequences (covering full rows)
    const rowSequences = [];
    const lastPlaced = this.lastPlacedCells || [];

    const cellsByRow = {};
    allClearedKeys.forEach(key => {
      const [rStr, cStr] = key.split('_');
      const r = parseInt(rStr, 10);
      const c = parseInt(cStr, 10);
      if (!cellsByRow[r]) cellsByRow[r] = [];
      cellsByRow[r].push(c);
    });

    Object.keys(cellsByRow).forEach(rStr => {
      const r = parseInt(rStr, 10);
      const rowCols = cellsByRow[r];
      const rowPlacedCols = lastPlaced.filter(cell => cell.r === r).map(cell => cell.c);

      const hasFarLeft = rowPlacedCols.includes(0);
      const hasFarRight = rowPlacedCols.includes(this.cols - 1);

      let steps = [];
      if (hasFarLeft && !hasFarRight) {
        rowCols.sort((a, b) => a - b).forEach(c => steps.push([c]));
      } else if (hasFarRight && !hasFarLeft) {
        rowCols.sort((a, b) => b - a).forEach(c => steps.push([c]));
      } else {
        let centerCol = Math.floor(this.cols / 2);
        if (rowPlacedCols.length > 0) {
          const minC = Math.min(...rowPlacedCols);
          const maxC = Math.max(...rowPlacedCols);
          centerCol = Math.round((minC + maxC) / 2);
        }

        const maxDist = Math.max(...rowCols.map(c => Math.abs(c - centerCol)));
        for (let d = 0; d <= maxDist; d++) {
          const stepCols = rowCols.filter(c => Math.abs(c - centerCol) === d);
          if (stepCols.length > 0) {
            steps.push(stepCols);
          }
        }
      }

      rowSequences.push({ row: r, steps: steps });
    });

    const maxSteps = Math.max(...rowSequences.map(s => s.steps.length));

    return {
      count: clearedIndices.length,
      lines: clearedIndices,
      clearedDetails: clearedDetails,
      chainCells: chainCells,
      rowSequences: rowSequences,
      maxSteps: maxSteps,
      allClearedKeys: allClearedKeys
    };
  }

  computeSettlingTrajectory(clearedIndices, allClearedKeys) {
    const settlingBlocks = [];
    const clearedSet = new Set(clearedIndices || []);

    for (let c = 0; c < this.cols; c++) {
      let dropOffset = 0;
      for (let r = this.rows - 1; r >= 0; r--) {
        const key = `${r}_${c}`;
        const isCellCleared = (allClearedKeys && allClearedKeys.has(key)) || clearedSet.has(r);

        if (isCellCleared) {
          dropOffset++;
        } else if (this.grid[r] && this.grid[r][c] && dropOffset > 0) {
          settlingBlocks.push({
            col: c,
            startRow: r,
            targetRow: r + dropOffset,
            dropDistance: dropOffset,
            flavor: this.grid[r][c].flavor
          });
        }
      }
    }
    return settlingBlocks;
  }

  // Rescan entire board column by column (bottom to top), shift blocks down & pad top with empty cells
  collapseGrid(collapseTime = null) {
    const startTime = collapseTime || performance.now();
    const UNIFORM_FALL_DURATION = 350;

    // 1. Pre-collapse sanity check: count occupied cells
    let countBefore = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] !== null) {
          countBefore++;
        }
      }
    }

    // 2. Column-by-column compaction (from top to bottom preserving relative order)
    for (let c = 0; c < this.cols; c++) {
      const occupied = [];
      for (let r = 0; r < this.rows; r++) {
        if (this.grid[r][c] !== null) {
          occupied.push({ cell: this.grid[r][c], oldRow: r });
        }
      }

      const emptyCount = this.rows - occupied.length;
      // Re-write column: top padded with null, bottom filled with occupied cells
      for (let r = 0; r < emptyCount; r++) {
        this.grid[r][c] = null;
      }
      for (let i = 0; i < occupied.length; i++) {
        const newRow = emptyCount + i;
        const item = occupied[i];
        const cell = item.cell;

        this.grid[newRow][c] = cell;

        // If block moved down, attach fall animation properties directly to cell object!
        if (newRow > item.oldRow) {
          cell.startRow = item.oldRow;
          cell.targetRow = newRow;
          cell.animStartTime = startTime;
          cell.animDuration = UNIFORM_FALL_DURATION;
        }
      }
    }

    // 3. Post-collapse sanity check: verify count matches
    let countAfter = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] !== null) {
          countAfter++;
        }
      }
    }

    console.log(`[Collapse Integrity Check] Occupied blocks count before collapse: ${countBefore}, after collapse: ${countAfter}`);
    if (countBefore !== countAfter) {
      console.warn(`[Collapse Bug Warning] Occupied cell mismatch detected! Before: ${countBefore}, After: ${countAfter}`);
    }

    // Run physics gap audit check
    this.validatePhysicsNoGaps();
  }

  // Collapse clearing rows & apply score/level stats after break animation
  finishClearLines(clearedIndices, clearedDetails, allClearedKeys, chainCells, batchStartTime = null) {
    if ((!clearedIndices || clearedIndices.length === 0) && (!allClearedKeys || allClearedKeys.size === 0)) {
      return { count: 0, lines: [], blastedCells: [], chainCount: 0, clearedDetails: [], maxDuration: 0 };
    }

    // Safety Audit Check: Log warning if single clear event clears > 21 cells (>3 rows)
    const totalCellsToClear = allClearedKeys ? allClearedKeys.size : (clearedIndices.length * this.cols);
    if (totalCellsToClear > 21) {
      console.warn(`[SAFETY CAP AUDIT WARNING] Large clear event triggered! Clearing ${totalCellsToClear} cells (${clearedIndices.length} rows).`);
      clearedIndices.forEach(r => {
        const occStr = this.grid[r].map(c => c ? c.flavor.id.substring(0, 4) : '---').join('|');
        console.warn(`  - Cleared Row ${r}: [${occStr}] (Rule: Verified 100% Full Row)`);
      });
    }

    // Compute settling trajectories BEFORE modifying grid data
    const settlingBlocks = this.computeSettlingTrajectory(clearedIndices, allClearedKeys);

    const blastedCells = [];

    if (allClearedKeys && allClearedKeys.size > 0) {
      allClearedKeys.forEach(key => {
        const [rStr, cStr] = key.split('_');
        const r = parseInt(rStr, 10);
        const c = parseInt(cStr, 10);
        if (this.grid[r] && this.grid[r][c] !== null) {
          blastedCells.push({ r, c, flavor: this.grid[r][c].flavor, isDirectLine: clearedIndices.includes(r) });
          this.grid[r][c] = null;
        }
      });
    } else if (clearedIndices && clearedIndices.length > 0) {
      clearedIndices.forEach(r => {
        for (let c = 0; c < this.cols; c++) {
          if (this.grid[r] && this.grid[r][c] !== null) {
            blastedCells.push({ r, c, flavor: this.grid[r][c].flavor, isDirectLine: true });
            this.grid[r][c] = null;
          }
        }
      });
    }

    // Rescan board and compact occupied cells downward column-by-column, attaching uniform batch fall properties
    const collapseTime = batchStartTime || performance.now();
    this.collapseGrid(collapseTime);
    const UNIFORM_FALL_DURATION = 350;

    const count = clearedIndices.length;
    this.lines += count;

    const monoDetails = (clearedDetails || []).filter(d => d.isMono);
    const monoCount = monoDetails.length;

    // Base Tetris scoring rules
    const baseScores = [0, 100, 300, 500, 800];
    const basePoints = (baseScores[count] || 0) * this.level;

    // Bonus points for chain-cleared adjacent packets (+35 pts per extra block)
    const chainBonus = (chainCells ? chainCells.length : 0) * 35 * this.level;

    let earnedScore = basePoints + chainBonus;
    if (monoCount > 0) {
      const bonusMultiplier = 2.5 + (monoCount - 1) * 0.5;
      earnedScore = Math.floor(basePoints * bonusMultiplier) + chainBonus;
    }

    this.addScore(earnedScore);

    const newLevel = Math.floor(this.lines / 10) + 1;
    const leveledUp = newLevel > this.level;
    this.level = newLevel;

    return {
      count: count,
      lines: clearedIndices,
      blastedCells: blastedCells,
      chainCount: chainCells ? chainCells.length : 0,
      clearedDetails: clearedDetails || [],
      monoCount: monoCount,
      monoFlavor: monoCount > 0 ? monoDetails[0].flavor : null,
      earnedScore: earnedScore,
      leveledUp: leveledUp,
      settlingBlocks: settlingBlocks,
      maxDuration: UNIFORM_FALL_DURATION
    };
  }

  // Clear full horizontal lines with pure single-pass Tetris line clear physics
  clearLines() {
    const detect = this.detectLineClears();
    if (detect.count === 0) {
      return {
        count: 0,
        lines: [],
        blastedCells: [],
        clearedDetails: [],
        monoCount: 0,
        chainCount: 0,
        earnedScore: 0,
        leveledUp: false,
        cascades: 0
      };
    }

    const res = this.finishClearLines(detect.lines, detect.clearedDetails, detect.allClearedKeys, detect.chainCells);
    return {
      count: res.count,
      lines: res.lines,
      blastedCells: res.blastedCells,
      clearedDetails: res.clearedDetails,
      monoCount: res.monoCount,
      chainCount: 0,
      earnedScore: res.earnedScore,
      leveledUp: res.leveledUp,
      cascades: 1
    };
  }

  // Tick gravity step
  tick() {
    if (this.gameOver || this.paused || !this.currentPiece) return false;
    if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.matrix)) {
      this.currentPiece.y++;
      return true;
    } else {
      this.lockPiece();
      return false; // Piece locked
    }
  }

  getDropSpeed() {
    // Time-accelerated fall speed: starts smooth (~700ms) and speeds up every 15s level
    const baseSpeed = Math.max(100, 700 - (this.level - 1) * 65);
    if (this.isSpeedBoosted) {
      return 75; // Accelerated speed boost gravity
    }
    return baseSpeed;
  }

  // True free-fall speed in rows per second (smooth gravity acceleration per frame)
  getFallSpeedRowsPerSec() {
    const baseRowsPerSec = 1.4 + (this.level - 1) * 0.35;
    if (this.isSpeedBoosted) {
      return baseRowsPerSec * 4.8; // Fast 4.8x acceleration during TURBO!
    }
    return baseRowsPerSec;
  }
}
