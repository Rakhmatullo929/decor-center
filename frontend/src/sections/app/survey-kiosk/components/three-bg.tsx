import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
// eslint-disable-next-line import/no-extraneous-dependencies
import * as THREE from 'three';

type Props = {
  color?: number;
  particleCount?: number;
  sx?: object;
};

export default function ThreeBg({ color = 0x6366f1, particleCount = 120, sx }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const w = mount.clientWidth || window.innerWidth;
    const h = mount.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // Particles
    const positions = new Float32Array(particleCount * 3);
    const velocities: { x: number; y: number }[] = [];
    for (let i = 0; i < particleCount; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
      velocities.push({
        x: (Math.random() - 0.5) * 0.018,
        y: (Math.random() - 0.5) * 0.018,
      });
    }
    const ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const ptMat = new THREE.PointsMaterial({ color, size: 0.06, transparent: true, opacity: 0.7 });
    const points = new THREE.Points(ptGeo, ptMat);
    scene.add(points);

    // Lines between nearby particles
    const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.15 });
    const lineGeo = new THREE.BufferGeometry();
    const linePositions: number[] = [];
    for (let i = 0; i < particleCount; i += 1) {
      for (let j = i + 1; j < particleCount; j += 1) {
        const dx = positions[i * 3] - positions[j * 3];
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
        if (Math.sqrt(dx * dx + dy * dy) < 3.5) {
          linePositions.push(
            positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
            positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]
          );
        }
      }
    }
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
    scene.add(new THREE.LineSegments(lineGeo, lineMat));

    // Floating wireframe shapes
    const shapes: { mesh: THREE.Mesh; rx: number; ry: number }[] = [];
    const shapeColors = [color, 0x8b5cf6, 0x06b6d4];
    for (let i = 0; i < 4; i += 1) {
      const geo = i % 2 === 0
        ? new THREE.IcosahedronGeometry(0.22 + Math.random() * 0.18, 0)
        : new THREE.OctahedronGeometry(0.22 + Math.random() * 0.2, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: shapeColors[i % shapeColors.length],
        wireframe: true,
        transparent: true,
        opacity: 0.25,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 2
      );
      scene.add(mesh);
      shapes.push({ mesh, rx: (Math.random() - 0.5) * 0.01, ry: (Math.random() - 0.5) * 0.012 });
    }

    let animId: number;
    const pos = ptGeo.attributes.position as THREE.BufferAttribute;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      for (let i = 0; i < particleCount; i += 1) {
        (pos.array as Float32Array)[i * 3] += velocities[i].x;
        (pos.array as Float32Array)[i * 3 + 1] += velocities[i].y;
        if ((pos.array as Float32Array)[i * 3] > 9) (pos.array as Float32Array)[i * 3] = -9;
        if ((pos.array as Float32Array)[i * 3] < -9) (pos.array as Float32Array)[i * 3] = 9;
        if ((pos.array as Float32Array)[i * 3 + 1] > 9) (pos.array as Float32Array)[i * 3 + 1] = -9;
        if ((pos.array as Float32Array)[i * 3 + 1] < -9) (pos.array as Float32Array)[i * 3 + 1] = 9;
      }
      pos.needsUpdate = true;
      shapes.forEach(({ mesh, rx, ry }) => {
        mesh.rotation.x += rx;
        mesh.rotation.y += ry;
      });
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [color, particleCount]);

  return (
    <Box
      ref={mountRef}
      sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden', ...sx }}
    />
  );
}
