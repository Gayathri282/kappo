/* ==========================================================================
   MOBILE DIRECT SCREEN TOUCH ENGINE
   Full touch sensitivity for small/medium devices:
   - Tap Left/Right area of screen: Move piece Left/Right
   - Tap Upper Center: Rotate Piece Clockwise
   - Drag Finger Left/Right: Smooth continuous column shift
   - Swipe Down: Soft Drop | Fast Flick Down: Hard Drop
   - Swipe Up / Tap Hold Box: Hold Piece
   ========================================================================== */

export class TouchController {
  constructor(handlers, particleSystem) {
    this.handlers = handlers;
    this.particles = particleSystem;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.lastColumnStep = 0;
    this.touchStartTime = 0;

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

  // Full Screen Direct Touch Allocation & Gestures
  initDirectTouchAllocation() {
    const container = document.getElementById('playfield-container');
    const mobileHoldBox = document.getElementById('hold-canvas-mobile');
    if (!container) return;

    // Tap Mobile Hold Box
    if (mobileHoldBox) {
      mobileHoldBox.parentElement.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault();
        this.vibrate(12);
        this.handlers.onHold();
      }, { passive: false });
    }

    // Touch Start on Playfield
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

    // Drag Finger across screen
    container.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        if (e.cancelable) e.preventDefault();
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;

        const deltaXFromLast = currentX - this.lastColumnStep;
        const stepThreshold = 26; // pixels per column move

        // Horizontal Dragting
        if (Math.abs(deltaXFromLast) >= stepThreshold) {
          this.vibrate(6);
          if (deltaXFromLast > 0) {
            this.handlers.onRight();
          } else {
            this.handlers.onLeft();
          }
          this.lastColumnStep = currentX;
        }

        // Dragging Downward for Soft Drop
        const deltaY = currentY - this.touchStartY;
        if (deltaY > 45 && Math.abs(deltaY) > Math.abs(currentX - this.touchStartX)) {
          this.handlers.onSoftDrop();
        }
      }
    }, { passive: false });

    // Touch End (Taps & Swipes)
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

        const canvasRelativeX = endX - rect.left;
        const canvasRelativeY = endY - rect.top;

        // 1. DIRECT TAP ALLOCATION (< 15px movement within 240ms)
        if (absX < 15 && absY < 15 && duration < 240) {
          const normX = canvasRelativeX / rect.width;
          const normY = canvasRelativeY / rect.height;

          // Trigger visual touch ripple feedback
          if (this.particles) {
            this.particles.spawnTouchRipple(canvasRelativeX, canvasRelativeY);
          }

          this.vibrate(10);

          // Top 35% area -> Rotate Clockwise
          if (normY < 0.35) {
            this.handlers.onRotateCW();
          }
          // Left 45% of screen -> Move Left
          else if (normX < 0.45) {
            this.handlers.onLeft();
          }
          // Right 45% of screen -> Move Right
          else if (normX > 0.55) {
            this.handlers.onRight();
          }
          // Center 10% -> Rotate Clockwise
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
        // Fast Downward Flick (< 200ms & > 45px) -> Hard Drop
        else if (deltaY > 45 && absY > absX && duration < 220) {
          this.vibrate(22);
          this.handlers.onHardDrop();
        }
      }
    }, { passive: false });
  }
}
