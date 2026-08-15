/* ==========================================================================
   MOBILE DIRECT SCREEN TOUCH & CONTROLS ENGINE
   - Direct click/tap inside playgrid: Rotate Piece (working until second to last row)
   - Left / Right Swiping & Tapping outside grid: Move Left / Right
   - Swipe Up: Hold Piece
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

  // Attach Touch Controls Deck & Header Action Buttons
  initTouchControlDeck() {
    const btnLeft = document.getElementById('btn-touch-left');
    const btnRight = document.getElementById('btn-touch-right');
    const btnTurbo = document.getElementById('btn-touch-turbo') || document.getElementById('btn-touch-soft-drop');
    const btnBoostHeader = document.getElementById('btn-boost-header');
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
        if (e.detail !== 0) triggerAction(e);
      });
    };

    bindButton(btnLeft, () => this.handlers.onLeft());
    bindButton(btnRight, () => this.handlers.onRight());
    bindButton(btnRotate, () => this.handlers.onRotateCW());

    const bindBoost = (btn) => {
      if (!btn) return;
      const setBoost = (active, e) => {
        if (e && e.cancelable) e.preventDefault();
        if (this.handlers.onSpeedBoost) this.handlers.onSpeedBoost(active);
        if (active) btn.classList.add('active');
        else btn.classList.remove('active');
      };

      btn.addEventListener('mousedown', (e) => setBoost(true, e));
      btn.addEventListener('mouseup', () => setBoost(false));
      btn.addEventListener('mouseleave', () => setBoost(false));
      btn.addEventListener('touchstart', (e) => setBoost(true, e), { passive: false });
      btn.addEventListener('touchend', () => setBoost(false));
      btn.addEventListener('touchcancel', () => setBoost(false));
    };

    bindBoost(btnTurbo);
    bindBoost(btnBoostHeader);
  }

  // Full Screen Direct Touch Allocation & Gestures
  initDirectTouchAllocation() {
    const mobileHoldBox = document.getElementById('hold-canvas-mobile');
    const playfieldContainer = document.getElementById('playfield-container');

    // Tap Mobile Hold Box
    if (mobileHoldBox) {
      mobileHoldBox.parentElement.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault();
        this.vibrate(12);
        this.handlers.onHold();
      }, { passive: false });
    }

    const isInteractiveElement = (target) => {
      if (!target) return false;
      return target.closest('button, a, .touch-controls-deck, .modal-backdrop, .header-actions, .pause-pill-btn, #start-overlay, #game-over-modal, #pause-modal');
    };

    // Single click/tap inside Playgrid Container -> Rotate Piece CW!
    if (playfieldContainer) {
      playfieldContainer.addEventListener('click', (e) => {
        if (isInteractiveElement(e.target)) return;
        this.vibrate(10);
        this.handlers.onRotateCW();
      });
    }

    // Touch Start anywhere on screen
    document.addEventListener('touchstart', (e) => {
      if (isInteractiveElement(e.target)) return;
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.lastColumnStep = touch.clientX;
        this.touchStartTime = Date.now();
      }
    }, { passive: true });

    // Touch Dragging Finger across Left / Right Zones
    document.addEventListener('touchmove', (e) => {
      if (isInteractiveElement(e.target)) return;
      if (e.touches.length > 0) {
        const currentX = e.touches[0].clientX;
        const deltaXFromLast = currentX - this.lastColumnStep;
        const stepThreshold = 20; // pixels per column step

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
    }, { passive: true });

    // Touch End (Screen Taps & Swipes)
    document.addEventListener('touchend', (e) => {
      if (isInteractiveElement(e.target)) return;
      if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];

        const endX = touch.clientX;
        const endY = touch.clientY;

        const deltaX = endX - this.touchStartX;
        const deltaY = endY - this.touchStartY;
        const duration = Date.now() - this.touchStartTime;

        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // 1. Swipe Up -> Hold Piece (📦)
        if (deltaY < -40 && absY > absX) {
          this.vibrate(12);
          this.handlers.onHold();
          return;
        }

        // 2. DIRECT TAP ZONES (< 18px movement within 240ms)
        if (absX < 18 && absY < 18 && duration < 240) {
          const target = e.target;

          // If tap inside grid or canvas -> Rotate Piece CW!
          if (playfieldContainer && (playfieldContainer.contains(target) || target.tagName === 'CANVAS')) {
            this.vibrate(10);
            this.handlers.onRotateCW();
            return;
          }

          // If tap outside grid -> Left 50% moves left, Right 50% moves right
          const screenW = window.innerWidth;
          const normX = endX / screenW;

          this.vibrate(10);

          if (normX < 0.50) {
            this.handlers.onLeft();
          } else {
            this.handlers.onRight();
          }
        }
      }
    }, { passive: true });
  }
}
