'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const COUNT = 72;
const THRESHOLD = 4.4;
const MAX_LINE_PAIRS = COUNT * COUNT;
const REPULSION_RADIUS = 6.5;
const REPULSION_STRENGTH = 0.018;
// Multi-color palette: green / teal / purple / blue
const COLORS = [0x25d366, 0x2dd4bf, 0xa78bfa, 0x60a5fa];

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.022);
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 22;

    // Mouse position in NDC (-1 to 1)
    const mouse = new THREE.Vector2(-9999, -9999);
    const mouse3D = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();

    function onMouseMove(e: MouseEvent) {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // Particle positions, velocities, and base velocities
    const positions = new Float32Array(COUNT * 3);
    const velocities: { x: number; y: number; z: number }[] = [];

    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 8 + Math.random() * 9;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      velocities.push({
        x: (Math.random() - 0.5) * 0.004,
        y: (Math.random() - 0.5) * 0.004,
        z: (Math.random() - 0.5) * 0.003,
      });
    }

    // Multi-color particle groups with additive blending for neon glow
    const pointGroups: THREE.Points[] = [];
    const pointMats: THREE.PointsMaterial[] = [];
    const groupSize = Math.floor(COUNT / COLORS.length);

    for (let c = 0; c < COLORS.length; c++) {
      const start = c * groupSize;
      const end = c === COLORS.length - 1 ? COUNT : (c + 1) * groupSize;
      const groupPos = positions.slice(start * 3, end * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(groupPos), 3));
      const mat = new THREE.PointsMaterial({
        color: COLORS[c],
        size: 0.12,
        transparent: true,
        opacity: 0.72,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const pts = new THREE.Points(geo, mat);
      scene.add(pts);
      pointGroups.push(pts);
      pointMats.push(mat);
    }

    // Connecting lines with additive blending
    const linePos = new Float32Array(MAX_LINE_PAIRS * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x25d366,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    scene.add(new THREE.LineSegments(lineGeo, lineMat));

    let animFrameId: number;
    let frameCount = 0;

    function animate() {
      animFrameId = requestAnimationFrame(animate);
      frameCount++;
      // Update positions every other frame for perf
      if (frameCount % 2 !== 0) {
        renderer.render(scene, camera);
        return;
      }

      // Project mouse to z=0 plane for repulsion
      raycaster.setFromCamera(mouse, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      raycaster.ray.intersectPlane(plane, mouse3D);

      // Update master positions array (used for line calculations)
      for (let i = 0; i < COUNT; i++) {
        // Mouse repulsion
        const px = positions[i * 3];
        const py = positions[i * 3 + 1];
        const pz = positions[i * 3 + 2];
        const dx = px - mouse3D.x;
        const dy = py - mouse3D.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < REPULSION_RADIUS && dist > 0.01) {
          const force = (REPULSION_RADIUS - dist) / REPULSION_RADIUS * REPULSION_STRENGTH;
          velocities[i].x += (dx / dist) * force;
          velocities[i].y += (dy / dist) * force;
        }

        // Velocity damping to prevent runaway
        velocities[i].x *= 0.98;
        velocities[i].y *= 0.98;
        velocities[i].z *= 0.98;

        positions[i * 3] += velocities[i].x;
        positions[i * 3 + 1] += velocities[i].y;
        positions[i * 3 + 2] += velocities[i].z;

        const r = Math.sqrt(px * px + py * py + pz * pz);
        if (r > 18) {
          velocities[i].x *= -1;
          velocities[i].y *= -1;
          velocities[i].z *= -1;
        }
      }

      // Sync each color group's geometry from master positions
      for (let c = 0; c < COLORS.length; c++) {
        const start = c * groupSize;
        const end = c === COLORS.length - 1 ? COUNT : (c + 1) * groupSize;
        const groupGeo = pointGroups[c].geometry;
        const groupArr = groupGeo.attributes.position.array as Float32Array;
        for (let i = start; i < end; i++) {
          const li = (i - start) * 3;
          groupArr[li]     = positions[i * 3];
          groupArr[li + 1] = positions[i * 3 + 1];
          groupArr[li + 2] = positions[i * 3 + 2];
        }
        groupGeo.attributes.position.needsUpdate = true;
      }

      // Update connecting lines
      let idx = 0;
      const lp = lineGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < COUNT; i++) {
        for (let j = i + 1; j < COUNT; j++) {
          const dx = positions[i*3] - positions[j*3];
          const dy = positions[i*3+1] - positions[j*3+1];
          const dz = positions[i*3+2] - positions[j*3+2];
          const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (d < THRESHOLD && idx < MAX_LINE_PAIRS * 6) {
            lp[idx++] = positions[i*3];   lp[idx++] = positions[i*3+1]; lp[idx++] = positions[i*3+2];
            lp[idx++] = positions[j*3];   lp[idx++] = positions[j*3+1]; lp[idx++] = positions[j*3+2];
          }
        }
      }
      for (let k = idx; k < MAX_LINE_PAIRS * 6; k++) lp[k] = 0;
      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.setDrawRange(0, idx / 3);

      renderer.render(scene, camera);
    }
    animate();

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      for (const pg of pointGroups) { pg.geometry.dispose(); }
      for (const pm of pointMats) { pm.dispose(); }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-85"
    />
  );
}
