import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';

export default function CursorGlow() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mouseX = -200;
    let mouseY = -200;
    let ringX = -200;
    let ringY = -200;
    let rafId: number;
    let isHovering = false;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      const target = e.target as HTMLElement;
      isHovering = !!(
        target.closest('button') ||
        target.closest('[data-cursor-hover]') ||
        target.closest('a') ||
        target.closest('[role="button"]')
      );
    };

    const tick = () => {
      ringX = lerp(ringX, mouseX, 0.1);
      ringY = lerp(ringY, mouseY, 0.1);

      const dot = dotRef.current;
      const ring = ringRef.current;
      const glow = glowRef.current;

      if (dot) {
        dot.style.transform = `translate(${mouseX - 4}px, ${mouseY - 4}px)`;
        dot.style.opacity = isHovering ? '0' : '1';
      }
      if (ring) {
        const size = isHovering ? 52 : 36;
        ring.style.transform = `translate(${ringX - size / 2}px, ${ringY - size / 2}px)`;
        ring.style.width = `${size}px`;
        ring.style.height = `${size}px`;
        ring.style.borderColor = isHovering ? 'rgba(139,92,246,0.8)' : 'rgba(99,102,241,0.55)';
        ring.style.boxShadow = isHovering
          ? '0 0 20px rgba(139,92,246,0.5), 0 0 40px rgba(139,92,246,0.2)'
          : '0 0 10px rgba(99,102,241,0.3)';
      }
      if (glow) {
        glow.style.transform = `translate(${ringX - 80}px, ${ringY - 80}px)`;
        glow.style.opacity = isHovering ? '0.18' : '0.08';
      }

      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMouseMove);
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      {/* Dot */}
      <Box
        ref={dotRef}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: '#6366f1',
          zIndex: 99999,
          pointerEvents: 'none',
          transition: 'opacity 0.15s',
          boxShadow: '0 0 8px #6366f1, 0 0 16px rgba(99,102,241,0.5)',
        }}
      />
      {/* Ring */}
      <Box
        ref={ringRef}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '1.5px solid',
          borderColor: 'rgba(99,102,241,0.55)',
          zIndex: 99998,
          pointerEvents: 'none',
          transition: 'width 0.2s, height 0.2s, border-color 0.2s, box-shadow 0.2s, opacity 0.15s',
        }}
      />
      {/* Soft glow blob */}
      <Box
        ref={glowRef}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,1) 0%, transparent 70%)',
          zIndex: 99997,
          pointerEvents: 'none',
          transition: 'opacity 0.3s',
          filter: 'blur(20px)',
        }}
      />
    </>
  );
}
