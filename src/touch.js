/* ==========================================================================
   MOBILE DIRECT SCREEN TOUCH & CONTROLS ENGINE
   - Left 50% outer side of screen: Tap or Drag Left
   - Right 50% outer side of screen: Tap or Drag Right
   - Top 25% upper zone: Tap to Rotate Piece (↻)
   - Swipe Up / Tap Hold: Hold Piece (📦)
   - Dedicated ⚡ SPEED BOOST button for accelerated fall gravity
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
    this.initTouchControlDeck();
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

  // Attach Touch Controls Deck Action Buttons (LAY STACKS Style UI)
  initTouchControlDeck() {
    const btnLeft = document.getElementById('btn-touch-left');
    const btnRight = document.getElementById('btn-touch-right');
    const btnSoftDrop = document.getElementById('btn-touch-soft-drop');
    const btnRotate = document.getElementById('btn-touch-rotate');

    const bindButton = (btn, action) => {
      if (!btn) return;

      const triggerAction = (e) => {
        if (e && e.cancelable) e.preventDefault();
        this.vibrate(10);
        action();
      };

      btn.addEventListener('touchstart', triggerAction, { passive: false });
      btn.addEventListener('click', (e) => {
        // Prevent duplicate trigger if touchstart fired
        if (e.detail !== 0) triggerAction(e);
      });
    };

    bindButton(btnLeft, () => this.handlers.onLeft());
    bindButton(btnRight, () => this.handlers.onRight());
    bindButton(btnSoftDrop, () => this.handlers.onSoftDrop ? this.handlers.onSoftDrop() : null);
    bindButton(btnRotate, () => this.handlers.onRotateCW());
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

    // Touch Start on Playfield Container
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

    // Touch Dragging Finger across Left / Right Zones
    container.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        if (e.cancelable) e.preventDefault();
        const currentX = e.touches[0].clientX;
        const deltaXFromLast = currentX - this.lastColumnStep;
        const stepThreshold = 22; // pixels per column step

        if (Math.abs(deltaXFromLast) >= stepThreshold) {
          this.vibrate(6);
          if (deltaXFromLast > 0) {
            this.handlers.onRight();
          } else {
            this.handlers.onLeft();
          }
          this.lastColumnStep = currentX;
        }
      }
    }, { passive: false });

    // Touch End (Left Zone / Right Zone Taps & Swipe Up for Hold)
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

        // 1. Swipe Up -> Hold Piece (📦)
        if (deltaY < -40 && absY > absX) {
          this.vibrate(12);
          this.handlers.onHold();
          return;
        }

        // 2. DIRECT TOUCH ZONES (< 18px movement within 240ms)
        if (absX < 18 && absY < 18 && duration < 240) {
          const normX = canvasRelativeX / rect.width;
          const normY = canvasRelativeY / rect.height;

          // Visual touch ripple feedback
          if (this.particles) {
            this.particles.spawnTouchRipple(canvasRelativeX, canvasRelativeY);
          }

          this.vibrate(10);

          const pieceY = this.handlers.getPieceY ? this.handlers.getPieceY() : 0;
          const allowTouchRotate = pieceY < 4; // Only allow canvas touch rotation on upper rows (row < 4)

          // Top 25% zone -> Rotate Piece Clockwise (Only when above row 4)
          if (normY < 0.25 && allowTouchRotate) {
            this.handlers.onRotateCW();
          }
          // Left 50% zone -> Move Left
          else if (normX < 0.50) {
            this.handlers.onLeft();
          }
          // Right 50% zone -> Move Right
          else {
            this.handlers.onRight();
          }
        }
      }
    }, { passive: false });
  }
}
