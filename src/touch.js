/* ==========================================================================
   MOBILE DIRECT TOUCH ALLOCATION & GESTURE ENGINE
   Allows playing directly on the screen via intuitive touch zones:
   - Tap Left/Right side of screen: Move piece Left/Right
   - Tap Upper Center: Rotate Piece Clockwise
   - Drag Finger Left/Right: Dynamic continuous column movement
   - Swipe Down: Soft Drop | Fast Flick Down: Hard Drop
   - Swipe Up / Tap Hold Box: Hold Piece
   ========================================================================== */

export class TouchController {
  constructor(handlers) {
    this.handlers = handlers;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.lastColumnStep = 0;
    this.touchStartTime = 0;
    this.initButtons();
    this.initDirectTouchAllocation();
  }

  vibrate(duration = 12) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch (e) {
        // Ignored if restricted
      }
    }
  }

  initButtons() {
    const bindBtn = (id, actionFn) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      const triggerAction = (e) => {
        if (e.cancelable) e.preventDefault();
        this.vibrate(10);
        actionFn();
      };

      btn.addEventListener('touchstart', triggerAction, { passive: false });
      btn.addEventListener('click', (e) => {
        if (e.pointerType === 'touch') return;
        actionFn();
      });
    };

    bindBtn('touch-left', () => this.handlers.onLeft());
    bindBtn('touch-right', () => this.handlers.onRight());
    bindBtn('touch-rot-cw', () => this.handlers.onRotateCW());
    bindBtn('touch-rot-ccw', () => this.handlers.onRotateCCW());
    bindBtn('touch-down', () => this.handlers.onSoftDrop());
    bindBtn('touch-drop', () => this.handlers.onHardDrop());
    bindBtn('touch-hold', () => this.handlers.onHold());
  }

  // Direct Touch Allocation on Screen & Playfield Canvas
  initDirectTouchAllocation() {
    const container = document.getElementById('playfield-container');
    const mobileHoldBox = document.getElementById('hold-canvas-mobile');
    if (!container) return;

    if (mobileHoldBox) {
      mobileHoldBox.parentElement.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.vibrate(12);
        this.handlers.onHold();
      }, { passive: false });
    }

    container.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.lastColumnStep = touch.clientX;
        this.touchStartTime = Date.now();
      }
    }, { passive: false });

    // Drag finger left/right for continuous column shifting
    container.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        if (e.cancelable) e.preventDefault();
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;

        const deltaXFromLast = currentX - this.lastColumnStep;
        const stepThreshold = 28; // pixels per column shift

        if (Math.abs(deltaXFromLast) >= stepThreshold) {
          this.vibrate(6);
          if (deltaXFromLast > 0) {
            this.handlers.onRight();
          } else {
            this.handlers.onLeft();
          }
          this.lastColumnStep = currentX;
        }

        // Continuous drag down for soft drop
        const deltaY = currentY - this.touchStartY;
        if (deltaY > 50 && Math.abs(deltaY) > Math.abs(currentX - this.touchStartX)) {
          this.handlers.onSoftDrop();
        }
      }
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
      if (e.changedTouches.length > 0) {
        if (e.cancelable) e.preventDefault();
        const touch = e.changedTouches[0];
        const rect = container.getBoundingClientRect();

        const endX = touch.clientX;
        const endY = touch.clientY;

        const deltaX = endX - this.touchStartX;
        const deltaY = endY - this.touchStartY;
        const duration = Date.now() - this.touchStartTime;

        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // 1. TAP DETECTION (< 15px movement within 250ms)
        if (absX < 15 && absY < 15 && duration < 250) {
          const relativeX = (endX - rect.left) / rect.width;
          const relativeY = (endY - rect.top) / rect.height;

          this.vibrate(10);

          // Top 30% center zone -> Rotate CW
          if (relativeY < 0.35 && relativeX > 0.25 && relativeX < 0.75) {
            this.handlers.onRotateCW();
          }
          // Left Zone -> Move Left
          else if (relativeX < 0.45) {
            this.handlers.onLeft();
          }
          // Right Zone -> Move Right
          else if (relativeX > 0.55) {
            this.handlers.onRight();
          }
          // Center Zone -> Rotate CW
          else {
            this.handlers.onRotateCW();
          }
          return;
        }

        // 2. SWIPE GESTURES
        // Swipe Up -> Hold Piece
        if (deltaY < -40 && absY > absX) {
          this.vibrate(12);
          this.handlers.onHold();
        }
        // Fast Down Flick (< 180ms & > 45px) -> Hard Drop
        else if (deltaY > 45 && absY > absX && duration < 220) {
          this.vibrate(20);
          this.handlers.onHardDrop();
        }
      }
    }, { passive: false });
  }
}
