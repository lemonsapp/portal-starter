import { useEffect, useRef } from "react";

/**
 * PremiumFX — capa global de efectos visuales:
 *  - Aurora animada (gradient mesh)
 *  - Partículas flotantes (canvas, lemon/orange)
 *  - Glow que sigue al cursor
 *  - Tilt 3D suave en cards al pasar el mouse
 *  - Confetti utility expuesto en window.lemonsConfetti(x, y)
 *
 * Se monta una sola vez en App. Respeta prefers-reduced-motion.
 */
export default function PremiumFX() {
  const canvasRef = useRef(null);
  const glowRef = useRef(null);
  const confettiRef = useRef(null);
  const rafRef = useRef(0);
  const particlesRef = useRef([]);
  const confettiPiecesRef = useRef([]);
  const mouseRef = useRef({ x: -9999, y: -9999, has: false });

  useEffect(() => {
    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const TARGET = Math.min(48, Math.round(window.innerWidth / 28));
    const palette = [
      "rgba(245,224,58,",
      "rgba(255,140,42,",
      "rgba(255,85,0,",
      "rgba(255,249,176,",
    ];
    const rand = (a, b) => a + Math.random() * (b - a);
    const make = () => ({
      x: rand(0, window.innerWidth),
      y: rand(0, window.innerHeight),
      r: rand(0.6, 2.2),
      vx: rand(-0.18, 0.18),
      vy: rand(-0.22, -0.05),
      a: rand(0.18, 0.55),
      hue: palette[Math.floor(Math.random() * palette.length)],
      twk: rand(0, Math.PI * 2),
      tws: rand(0.008, 0.025),
    });
    particlesRef.current = Array.from({ length: TARGET }, make);

    const onMove = (e) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.has = true;
      const g = glowRef.current;
      if (g) {
        g.style.transform = `translate3d(${e.clientX - 240}px, ${e.clientY - 240}px, 0)`;
        g.style.opacity = "1";
      }
    };
    const onLeave = () => {
      mouseRef.current.has = false;
      if (glowRef.current) glowRef.current.style.opacity = "0";
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", resize);

    const tick = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      const m = mouseRef.current;
      const ps = particlesRef.current;

      // Conexiones sutiles entre partículas cercanas
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i];
        for (let j = i + 1; j < ps.length; j++) {
          const b = ps[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 14000) {
            const o = (1 - d2 / 14000) * 0.08;
            ctx.strokeStyle = `rgba(245,224,58,${o.toFixed(3)})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.twk += p.tws;
        const tw = 0.6 + Math.sin(p.twk) * 0.4;

        // Repulsión suave del cursor
        if (m.has) {
          const dx = p.x - m.x;
          const dy = p.y - m.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 14400 && d2 > 1) {
            const f = (1 - d2 / 14400) * 0.35;
            const inv = 1 / Math.sqrt(d2);
            p.vx += dx * inv * f * 0.05;
            p.vy += dy * inv * f * 0.05;
          }
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.985;
        p.vy *= 0.985;

        if (p.y < -10) { p.y = h + 10; p.x = rand(0, w); }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y > h + 10) p.y = -10;

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        grad.addColorStop(0, p.hue + (p.a * tw).toFixed(3) + ")");
        grad.addColorStop(1, p.hue + "0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = p.hue + (p.a * tw + 0.15).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // ── Tilt 3D + Spotlight interno en cards (.box, .cardStat, .igStatCard) ──
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) return;
    if (window.innerWidth <= 768) return;

    const SELECTOR = ".box, .cardStat, .igStatCard";

    const onEnter = (e) => {
      if (!(e.target instanceof Element)) return;
      const el = e.target.closest(SELECTOR);
      if (!el) return;
      el.style.transition = "transform .25s cubic-bezier(.2,.7,.2,1)";
      el.style.transformStyle = "preserve-3d";
      el.style.willChange = "transform";
      el.classList.add("fxSpot");
    };
    const onMove = (e) => {
      if (!(e.target instanceof Element)) return;
      const el = e.target.closest(SELECTOR);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (0.5 - py) * 6;
      const ry = (px - 0.5) * 6;
      el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translate3d(0,-2px,0)`;
      el.style.setProperty("--mx", (px * 100).toFixed(2) + "%");
      el.style.setProperty("--my", (py * 100).toFixed(2) + "%");
    };
    const onLeave = (e) => {
      if (!(e.target instanceof Element)) return;
      const el = e.target.closest(SELECTOR);
      if (!el) return;
      el.style.transform = "";
      el.classList.remove("fxSpot");
    };

    document.addEventListener("mouseenter", onEnter, true);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave, true);
    return () => {
      document.removeEventListener("mouseenter", onEnter, true);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave, true);
    };
  }, []);

  // ── Botones magnéticos (.btnPrimary) ──
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) return;
    if (window.innerWidth <= 768) return;

    const onMove = (e) => {
      const buttons = document.querySelectorAll(".btnPrimary");
      buttons.forEach((b) => {
        const r = b.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const d = Math.hypot(dx, dy);
        const radius = 100;
        if (d < radius) {
          const f = (1 - d / radius) * 12;
          b.style.transition = "transform .12s ease";
          b.style.transform = `translate(${(dx / d) * f}px, ${(dy / d) * f}px)`;
        } else if (b.style.transform) {
          b.style.transition = "transform .35s cubic-bezier(.2,.7,.2,1)";
          b.style.transform = "";
        }
      });
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  // ── Auto count-up en stat numbers ──
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) return;

    const SELECTOR = ".cardStat .v, .igStatValue, [data-countup]";
    const animated = new WeakSet();

    const animate = (el) => {
      if (animated.has(el)) return;
      const raw = (el.textContent || "").trim();
      const m = raw.match(/^([^\d-]*)(-?[\d.,]+)([^\d]*)$/);
      if (!m) return;
      const prefix = m[1] || "";
      const numStr = m[2];
      const suffix = m[3] || "";
      const hasComma = numStr.includes(",") && !numStr.includes(".");
      const cleaned = hasComma ? numStr.replace(/\./g, "").replace(",", ".") : numStr.replace(/,/g, "");
      const target = parseFloat(cleaned);
      if (!Number.isFinite(target)) return;
      const decimals = (cleaned.split(".")[1] || "").length;
      animated.add(el);

      const start = performance.now();
      const dur = 1100;
      const fmt = (v) => {
        const fixed = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString();
        if (hasComma) {
          const [intPart, decPart] = fixed.split(".");
          const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
          return decPart ? `${withSep},${decPart}` : withSep;
        }
        return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      };
      const tick = (t) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + fmt(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) animate(e.target); });
    }, { threshold: 0.4 });

    const scan = () => {
      document.querySelectorAll(SELECTOR).forEach((el) => io.observe(el));
    };
    scan();
    const mo = new MutationObserver(() => { scan(); });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);

  // ── Konami code easter egg → LEMONS PARTY MODE ──
  useEffect(() => {
    const code = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
    let idx = 0;
    const onKey = (e) => {
      const k = e.key;
      const expected = code[idx];
      if (k === expected || (expected.length === 1 && k.toLowerCase() === expected)) {
        idx++;
        if (idx === code.length) {
          idx = 0;
          triggerPartyMode();
        }
      } else {
        idx = (k === code[0]) ? 1 : 0;
      }
    };
    const triggerPartyMode = () => {
      document.body.classList.add("fxPartyMode");
      const banner = document.createElement("div");
      banner.className = "fxPartyBanner";
      banner.textContent = "LEMONS MODE";
      document.body.appendChild(banner);

      // Confetti masivo desde varios puntos
      if (window.lemonsConfetti) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        for (let i = 0; i < 8; i++) {
          setTimeout(() => {
            window.lemonsConfetti(Math.random() * w, h * 0.3 + Math.random() * 200, 60);
          }, i * 180);
        }
      }
      setTimeout(() => {
        document.body.classList.remove("fxPartyMode");
        banner.remove();
      }, 6000);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── Click ripple global ──
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) return;
    const onClick = (e) => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest("input, textarea, [contenteditable]")) return;
      const r = document.createElement("span");
      r.className = "fxRipple";
      r.style.left = e.clientX + "px";
      r.style.top = e.clientY + "px";
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 900);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // ── Confetti utility en window.lemonsConfetti(x, y) ──
  useEffect(() => {
    const canvas = confettiRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const colors = ["#f5e03a", "#fff9b0", "#ff8c2a", "#ff5500", "#ffffff"];
    const burst = (x, y, count = 80) => {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      if (reduced) return;
      const cx = x ?? window.innerWidth / 2;
      const cy = y ?? window.innerHeight / 3;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 9;
        confettiPiecesRef.current.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3,
          g: 0.22 + Math.random() * 0.12,
          size: 4 + Math.random() * 6,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.4,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 0,
          maxLife: 90 + Math.random() * 50,
          shape: Math.random() < 0.5 ? "rect" : "circle",
        });
      }
      if (!confettiRunningRef.current) loop();
    };

    const confettiRunningRef = { current: false };
    const loop = () => {
      confettiRunningRef.current = true;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      const pieces = confettiPiecesRef.current;
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.vy += p.g;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life++;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        if (p.life >= p.maxLife || p.y > h + 30) pieces.splice(i, 1);
      }
      if (pieces.length > 0) {
        requestAnimationFrame(loop);
      } else {
        confettiRunningRef.current = false;
        ctx.clearRect(0, 0, w, h);
      }
    };

    window.lemonsConfetti = burst;
    return () => {
      window.removeEventListener("resize", resize);
      delete window.lemonsConfetti;
    };
  }, []);

  return (
    <>
      <div className="fxAurora" aria-hidden="true" />
      <canvas ref={canvasRef} className="fxParticles" aria-hidden="true" />
      <div ref={glowRef} className="fxCursorGlow" aria-hidden="true" />
      <canvas ref={confettiRef} className="fxConfetti" aria-hidden="true" />
    </>
  );
}
