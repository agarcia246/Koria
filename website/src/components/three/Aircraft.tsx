"use client";

import { useMemo } from "react";
import * as THREE from "three";

type AircraftProps = {
  model?: THREE.Object3D;
};

export function Aircraft({ model }: AircraftProps) {
  const body = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ddd8cf",
        metalness: 0.88,
        roughness: 0.22,
        envMapIntensity: 1.35,
      }),
    [],
  );
  const dark = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#161513",
        metalness: 0.7,
        roughness: 0.35,
      }),
    [],
  );
  const glass = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2a3340",
        metalness: 0.9,
        roughness: 0.08,
        transparent: true,
        opacity: 0.85,
      }),
    [],
  );

  if (model) {
    return <primitive object={model} />;
  }

  return (
    <group>
      <mesh material={body} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.2, 2.55, 8, 28]} />
      </mesh>
      <mesh material={body} position={[1.52, 0.01, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.2, 0.52, 28]} />
      </mesh>
      <mesh material={glass} position={[1.18, 0.07, 0]}>
        <boxGeometry args={[0.42, 0.08, 0.22]} />
      </mesh>
      <mesh material={dark} position={[0.28, 0.09, 0]}>
        <boxGeometry args={[1.05, 0.035, 0.16]} />
      </mesh>
      <mesh material={body} position={[-0.05, -0.04, 0]} rotation={[0, 0, 0.04]}>
        <boxGeometry args={[0.52, 0.035, 2.9]} />
      </mesh>
      <mesh material={body} position={[-0.28, -0.02, 1.28]} rotation={[0.12, 0.4, 0]}>
        <boxGeometry args={[0.28, 0.025, 0.55]} />
      </mesh>
      <mesh material={body} position={[-0.28, -0.02, -1.28]} rotation={[-0.12, -0.4, 0]}>
        <boxGeometry args={[0.28, 0.025, 0.55]} />
      </mesh>
      <mesh material={body} position={[-1.28, 0.3, 0]}>
        <boxGeometry args={[0.38, 0.52, 0.035]} />
      </mesh>
      <mesh material={body} position={[-1.22, 0.1, 0]}>
        <boxGeometry args={[0.3, 0.03, 0.92]} />
      </mesh>
      <mesh material={dark} position={[-0.18, -0.16, 0.52]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.075, 0.085, 0.48, 18]} />
      </mesh>
      <mesh material={dark} position={[-0.18, -0.16, -0.52]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.075, 0.085, 0.48, 18]} />
      </mesh>
    </group>
  );
}
