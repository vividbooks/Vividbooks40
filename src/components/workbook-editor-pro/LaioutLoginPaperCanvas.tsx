import { useEffect, useRef } from 'react';

const BG = '#06051A';
const A4_RATIO = 1.4142;

/**
 * Plátno s létajícími „listy A4“, mřížkou a částicemi — pozadí přihlášení Laiout.
 */
export function LaioutLoginPaperCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let raf = 0;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    class Sheet {
      big: boolean;
      w!: number;
      h!: number;
      x!: number;
      y!: number;
      vx!: number;
      vy!: number;
      angle!: number;
      vangle!: number;
      phase!: number;
      freq!: number;
      alpha!: number;
      tint!: 'blue' | 'white';
      colorIndex!: number;

      constructor() {
        this.big = false;
        this.init(true);
      }

      init(randomY = false) {
        this.big = Math.random() > 0.45;
        if (this.big) {
          this.w = 180 + Math.random() * 120;
        } else {
          this.w = 80 + Math.random() * 70;
        }
        this.h = this.w * A4_RATIO;
        this.x = Math.random() * W;
        this.y = randomY ? Math.random() * (H + this.h) - this.h : H + this.h + 20;
        this.vx = (Math.random() - 0.5) * 0.25;
        this.vy = -(0.25 + Math.random() * 0.45);
        this.angle = (Math.random() - 0.5) * 0.45;
        this.vangle = (Math.random() - 0.5) * 0.0015;
        this.phase = Math.random() * Math.PI * 2;
        this.freq = 0.0004 + Math.random() * 0.0008;
        this.alpha = this.big ? 1.0 : 0.12 + Math.random() * 0.18;
        this.tint = Math.random() > 0.75 ? 'blue' : 'white';
        this.colorIndex = Math.random();
      }

      update(t: number) {
        this.x += this.vx + Math.sin(t * this.freq + this.phase) * 0.2;
        this.y += this.vy;
        this.angle += this.vangle;
        if (this.y < -this.h - 60) this.init(false);
      }

      draw(c: CanvasRenderingContext2D) {
        const w = this.w;
        const h = this.h;
        c.save();
        c.translate(this.x, this.y);
        c.rotate(this.angle);
        c.globalAlpha = this.alpha;

        if (this.big) {
          const sheetColors = [
            'rgba(248,247,244,1)',
            'rgba(225,230,248,1)',
            'rgba(180,195,240,1)',
            'rgba(100,130,220,1)',
            'rgba(30,50,160,1)',
            'rgba(10,9,60,1)',
          ];
          c.save();
          c.globalAlpha = 0.12;
          c.fillStyle = 'rgba(0,0,0,0.5)';
          c.beginPath();
          c.roundRect(-w / 2 + 3, -h / 2 + 5, w, h, 2);
          c.fill();
          c.restore();

          c.fillStyle = sheetColors[Math.floor(this.colorIndex * sheetColors.length)];
          c.strokeStyle = 'rgba(255,255,255,0.08)';
          c.lineWidth = 0.5;
          c.beginPath();
          c.roundRect(-w / 2, -h / 2, w, h, 2);
          c.fill();
          c.stroke();
        } else {
          c.strokeStyle =
            this.tint === 'blue' ? 'rgba(52, 102, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)';
          c.fillStyle =
            this.tint === 'blue' ? 'rgba(52, 102, 255, 0.04)' : 'rgba(255,255,255,0.03)';
          c.lineWidth = 0.5;
          c.beginPath();
          c.roundRect(-w / 2, -h / 2, w, h, 2);
          c.fill();
          c.stroke();

          c.strokeStyle =
            this.tint === 'blue' ? 'rgba(52,102,255,0.3)' : 'rgba(255,255,255,0.15)';
          const lpad = w * 0.15;
          const lw = w - lpad * 2;
          const lh = h - lpad * 2;
          for (let i = 1; i <= 4; i++) {
            const ly = -h / 2 + lpad + i * (lh / 5);
            const ll = lw * (0.4 + Math.random() * 0.5);
            c.beginPath();
            c.moveTo(-w / 2 + lpad, ly);
            c.lineTo(-w / 2 + lpad + ll, ly);
            c.stroke();
          }
        }

        c.restore();
      }
    }

    class Particle {
      x!: number;
      y!: number;
      vy!: number;
      vx!: number;
      r!: number;
      alpha!: number;
      color!: string;
      phase!: number;

      constructor() {
        this.reset(true);
      }

      reset(init = false) {
        this.x = Math.random() * W;
        this.y = init ? Math.random() * H : H + 5;
        this.vy = -(0.1 + Math.random() * 0.25);
        this.vx = (Math.random() - 0.5) * 0.08;
        this.r = 0.8 + Math.random() * 1.2;
        this.alpha = 0.08 + Math.random() * 0.2;
        this.color = Math.random() > 0.5 ? '#3466FF' : '#ffffff';
        this.phase = Math.random() * Math.PI * 2;
      }

      update(t: number) {
        this.x += this.vx + Math.sin(t * 0.0008 + this.phase) * 0.06;
        this.y += this.vy;
        if (this.y < -10) this.reset();
      }

      draw(c: CanvasRenderingContext2D) {
        c.save();
        c.globalAlpha = this.alpha;
        c.fillStyle = this.color;
        c.beginPath();
        c.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }

    function drawGrid(t: number) {
      const g = 64;
      const shift = (t * 0.015) % g;
      ctx.save();
      ctx.strokeStyle = 'rgba(52,102,255,0.04)';
      ctx.lineWidth = 0.5;
      for (let x = -shift; x < W + g; x += g) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = -shift; y < H + g; y += g) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawVignette() {
      const grad = ctx.createRadialGradient(
        W / 2,
        H / 2,
        H * 0.15,
        W / 2,
        H / 2,
        H * 0.85,
      );
      grad.addColorStop(0, 'rgba(6,5,26,0)');
      grad.addColorStop(1, 'rgba(6,5,26,0.65)');
      ctx.save();
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    const sheets = Array.from({ length: 26 }, () => new Sheet());
    const particles = Array.from({ length: 50 }, () => new Particle());
    sheets.sort((a, b) => (a.big ? 1 : -1) - (b.big ? 1 : -1));

    let t = 0;
    function draw() {
      t++;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      drawGrid(t);
      particles.forEach((p) => {
        p.update(t);
        p.draw(ctx);
      });
      sheets.forEach((s) => {
        s.update(t);
        s.draw(ctx);
      });
      drawVignette();
      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      aria-hidden
    />
  );
}
