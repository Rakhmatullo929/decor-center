import { useEffect, useRef } from 'react';
// @mui
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, keyframes } from '@mui/material/styles';
// framer-motion
import { m } from 'framer-motion';
// three.js
// eslint-disable-next-line import/no-extraneous-dependencies
import * as THREE from 'three';
// hooks
import useLocales from 'src/locales/use-locales';
// components
import Iconify from 'src/components/iconify';
//
import type { TestSession } from '../api/types';

// ----------------------------------------------------------------------

type Props = {
  result: TestSession;
  onFinish: () => void;
};

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.06); }
`;

const ringExpand = keyframes`
  0%   { transform: scale(0.7); opacity: 0.8; }
  100% { transform: scale(1.6); opacity: 0; }
`;

function ParticleBurst({ passed }: { passed: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const w = mount.clientWidth;
    const h = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 100);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const particleCount = 180;
    const color = passed ? 0x22c55e : 0xef4444;
    const color2 = passed ? 0x86efac : 0xfca5a5;

    const particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number }[] = [];

    for (let i = 0; i < particleCount; i += 1) {
      const size = Math.random() * 0.08 + 0.02;
      const geo = Math.random() > 0.5
        ? new THREE.SphereGeometry(size, 4, 4)
        : new THREE.TetrahedronGeometry(size, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? color : color2,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = Math.random() * 0.08 + 0.02;

      mesh.position.set(0, 0, 0);
      scene.add(mesh);

      const maxLife = Math.random() * 80 + 60;
      particles.push({
        mesh,
        vel: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed * 1.5,
          Math.cos(phi) * speed * 0.3
        ),
        life: 0,
        maxLife,
      });
    }

    let animId: number;
    const gravity = passed ? -0.001 : -0.002;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      particles.forEach((p) => {
        // eslint-disable-next-line no-param-reassign
        p.life += 1;
        p.vel.y += gravity;
        p.mesh.position.add(p.vel);
        p.mesh.rotation.x += 0.05;
        p.mesh.rotation.y += 0.04;
        const lifeRatio = p.life / p.maxLife;
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - lifeRatio);
        if (p.life >= p.maxLife) {
          // eslint-disable-next-line no-param-reassign
          p.life = 0;
          p.mesh.position.set(0, 0, 0);
          const t2 = Math.random() * Math.PI * 2;
          const p2 = Math.random() * Math.PI;
          const sp = Math.random() * 0.08 + 0.02;
          p.vel.set(
            Math.sin(p2) * Math.cos(t2) * sp,
            Math.sin(p2) * Math.sin(t2) * sp * 1.5,
            Math.cos(p2) * sp * 0.3
          );
        }
      });
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [passed]);

  return (
    <Box
      ref={mountRef}
      sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    />
  );
}

export default function ResultStep({ result, onFinish }: Props) {
  const { tx } = useLocales();
  const passed = Boolean(result.passed);

  const accentColor = passed ? '#22c55e' : '#ef4444';
  const accentAlpha = passed ? alpha('#22c55e', 0.15) : alpha('#ef4444', 0.15);

  return (
    <Box sx={{ position: 'relative', py: { xs: 4, md: 8 }, overflow: 'hidden' }}>
      <ParticleBurst passed={passed} />

      <Stack spacing={4} alignItems="center" textAlign="center" sx={{ position: 'relative', zIndex: 1 }}>
        {/* Icon with pulsing ring */}
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <Box
            sx={{
              position: 'absolute',
              inset: -8,
              borderRadius: '50%',
              border: '2px solid',
              borderColor: accentColor,
              animation: `${ringExpand} 2s ease-out infinite`,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: -8,
              borderRadius: '50%',
              border: '2px solid',
              borderColor: accentColor,
              animation: `${ringExpand} 2s ease-out infinite`,
              animationDelay: '0.6s',
            }}
          />

          <m.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
          >
            <Box
              sx={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                bgcolor: accentAlpha,
                border: '3px solid',
                borderColor: accentColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: `${pulse} 3s ease-in-out infinite`,
                boxShadow: `0 0 40px ${accentColor}44`,
              }}
            >
              <Iconify
                icon={passed ? 'solar:check-circle-bold-duotone' : 'solar:close-circle-bold-duotone'}
                width={56}
                sx={{ color: accentColor }}
              />
            </Box>
          </m.div>
        </Box>

        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            {result.employeeName}
          </Typography>
        </m.div>

        <m.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 150 }}
        >
          <Stack alignItems="center" spacing={1}>
            <Box
              sx={{
                px: 4,
                py: 2,
                borderRadius: 3,
                border: '2px solid',
                borderColor: accentColor,
                bgcolor: accentAlpha,
                boxShadow: `0 0 32px ${accentColor}33`,
              }}
            >
              <Typography
                variant="h1"
                sx={{ color: accentColor, fontWeight: 800, fontSize: { xs: '3rem', md: '4rem' }, lineHeight: 1 }}
              >
                {result.score ?? 0}
                <Typography component="span" variant="h3" sx={{ color: 'text.disabled', fontWeight: 400, mx: 1 }}>
                  /
                </Typography>
                {result.total}
              </Typography>
            </Box>

            <Box
              sx={{
                px: 3,
                py: 0.8,
                borderRadius: 10,
                bgcolor: accentAlpha,
                border: '1px solid',
                borderColor: accentColor,
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{ color: accentColor, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', fontSize: 13 }}
              >
                {tx(passed ? 'common.status.passed' : 'common.status.failed')}
              </Typography>
            </Box>
          </Stack>
        </m.div>

        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.35 }}
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<Iconify icon="solar:check-circle-bold" />}
            onClick={onFinish}
            sx={{
              px: 5,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              boxShadow: '0 4px 20px rgba(99,102,241,0.45)',
              '&:hover': {
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                boxShadow: '0 6px 28px rgba(99,102,241,0.6)',
              },
            }}
          >
            {tx('testing.result.finish')}
          </Button>
        </m.div>
      </Stack>
    </Box>
  );
}
