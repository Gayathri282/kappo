/* ==========================================================================
   TETRIS ENGINE - KAPPO CRUNCH STACK
   7x14 Grid (7 cols wide x 14 rows high), SRS Rotation System, Wall Kicks, 7-Bag Randomizer
   ========================================================================== */

export const GRID_COLS = 7;
export const GRID_ROWS = 14;

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
  constructor() {
    this.grid = this.createGrid();
    this.bag = [];
    this.currentPiece = null;
    this.holdPiece = null;
    this.canHold = true;
    this.nextQueue = [];

    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.paused = false;
    this.isSpeedBoosted = false;

    this.initQueue();
    this.spawnPiece();
  }

  createGrid() {
    const grid = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      grid.push(new Array(GRID_COLS).fill(null));
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
    this.gameOver = false;
    this.paused = false;
    this.isSpeedBoosted = false;

    this.initQueue();
    this.spawnPiece();
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
      x: Math.floor((GRID_COLS - shapeDef.matrix[0].length) / 2),
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
          if (gridX < 0 || gridX >= GRID_COLS || gridY >= GRID_ROWS) {
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
    if (this.gameOver || this.paused || !this.currentPiece) return false;

    const piece = this.currentPiece;
    if (piece.type === 'O') return false; // O piece doesn't rotate

    const rotatedMatrix = this.rotateMatrix(piece.matrix, dir);
    const oldRotation = piece.rotation;
    const newRotation = (oldRotation + dir + 4) % 4;

    // SRS Wall kick test + Extended Floor Kick offsets so rotation works all the way down to the last grid!
    const kickIndex = dir > 0 ? oldRotation : newRotation;
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
      const testX = piece.x + (dir > 0 ? dx : -dx);
      const testY = piece.y + (dir > 0 ? -dy : dy);

      if (!this.checkCollision(testX, testY, rotatedMatrix)) {
        piece.matrix = rotatedMatrix;
        piece.x = testX;
        piece.y = testY;
        piece.rotation = newRotation;
        return true;
      }
    }
    return false;
  }

  softDrop() {
    if (this.gameOver || this.paused || !this.currentPiece) return false;
    if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.matrix)) {
      this.currentPiece.y++;
      this.score += 1;
      return true;
    }
    this.lockPiece();
    return false;
  }

  hardDrop() {
    if (this.gameOver || this.paused || !this.currentPiece) return 0;
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
    if (this.gameOver || this.paused || !this.canHold || !this.currentPiece) return false;

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
    const piece = this.currentPiece;
    for (let r = 0; r < piece.matrix.length; r++) {
      for (let c = 0; c < piece.matrix[r].length; c++) {
        if (piece.matrix[r][c]) {
          const gridX = piece.x + c;
          const gridY = piece.y + r;
          if (gridY >= 0 && gridY < GRID_ROWS && gridX >= 0 && gridX < GRID_COLS) {
            this.grid[gridY][gridX] = {
              flavor: piece.flavor,
              type: piece.type
            };
          }
        }
      }
    }
  }

  // Clear full horizontal lines (Only break the completed row(s))
  clearLines() {
    const clearedIndices = [];
    const clearedDetails = [];

    for (let r = GRID_ROWS - 1; r >= 0; r--) {
      const isFull = this.grid[r].every(cell => cell !== null);
      if (isFull) {
        clearedIndices.push(r);
        const firstFlavorId = this.grid[r][0].flavor ? this.grid[r][0].flavor.id : null;
        const isMono = this.grid[r].every(cell => cell.flavor && cell.flavor.id === firstFlavorId);
        clearedDetails.push({
          lineIndex: r,
          isMono: isMono,
          flavor: this.grid[r][0].flavor
        });
      }
    }

    if (clearedIndices.length > 0) {
      const blastedCells = [];

      // Collect all blocks in the filled rows only
      clearedIndices.forEach(r => {
        for (let c = 0; c < GRID_COLS; c++) {
          if (this.grid[r][c]) {
            blastedCells.push({ r, c, flavor: this.grid[r][c].flavor, isDirectLine: true });
          }
        }
      });

      // Remove cleared full lines (shifting remaining down)
      clearedIndices.sort((a, b) => a - b).forEach(index => {
        this.grid.splice(index, 1);
        this.grid.unshift(new Array(GRID_COLS).fill(null));
      });

      const count = clearedIndices.length;
      this.lines += count;

      const monoDetails = clearedDetails.filter(d => d.isMono);
      const monoCount = monoDetails.length;

      // Base Tetris scoring rules
      const baseScores = [0, 100, 300, 500, 800];
      const basePoints = (baseScores[count] || 0) * this.level;

      // Mono-Flavor Multiplier (3x bonus multiplier for mono-flavor clears, escalating for multi-mono)
      let earnedScore = basePoints;
      if (monoCount > 0) {
        const bonusMultiplier = 2.5 + (monoCount - 1) * 0.5;
        earnedScore = Math.floor(basePoints * bonusMultiplier);
      }

      this.score += earnedScore;

      // Update Batch Level every 10 lines
      const newLevel = Math.floor(this.lines / 10) + 1;
      const leveledUp = newLevel > this.level;
      this.level = newLevel;

      return {
        count: count,
        lines: clearedIndices,
        blastedCells: blastedCells,
        extraBlastCount: 0,
        clearedDetails: clearedDetails,
        monoCount: monoCount,
        monoFlavor: monoCount > 0 ? monoDetails[0].flavor : null,
        earnedScore: earnedScore,
        leveledUp: leveledUp
      };
    }

    return { count: 0, lines: [], blastedCells: [], extraBlastCount: 0, clearedDetails: [], monoCount: 0, monoFlavor: null, earnedScore: 0, leveledUp: false };
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
    // Arcade smooth initial gravity (low initial gravity ~750ms per tick)
    const baseSpeed = Math.max(120, 750 - (this.level - 1) * 55);
    if (this.isSpeedBoosted) {
      return 95; // Accelerated speed-boost gravity tick (ms)
    }
    return baseSpeed;
  }
}
