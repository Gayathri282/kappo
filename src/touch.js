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
  // 3-Zone Play Grid Direct Touch Allocation, Touch-and-Hold Soft Drop & Swipe Gestures
  initDirectTouchAllocation() {
    const mobileHoldBox = document.getElementById('hold-canvas-mobile');
    const playfieldContainer = document.getElementById('playfield-container');

    // Tap Mobile Hold Box
    if (mobileHoldBox && mobileHoldBox.parentElement) {
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

    let holdTimer = null;
    let isHoldingSpeedBoost = false;
    const JITTER_THRESHOLD = 14; // pixels movement tolerance
    const HOLD_THRESHOLD_MS = 180; // 180ms touch-and-hold threshold

    const stopHoldSpeedBoost = () => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      if (isHoldingSpeedBoost) {
        isHoldingSpeedBoost = false;
        if (this.handlers.onSpeedBoost) {
          this.handlers.onSpeedBoost(false);
        }
      }
    };

    const getZoneFromX = (clientX) => {
      if (!playfieldContainer) return 1;
      const rect = playfieldContainer.getBoundingClientRect();
      const relX = clientX - rect.left;
      const zoneWidth = rect.width / 3;
      if (relX < zoneWidth) return 0; // Left zone
      if (relX < zoneWidth * 2) return 1; // Center zone
      return 2; // Right zone
    };

    // ── Mouse / Desktop Click & Press inside Playfield Container ──
    if (playfieldContainer) {
      playfieldContainer.addEventListener('mousedown', (e) => {
        if (isInteractiveElement(e.target)) return;
        const zone = getZoneFromX(e.clientX);
        this.touchStartX = e.clientX;
        this.touchStartY = e.clientY;
        this.touchStartTime = Date.now();

        holdTimer = setTimeout(() => {
          this.vibrate(10);
          isHoldingSpeedBoost = true;
          if (this.handlers.onSpeedBoost) this.handlers.onSpeedBoost(true);
        }, HOLD_THRESHOLD_MS);
      });

      window.addEventListener('mouseup', () => stopHoldSpeedBoost());
    }

    // ── Touch Start inside Playfield Container / Screen ──
    document.addEventListener('touchstart', (e) => {
      if (isInteractiveElement(e.target)) return;

      if (e.touches.length > 0) {
        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.lastColumnStep = touch.clientX;
        this.touchStartTime = Date.now();

        stopHoldSpeedBoost();

        // Start hold-to-drop timer if touch is inside playfield container
        if (playfieldContainer && playfieldContainer.contains(e.target)) {
          holdTimer = setTimeout(() => {
            this.vibrate(10);
            isHoldingSpeedBoost = true;
            if (this.handlers.onSpeedBoost) this.handlers.onSpeedBoost(true);
          }, HOLD_THRESHOLD_MS);
        }
      }
    }, { passive: true });

    // ── Touch Dragging Finger & Swiping ──
    document.addEventListener('touchmove', (e) => {
      if (isInteractiveElement(e.target)) return;

      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const currentX = touch.clientX;
        const currentY = touch.clientY;

        const totalDist = Math.hypot(currentX - this.touchStartX, currentY - this.touchStartY);

        // Cancel hold timer if finger moves beyond jitter threshold (swipe detected!)
        if (totalDist > JITTER_THRESHOLD) {
          if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }
        }

        const deltaXFromLast = currentX - this.lastColumnStep;
        const stepThreshold = 22; // pixels per horizontal column step

        if (Math.abs(deltaXFromLast) >= stepThreshold) {
          // If finger is swiping horizontally, stop hold speed boost so swipe & hold stay 100% independent
          stopHoldSpeedBoost();

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

    // ── Touch End / Cancel ──
    const handleTouchEnd = (e) => {
      const duration = Date.now() - this.touchStartTime;
      const wasHolding = isHoldingSpeedBoost;

      stopHoldSpeedBoost();

      if (isInteractiveElement(e.target)) return;
      if (e.changedTouches && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - this.touchStartX;
        const deltaY = touch.clientY - this.touchStartY;

        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // 1. Swipe Up -> Hold Piece (📦)
        if (deltaY < -35 && absY > absX) {
          this.vibrate(12);
          this.handlers.onHold();
          return;
        }

        // 2. Tap Gesture (short duration, minimal movement, not a hold-to-drop)
        if (!wasHolding && absX < JITTER_THRESHOLD && absY < JITTER_THRESHOLD && duration < HOLD_THRESHOLD_MS) {
          if (playfieldContainer && playfieldContainer.contains(e.target)) {
            const zone = getZoneFromX(touch.clientX);
            this.vibrate(8);
            if (zone === 0) {
              this.handlers.onLeft();
            } else if (zone === 2) {
              this.handlers.onRight();
            }
          } else {
            // Direct Tap handling outside playfield container (Left 50% / Right 50%)
            const screenW = window.innerWidth;
            const normX = touch.clientX / screenW;
            this.vibrate(8);
            if (normX < 0.50) {
              this.handlers.onLeft();
            } else {
              this.handlers.onRight();
            }
          }
        }
      }
    };

    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true });
  }
}
