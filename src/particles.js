/* ==========================================================================
   CANVAS PARTICLE SYSTEM - CHIP FLAKES & COMBO FX
   Renders animated chip flakes, golden sparks, floating combo text, & screen shake
   ========================================================================== */

export class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.floatingTexts = [];
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  // Spawn chip flake particle explosion on line clear
  spawnLineClearFX(lines, cellHeight, cellWidth, flavorColors) {
    lines.forEach((lineIndex) => {
      const y = (lineIndex + 0.5) * cellHeight;

      // Spawn 25 particles per cleared line
      for (let i = 0; i < 25; i++) {
        const x = (Math.random() * 0.9 + 0.05) * this.canvas.width;
        const color = flavorColors[Math.floor(Math.random() * flavorColors.length)];

        this.particles.push({
          x: x,
          y: y + (Math.random() * 10 - 5),
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.7) * 9,
          gravity: 0.25,
          size: Math.random() * 6 + 3,
          color: color,
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.2,
          life: 1.0,
          decay: Math.random() * 0.025 + 0.015,
          shape: Math.random() < 0.6 ? 'chip' : 'spark'
        });
      }
    });
  }

  // Spawn special Full Crunch jackpot burst
  spawnFullCrunchFX() {
    this.shake(12, 18);

    for (let i = 0; i < 80; i++) {
      const x = this.canvas.width / 2;
      const y = this.canvas.height / 2;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 12 + 4;
      const colors = ['#e9c46a', '#f4a261', '#e63946', '#ffffff'];

      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.2,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.3,
        life: 1.0,
        decay: Math.random() * 0.02 + 0.01,
        shape: 'spark'
      });
    }

    this.spawnFloatingText("FULL CRUNCH!", this.canvas.width / 2, this.canvas.height / 2, '#f3c05b', 2.2);
  }

  // Spawn floating combo text
  spawnFloatingText(text, x, y, color = '#f3c05b', scale = 1.0) {
    this.floatingTexts.push({
      text: text,
      x: x,
      y: y,
      vy: -1.5,
      life: 1.0,
      decay: 0.02,
      color: color,
      scale: scale
    });
  }

  // Trigger screen shake
  shake(intensity = 8, frames = 12) {
    this.shakeIntensity = intensity;
    this.shakeTimer = frames;
  }

  getShakeOffset() {
    if (this.shakeTimer > 0) {
      this.shakeTimer--;
      const dx = (Math.random() - 0.5) * this.shakeIntensity;
      const dy = (Math.random() - 0.5) * this.shakeIntensity;
      return { x: dx, y: dy };
    }
    return { x: 0, y: 0 };
  }

  // Spawn visual touch ripple indicator
  spawnTouchRipple(x, y) {
    this.particles.push({
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      gravity: 0,
      size: 8,
      maxSize: 42,
      color: '#e9c46a',
      rotation: 0,
      vRot: 0,
      life: 1.0,
      decay: 0.05,
      shape: 'ripple'
    });
  }

  updateAndDraw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update and draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.vRot;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.life);
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);

      if (p.shape === 'ripple') {
        p.size += (p.maxSize - p.size) * 0.25;
        this.ctx.strokeStyle = p.color;
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        this.ctx.stroke();
      } else if (p.shape === 'chip') {
        // Draw crisp chip fragment shape (triangle/quad)
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.moveTo(-p.size, -p.size / 2);
        this.ctx.lineTo(p.size, -p.size);
        this.ctx.lineTo(p.size / 2, p.size);
        this.ctx.closePath();
        this.ctx.fill();

        // Chip highlight
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      } else {
        // Glowing spark dot
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    // Update and draw floating text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.life -= ft.decay;

      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, ft.life);
      this.ctx.font = `900 ${1.2 * ft.scale}rem 'Outfit', sans-serif`;
      this.ctx.fillStyle = ft.color;
      this.ctx.textAlign = 'center';
      this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
      this.ctx.shadowBlur = 10;
      this.ctx.fillText(ft.text, ft.x, ft.y);
      this.ctx.restore();
    }
  }

  clear() {
    this.particles = [];
    this.floatingTexts = [];
    this.shakeTimer = 0;
  }
}
