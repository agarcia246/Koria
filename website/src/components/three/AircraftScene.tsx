"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, PerspectiveCamera } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { Aircraft } from "./Aircraft";

export type SceneState = {
  progress: number;
  mouseX: number;
  mouseY: number;
};

function Scene({ state }: { state: React.RefObject<SceneState> }) {
  const group = useRef<THREE.Group>(null);
  const camera = useRef<THREE.PerspectiveCamera>(null);
  const light = useRef<THREE.DirectionalLight>(null);

  useFrame(() => {
    const s = state.current;
    const mx = s.mouseX;
    const my = s.mouseY;
    const p = s.progress;

    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        0.35 + mx * 0.22 + p * 0.45,
        0.05,
      );
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        0.06 - my * 0.1,
        0.05,
      );
      group.current.position.x = THREE.MathUtils.lerp(0.6, 2.2, p);
      group.current.position.y = THREE.MathUtils.lerp(0.15, 0.85, p);
      group.current.position.z = THREE.MathUtils.lerp(0, -2.8, p);
    }

    if (camera.current) {
      camera.current.position.x = THREE.MathUtils.lerp(
        camera.current.position.x,
        mx * 0.45,
        0.045,
      );
      camera.current.position.y = THREE.MathUtils.lerp(
        camera.current.position.y,
        0.35 + my * 0.2 + p * 0.55,
        0.045,
      );
      camera.current.position.z = THREE.MathUtils.lerp(5.4, 3.4, p);
      camera.current.lookAt(0.4, 0.1, 0);
    }

    if (light.current) {
      light.current.intensity = 2.1 + mx * 0.25;
      light.current.position.x = 5 + mx * 2;
    }
  });

  return (
    <>
      <PerspectiveCamera ref={camera} makeDefault fov={36} position={[0.2, 0.4, 5.4]} />
      <hemisphereLight args={["#f2e6c9", "#2a241c", 0.85]} />
      <directionalLight
        ref={light}
        position={[5, 4, 6]}
        intensity={2.1}
        color="#fff1d0"
      />
      <directionalLight position={[-6, 1, -2]} intensity={0.7} color="#9bb0c7" />
      <Environment preset="sunset" />
      <group ref={group} rotation={[0.1, 0.4, 0]} scale={1.85} position={[0.5, 0.1, 0]}>
        <Aircraft />
      </group>
    </>
  );
}

export function AircraftScene({ state }: { state: React.RefObject<SceneState> }) {
  return (
    <Canvas
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      className="h-full w-full"
      style={{ background: "transparent" }}
    >
      <Scene state={state} />
    </Canvas>
  );
}
