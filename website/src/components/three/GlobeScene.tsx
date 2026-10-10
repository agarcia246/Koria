"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { DESTINATIONS } from "@/data/destinations";

export type GlobeState = {
  active: number;
};

function latLngToVec(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function Globe({ state }: { state: React.RefObject<GlobeState> }) {
  const group = useRef<THREE.Group>(null);
  const markers = useMemo(
    () => DESTINATIONS.map((d) => latLngToVec(d.lat, d.lng, 1.62)),
    [],
  );

  const positions = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1.58, 2);
    return geo.attributes.position.array as Float32Array;
  }, []);

  const { pointer } = useThree();

  useFrame((_, delta) => {
    if (!group.current) return;
    const dest = markers[state.current.active] ?? markers[0];
    const targetY = Math.atan2(dest.x, dest.z);
    const targetX = dest.y * 0.42;
    group.current.rotation.y = THREE.MathUtils.damp(
      group.current.rotation.y,
      -targetY + pointer.x * 0.12,
      2.4,
      delta,
    );
    group.current.rotation.x = THREE.MathUtils.damp(
      group.current.rotation.x,
      targetX + pointer.y * 0.08,
      2.4,
      delta,
    );
  });

  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[1.56, 1]} />
        <meshBasicMaterial color="#c8b88a" wireframe transparent opacity={0.14} />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial color="#a8a49c" size={0.018} sizeAttenuation />
      </points>
      {markers.map((p, i) => (
        <mesh key={`m-${i}`} position={p}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshBasicMaterial color="#f5f1e8" />
        </mesh>
      ))}
    </group>
  );
}

export function GlobeScene({ state }: { state: React.RefObject<GlobeState> }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 4.2], fov: 40 }}
      className="h-full w-full"
    >
      <Globe state={state} />
    </Canvas>
  );
}
