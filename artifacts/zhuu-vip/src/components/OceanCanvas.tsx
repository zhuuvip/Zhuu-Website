import { useEffect, useRef } from "react";

interface Bubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  opacity: number;
  wobble: number;
  wobbleSpeed: number;
  wobbleOffset: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
}

export default function OceanCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let frame = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Bubbles
    const bubbles: Bubble[] = Array.from({ length: 40 }, () => ({
      x: Math.random() * window.innerWidth,
      y: window.innerHeight + Math.random() * 200,
      r: Math.random() * 6 + 1,
      speed: Math.random() * 0.8 + 0.3,
      opacity: Math.random() * 0.4 + 0.1,
      wobble: 0,
      wobbleSpeed: Math.random() * 0.03 + 0.01,
      wobbleOffset: Math.random() * Math.PI * 2,
    }));

    // Particles (sea dust)
    const particles: Particle[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.1,
      color: Math.random() > 0.5 ? "#00d4ff" : "#9b59b6",
    }));

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Deep ocean gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "rgba(8, 12, 28, 0.95)");
      gradient.addColorStop(0.5, "rgba(5, 15, 35, 0.95)");
      gradient.addColorStop(1, "rgba(2, 8, 20, 0.95)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Light rays from top
      const numRays = 6;
      for (let i = 0; i < numRays; i++) {
        const rayX = (canvas.width / (numRays + 1)) * (i + 1) + Math.sin(frame * 0.005 + i) * 30;
        const rayAlpha = 0.02 + Math.sin(frame * 0.008 + i * 1.2) * 0.01;
        const rayGrad = ctx.createLinearGradient(rayX, 0, rayX + 80, canvas.height * 0.7);
        rayGrad.addColorStop(0, `rgba(0, 212, 255, ${rayAlpha})`);
        rayGrad.addColorStop(1, "rgba(0, 212, 255, 0)");
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(rayX - 20, 0);
        ctx.lineTo(rayX + 80, 0);
        ctx.lineTo(rayX + 40, canvas.height * 0.7);
        ctx.lineTo(rayX - 60, canvas.height * 0.7);
        ctx.closePath();
        ctx.fillStyle = rayGrad;
        ctx.fill();
        ctx.restore();
      }

      // Bubbles
      bubbles.forEach((b) => {
        b.y -= b.speed;
        b.wobble += b.wobbleSpeed;
        const wx = b.x + Math.sin(b.wobble + b.wobbleOffset) * 15;

        if (b.y < -20) {
          b.y = canvas.height + 20;
          b.x = Math.random() * canvas.width;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(wx, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 212, 255, ${b.opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Highlight
        ctx.beginPath();
        ctx.arc(wx - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity * 0.5})`;
        ctx.fill();
        ctx.restore();
      });

      // Particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity * (0.5 + 0.5 * Math.sin(frame * 0.02 + p.x));
        ctx.fill();
        ctx.restore();
      });

      // Subtle horizontal wave lines
      for (let w = 0; w < 3; w++) {
        ctx.save();
        ctx.beginPath();
        const waveY = canvas.height * (0.3 + w * 0.2);
        ctx.moveTo(0, waveY);
        for (let x = 0; x <= canvas.width; x += 20) {
          ctx.lineTo(
            x,
            waveY + Math.sin((x * 0.01) + frame * 0.02 + w * 2) * 8
          );
        }
        ctx.strokeStyle = `rgba(0, 212, 255, 0.04)`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ display: "block" }}
      data-testid="ocean-canvas"
    />
  );
}
