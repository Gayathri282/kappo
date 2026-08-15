/* ==========================================================================
   TETRIS ENGINE - KAPPO CRUNCH STACK
   7x14 Grid (7 cols wide x 14 rows high), SRS Rotation System, Wall Kicks, 7-Bag Randomizer
   ========================================================================== */

export const GRID_COLS = 10;
export const GRID_ROWS = 13;

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
  constructor(initialCols = 6, initialRows = 12) {
    this.cols = initialCols;
    this.rows = initialRows;
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

  setDimensions(cols, rows) {
    if (cols === this.cols && rows === this.rows) return;
    const oldCols = this.cols;
    const oldRows = this.rows;
    this.cols = cols;
    this.rows = rows;

    const newGrid = [];
    for (let r = 0; r < rows; r++) {
      const newRow = new Array(cols).fill(null);
      const oldR = r - (rows - oldRows);
      if (oldR >= 0 && oldR < oldRows && this.grid && this.grid[oldR]) {
        for (let c = 0; c < Math.min(oldCols, cols); c++) {
          newRow[c] = this.grid[oldR][c];
        }
      }
      newGrid.push(newRow);
    }
    this.grid = newGrid;

    if (this.currentPiece) {
      const pCols = this.currentPiece.matrix[0].length;
      this.currentPiece.x = Math.max(0, Math.min(cols - pCols, this.currentPiece.x));
    }
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
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const gridX = px + c;
          const gridY = py + r;

          // Boundary checks
          if (gridX < 0 || gridX >= this.cols || gridY >= this.rows) {
            return true;
          }
          // Grid block collision (ignore above top grid)
          if (gridY >= 0 && this.grid[gridY][gridX] !== null) {
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
        if (this.checkCollision(piece.x, piece.y, piece.matrix)) {
          console.warn('[Tetris] Post-rotation collision detected! Reverting rotation state.');
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
    let ghostY = this.currentPiece.y;
    while (!this.checkCollision(this.currentPiece.x, ghostY + 1, this.currentPiece.matrix)) {
      ghostY++;
    }
    return ghostY;
  }

  lockPiece() {
    if (this.isLocking || !this.currentPiece) return;
    this.isLocking = true;
    const piece = this.currentPiece;
    this.lastPlacedCells = [];
    let lockedAboveTop = false;

    for (let r = 0; r < piece.matrix.length; r++) {
      for (let c = 0; c < piece.matrix[r].length; c++) {
        if (piece.matrix[r][c]) {
          const gridX = piece.x + c;
          const gridY = piece.y + r;
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

    if (clearedIndices.length === 0) {
      return { count: 0, lines: [], chainCells: [], rowSequences: [], maxSteps: 0, clearedDetails: [], allClearedKeys: new Set() };
    }

    const allClearedKeys = new Set();
    const chainCells = [];

    // Add all cells of the completed rows to allClearedKeys
    clearedIndices.forEach(r => {
      for (let c = 0; c < this.cols; c++) {
        allClearedKeys.add(`${r}_${c}`);
      }
    });

    // CHAIN CLEAR TRIGGER: ONLY if at least one completed row is 100% uniform (isMono)!
    const monoClears = clearedDetails.filter(d => d.isMono);

    if (monoClears.length > 0) {
      // Find all matching packet flavors from uniform cleared rows
      const monoFlavorIds = new Set(monoClears.map(d => d.flavor ? d.flavor.id : null).filter(Boolean));

      // Search ENTIRE board for any blocks matching these uniform flavors!
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const key = `${r}_${c}`;
          if (!allClearedKeys.has(key)) {
            const cell = this.grid[r][c];
            if (cell && cell.flavor && monoFlavorIds.has(cell.flavor.id)) {
              allClearedKeys.add(key);
              chainCells.push({ r, c, flavor: cell.flavor });
            }
          }
        }
      }
    }

    // Build staggered break sequences (covering full rows + chain cells)
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

  // Collapse clearing rows & apply score/level stats after break animation
  finishClearLines(clearedIndices, clearedDetails, allClearedKeys = null, chainCells = []) {
    if (!clearedIndices || clearedIndices.length === 0) return { count: 0, lines: [], blastedCells: [], extraBlastCount: 0, clearedDetails: [], monoCount: 0, monoFlavor: null, earnedScore: 0, leveledUp: false, settlingBlocks: [] };

    // Compute settling trajectories BEFORE modifying grid data
    const settlingBlocks = this.computeSettlingTrajectory(clearedIndices, allClearedKeys);

    const blastedCells = [];

    if (allClearedKeys) {
      allClearedKeys.forEach(key => {
        const [rStr, cStr] = key.split('_');
        const r = parseInt(rStr, 10);
        const c = parseInt(cStr, 10);
        if (this.grid[r] && this.grid[r][c]) {
          blastedCells.push({ r, c, flavor: this.grid[r][c].flavor, isDirectLine: clearedIndices.includes(r) });
          this.grid[r][c] = null;
        }
      });
    }

    // Remove full cleared rows in DESCENDING order so indices do not shift!
    const sortedLines = [...clearedIndices].sort((a, b) => b - a);
    sortedLines.forEach(index => {
      this.grid.splice(index, 1);
      this.grid.unshift(new Array(this.cols).fill(null));
    });

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
      settlingBlocks: settlingBlocks
    };
  }

  // Clear full horizontal lines synchronously (fallback wrapper)
  clearLines() {
    const detect = this.detectLineClears();
    if (detect.count === 0) {
      return { count: 0, lines: [], blastedCells: [], extraBlastCount: 0, clearedDetails: [], monoCount: 0, monoFlavor: null, earnedScore: 0, leveledUp: false };
    }
    return this.finishClearLines(detect.lines, detect.clearedDetails);
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
