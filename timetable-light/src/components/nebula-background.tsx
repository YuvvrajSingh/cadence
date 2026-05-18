"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "./theme-provider";

export function NebulaBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setResolvedTheme(isDark ? "dark" : "light");
    } else {
      setResolvedTheme(theme as "light" | "dark");
    }
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    const ripples: Ripple[] = [];
    const particleCount = 800;
    
    const mouse = { x: -1000, y: -1000 };

    class Ripple {
      x: number;
      y: number;
      radius: number;
      maxRadius: number;
      speed: number;
      life: number;
      active: boolean;

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = 300;
        this.speed = 4;
        this.life = 1;
        this.active = true;
      }

      update() {
        this.radius += this.speed;
        this.life -= 0.01;
        if (this.radius > this.maxRadius || this.life <= 0) {
          this.active = false;
        }
      }
    }
    
    class Particle {
      originX: number;
      originY: number;
      x: number;
      y: number;
      size: number;
      vx: number;
      vy: number;
      friction: number;
      ease: number;
      accentColor: string | null;

      constructor(w: number, h: number) {
        this.originX = Math.random() * w;
        this.originY = Math.random() * h;
        this.x = this.originX;
        this.y = this.originY;
        this.size = Math.random() * 1.2 + 0.6;
        
        const accents = ["#FF5722", "#E91E63", "#9C27B0", "#2196F3", "#4CAF50"];
        this.accentColor = Math.random() > 0.85 ? accents[Math.floor(Math.random() * accents.length)] : null;
        
        this.vx = 0;
        this.vy = 0;
        this.friction = 0.92; 
        this.ease = 0.005; 
      }

      update(time: number) {
        const waveX = Math.sin(time * 0.15 + this.originX * 0.005) * 8;
        const waveY = Math.cos(time * 0.15 + this.originY * 0.005) * 8;
        
        const targetX = this.originX + waveX;
        const targetY = this.originY + waveY;

        // Smoke distortion (passive)
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 120) { 
          const force = (120 - distance) / 120;
          this.vx -= dx * force * 0.005;
          this.vy -= dy * force * 0.005;
        }

        // Ripple interaction
        ripples.forEach(ripple => {
          const rdx = ripple.x - this.x;
          const rdy = ripple.y - this.y;
          const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
          
          // If particle is on the ripple edge
          const diff = Math.abs(rdist - ripple.radius);
          if (diff < 20) {
            const rforce = (20 - diff) / 20 * ripple.life;
            this.vx -= rdx / rdist * rforce * 15;
            this.vy -= rdy / rdist * rforce * 15;
          }
        });

        this.vx += (targetX - this.x) * this.ease;
        this.vy += (targetY - this.y) * this.ease;

        this.x += this.vx;
        this.y += this.vy;
        this.vx *= this.friction;
        this.vy *= this.friction;
      }

      draw(isDark: boolean) {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        
        if (this.accentColor) {
          ctx.fillStyle = this.accentColor;
          ctx.globalAlpha = isDark ? 0.4 : 0.5;
        } else {
          ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
          ctx.globalAlpha = isDark ? 0.15 : 0.1;
        }
        
        ctx.fill();
      }
    }

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(canvas.width, canvas.height));
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const time = Date.now() * 0.001;

      // Update ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].update();
        if (!ripples[i].active) ripples.splice(i, 1);
      }

      particles.forEach((p) => {
        p.update(time);
        p.draw(resolvedTheme === "dark");
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleClick = (e: MouseEvent) => {
      ripples.push(new Ripple(e.clientX, e.clientY));
    };

    const handleResize = () => {
      init();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleClick);
    init();
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, [resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
    />
  );
}
