'use client';

import React, { useEffect, useMemo, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

// Quaternius "Ultimate Animated Animals" cow (CC0) — rigged with horns, legs, and gallop animation.
const COW_MODEL = '/models/cow.glb';
const RUN_ANIMATION = 'Gallop';

// Approach animation: far/small → near/large, then loop.
const APPROACH_CYCLE = 2.6;
const START_Z = -3.2;
const END_Z = 0.55;
const MIN_SCALE = 0.16;
const MAX_SCALE = 0.48;

const TRACK_COUNT = 10;
const TRACK_SPACING = 0.32;
const TRACK_SCROLL_SPEED = 6.5;
const TRACK_LOOP = TRACK_COUNT * TRACK_SPACING;

useGLTF.preload(COW_MODEL);

/** Speed lines parented to the cow — scroll forward along the run path (+Z). */
function CowTrack() {
  const trackRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!trackRef.current) return;
    trackRef.current.position.z += delta * TRACK_SCROLL_SPEED;
    if (trackRef.current.position.z >= 0.4) {
      trackRef.current.position.z -= TRACK_LOOP;
    }
  });

  return (
    <group ref={trackRef} position={[0, 0.06, -1.6]}>
      {Array.from({ length: TRACK_COUNT }, (_, i) => (
        <mesh key={i} position={[0, 0, -i * TRACK_SPACING]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.55, 0.1]} />
          <meshBasicMaterial
            color="#81C784"
            transparent
            opacity={0.5}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function RiggedCow() {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(COW_MODEL);
  const model = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions } = useAnimations(animations, groupRef);

  useEffect(() => {
    const gallop =
      actions[RUN_ANIMATION] ??
      actions.Gallop_Jump ??
      actions.Walk ??
      Object.values(actions).find(Boolean);

    if (!gallop) return;

    gallop.reset();
    gallop.setEffectiveTimeScale(1.2);
    gallop.setLoop(THREE.LoopRepeat, Infinity);
    gallop.fadeIn(0.3).play();

    return () => {
      gallop.fadeOut(0.2);
    };
  }, [actions]);

  return (
    <group ref={groupRef} rotation={[0, -Math.PI / 2, 0]} position={[0, 0.55, 0]}>
      <primitive object={model} />
    </group>
  );
}

function ApproachingCow() {
  const motionRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!motionRef.current) return;

    const t = (state.clock.elapsedTime % APPROACH_CYCLE) / APPROACH_CYCLE;
    const eased = 1 - Math.pow(1 - t, 2.4);

    motionRef.current.position.z = THREE.MathUtils.lerp(START_Z, END_Z, eased);
    const scale = THREE.MathUtils.lerp(MIN_SCALE, MAX_SCALE, eased);
    motionRef.current.scale.setScalar(scale);
  });

  return (
    <group ref={motionRef} position={[0, 0, START_Z]}>
      <CowTrack />
      <RiggedCow />
    </group>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 5]} intensity={1.25} />
      <directionalLight position={[-3, 3, -2]} intensity={0.45} color="#E3F2FD" />
      <hemisphereLight args={['#87CEEB', '#ffffff', 0.25]} />
      <ApproachingCow />
    </>
  );
}

interface RunningCowSceneProps {
  size?: number;
  className?: string;
}

export default function RunningCowScene({ size = 120, className }: RunningCowSceneProps) {
  return (
    <div
      className={className}
      style={{ width: size, height: size, flexShrink: 0 }}
      aria-hidden
    >
      <Canvas
        camera={{ position: [0, 1.5, 4.8], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
