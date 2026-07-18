"use client";

import { useRef, useState, Suspense, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows, Lightformer, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { SoftShadows } from "./SoftShadows";

import woodDiff from "../../../public/textures/wood/diffuse.jpg";
import woodNorm from "../../../public/textures/wood/normal.jpg";
import woodRough from "../../../public/textures/wood/roughness.jpg";

import goldDiff from "../../../public/textures/metal/diffuse.jpg";
import goldNorm from "../../../public/textures/metal/normal.jpg";
import goldRough from "../../../public/textures/metal/roughness.jpg";

import stoneNorm from "../../../public/textures/stone/normal.jpg";
import stoneRough from "../../../public/textures/stone/roughness.jpg";

function CastleDoorModel({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) {
  const leftDoorRef = useRef<THREE.Group>(null);
  const rightDoorRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (leftDoorRef.current && rightDoorRef.current) {
      const targetRotationLeft = isOpen ? -Math.PI * 0.6 : 0;
      const targetRotationRight = isOpen ? Math.PI * 0.6 : 0;

      leftDoorRef.current.rotation.y = THREE.MathUtils.lerp(
        leftDoorRef.current.rotation.y,
        targetRotationLeft,
        delta * 3
      );
      rightDoorRef.current.rotation.y = THREE.MathUtils.lerp(
        rightDoorRef.current.rotation.y,
        targetRotationRight,
        delta * 3
      );
    }
  });

  const leftShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.04, 0);
    shape.lineTo(1.94, 0); 
    shape.lineTo(1.94, 4);
    shape.absarc(1.94, 4, 1.90, Math.PI / 2, Math.PI, false);
    shape.lineTo(0.04, 0);
    return shape;
  }, []);

  const rightShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.04, 0);
    shape.lineTo(-1.94, 0);
    shape.lineTo(-1.94, 4);
    shape.absarc(-1.94, 4, 1.90, Math.PI / 2, 0, true);
    shape.lineTo(-0.04, 0);
    return shape;
  }, []);

  const extrudeDoorSettings = useMemo(() => ({ depth: 0.25, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 }), []);

  const woodTex = useTexture({
    map: woodDiff.src,
    normalMap: woodNorm.src,
    roughnessMap: woodRough.src
  });
  const goldTex = useTexture({
    map: goldDiff.src,
    normalMap: goldNorm.src,
    roughnessMap: goldRough.src
  });
  // No diffuse/color map here on purpose — the source photo is a red brick
  // wall, not grey stone, and multiplying it into the material tinted the
  // whole arch/columns brown no matter what tint color was layered on top.
  // Normal + roughness alone still give real bump detail; color comes only
  // from stoneMaterial's flat grey.
  const stoneTex = useTexture({
    normalMap: stoneNorm.src,
    roughnessMap: stoneRough.src
  });

  useMemo(() => {
    [woodTex, goldTex, stoneTex].forEach(texGroup => {
      Object.values(texGroup).forEach((tex: any) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      });
    });
    Object.values(woodTex).forEach((tex: any) => tex.repeat.set(0.5, 0.5));
    Object.values(stoneTex).forEach((tex: any) => tex.repeat.set(2, 2));
    Object.values(goldTex).forEach((tex: any) => tex.repeat.set(2, 2));
  }, [woodTex, goldTex, stoneTex]);

  // Lower roughness reads as polished/regal gold instead of the dull matte
  // look a default roughness of 1 gives metals under PBR lighting.
  const goldMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d4af37", metalness: 0.85, roughness: 0.3, ...goldTex }), [goldTex]);
  const woodMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7a2f16", roughness: 0.65, ...woodTex }), [woodTex]);
  const stoneMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8c8c8c", roughness: 0.9, ...stoneTex }), [stoneTex]);

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {/* Decorative Regal Arch */}
      <mesh position={[0, 4, 0]} castShadow receiveShadow material={stoneMaterial}>
        <torusGeometry args={[2.2, 0.4, 16, 48, Math.PI]} />
      </mesh>
      {/* Gold Trim on Arch */}
      <mesh position={[0, 4, 0.1]} castShadow receiveShadow material={goldMaterial}>
        <torusGeometry args={[2.22, 0.08, 16, 48, Math.PI]} />
      </mesh>

      <mesh position={[-2.2, 2, 0]} castShadow receiveShadow material={stoneMaterial}>
        <boxGeometry args={[0.8, 4, 0.8]} />
      </mesh>
      <mesh position={[2.2, 2, 0]} castShadow receiveShadow material={stoneMaterial}>
        <boxGeometry args={[0.8, 4, 0.8]} />
      </mesh>
      
      {/* Gold Column Bases and Capitals */}
      {[0.2, 3.8].map(y => (
        <group key={`gold-base-${y}`}>
          <mesh position={[-2.2, y, 0.05]} castShadow receiveShadow material={goldMaterial}>
            <boxGeometry args={[0.85, 0.15, 0.85]} />
          </mesh>
          <mesh position={[2.2, y, 0.05]} castShadow receiveShadow material={goldMaterial}>
            <boxGeometry args={[0.85, 0.15, 0.85]} />
          </mesh>
        </group>
      ))}

      {/* Left Door */}
      <group position={[-2, 0, 0]} ref={leftDoorRef}>
        <mesh castShadow receiveShadow material={woodMaterial}>
          <extrudeGeometry args={[leftShape, extrudeDoorSettings]} />
        </mesh>
        
        {/* Planks Grooves */}
        {Array.from({ length: 6 }).map((_, i) => {
          const x = 0.3 + i * 0.3;
          const dx = x - 1.98;
          const h = 4 + Math.sqrt(Math.max(0, 1.98*1.98 - dx*dx));
          return (
            <mesh key={`l-groove-${i}`} position={[x, h / 2, 0.30]} castShadow>
              <boxGeometry args={[0.02, h - 0.1, 0.04]} />
              <meshStandardMaterial color="#000" roughness={1} />
            </mesh>
          );
        })}

        {/* Regal Gold Bands */}
        {[1.0, 2.5, 4.0].map((y) => (
          <group key={`l-band-${y}`}>
            <mesh position={[1.0, y, 0.30]} castShadow material={goldMaterial}>
              <boxGeometry args={[1.8, 0.25, 0.06]} />
            </mesh>
            {/* Hinge Joints */}
            <mesh position={[0.05, y, 0.30]} rotation={[0, 0, Math.PI/2]} castShadow material={goldMaterial}>
              <cylinderGeometry args={[0.18, 0.18, 0.1, 16]} />
            </mesh>
            {/* Rivets */}
            {[0.3, 0.7, 1.1, 1.5, 1.8].map((x, i) => (
              <mesh key={`rivet-l-${y}-${i}`} position={[x, y, 0.34]} castShadow material={goldMaterial}>
                <sphereGeometry args={[0.04, 12, 12]} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Center Vertical Astragal (Gold) */}
        <mesh position={[1.90, 2.75, 0.30]} castShadow material={goldMaterial}>
          <boxGeometry args={[0.1, 5.5, 0.06]} />
        </mesh>

        {/* Regal Ring Handle */}
        <group position={[1.4, 2.5, 0.33]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow material={goldMaterial}>
            <cylinderGeometry args={[0.3, 0.3, 0.04, 24]} />
          </mesh>
          <mesh position={[0, 0, 0.04]} castShadow material={goldMaterial}>
            <sphereGeometry args={[0.2, 16, 16]} />
          </mesh>
          <mesh rotation={[-0.1, 0, 0]} position={[0, -0.22, 0.1]} castShadow material={goldMaterial}>
            <torusGeometry args={[0.25, 0.05, 16, 32]} />
          </mesh>
        </group>
      </group>

      {/* Right Door */}
      <group position={[2, 0, 0]} ref={rightDoorRef}>
        <mesh castShadow receiveShadow material={woodMaterial}>
          <extrudeGeometry args={[rightShape, extrudeDoorSettings]} />
        </mesh>
        
        {/* Planks Grooves */}
        {Array.from({ length: 6 }).map((_, i) => {
          const x = -0.3 - i * 0.3;
          const dx = Math.abs(x) - 1.98;
          const h = 4 + Math.sqrt(Math.max(0, 1.98*1.98 - dx*dx));
          return (
            <mesh key={`r-groove-${i}`} position={[x, h / 2, 0.30]} castShadow>
              <boxGeometry args={[0.02, h - 0.1, 0.04]} />
              <meshStandardMaterial color="#000" roughness={1} />
            </mesh>
          );
        })}

        {/* Regal Gold Bands */}
        {[1.0, 2.5, 4.0].map((y) => (
          <group key={`r-band-${y}`}>
            <mesh position={[-1.0, y, 0.30]} castShadow material={goldMaterial}>
              <boxGeometry args={[1.8, 0.25, 0.06]} />
            </mesh>
            {/* Hinge Joints */}
            <mesh position={[-0.05, y, 0.30]} rotation={[0, 0, Math.PI/2]} castShadow material={goldMaterial}>
              <cylinderGeometry args={[0.18, 0.18, 0.1, 16]} />
            </mesh>
            {/* Rivets */}
            {[-0.3, -0.7, -1.1, -1.5, -1.8].map((x, i) => (
              <mesh key={`rivet-r-${y}-${i}`} position={[x, y, 0.34]} castShadow material={goldMaterial}>
                <sphereGeometry args={[0.04, 12, 12]} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Center Vertical Astragal (Gold) */}
        <mesh position={[-1.90, 2.75, 0.30]} castShadow material={goldMaterial}>
          <boxGeometry args={[0.1, 5.5, 0.06]} />
        </mesh>

        {/* Regal Ring Handle */}
        <group position={[-1.4, 2.5, 0.33]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow material={goldMaterial}>
            <cylinderGeometry args={[0.3, 0.3, 0.04, 24]} />
          </mesh>
          <mesh position={[0, 0, 0.04]} castShadow material={goldMaterial}>
            <sphereGeometry args={[0.2, 16, 16]} />
          </mesh>
          <mesh rotation={[-0.1, 0, 0]} position={[0, -0.22, 0.1]} castShadow material={goldMaterial}>
            <torusGeometry args={[0.25, 0.05, 16, 32]} />
          </mesh>
        </group>
      </group>

      {/* Inner light (glow from inside) */}
      <pointLight position={[0, 3, -3]} intensity={isOpen ? 6 : 0} color="#ffaa00" distance={15} decay={1.5} />
    </group>
  );
}

function CameraController({ isOpen, onEnter }: { isOpen: boolean, onEnter: () => void }) {
  const [triggered, setTriggered] = useState(false);
  const { viewport } = useThree();
  const lookAtTarget = useRef(new THREE.Vector3(0, 3.5, 0));

  useFrame((state, delta) => {
    // Determine the Z distance required to fit the massive door based on aspect ratio
    // The door is roughly 6 units wide and 8 units tall (including the arch).
    // FOV is 45. Math.tan(45 / 2 * Math.PI / 180) = ~0.414.
    const requiredZForWidth = 4 / (0.414 * viewport.aspect);
    const targetZ = isOpen ? -2 : Math.max(10, requiredZForWidth);

    if (isOpen) {
      state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetZ, delta * 1.5);
      if (state.camera.position.z < 1 && !triggered) {
        setTriggered(true);
        onEnter();
      }
    } else {
      state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetZ, delta * 2);
      // Subtle mouse parallax
      state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, state.pointer.x * 1, delta * 2);
      state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, 4 + state.pointer.y * 1, delta * 2);
    }
    
    // Smoothly move the lookAt target away when entering so the camera doesn't flip at Z=0
    const targetLookAtZ = isOpen ? -20 : 0;
    lookAtTarget.current.z = THREE.MathUtils.lerp(lookAtTarget.current.z, targetLookAtZ, delta * 2);
    state.camera.lookAt(lookAtTarget.current);
  });
  return null;
}

export function DoorCastle3D({ onEnter }: { onEnter: () => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 1.75]}
      camera={{ position: [0, 4, 14], fov: 45 }}
      gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      style={{ width: "100%", height: "100%", cursor: "pointer", touchAction: "pan-y" }}
    >
      <SoftShadows size={25} samples={10} focus={0.5} />
      <fog attach="fog" args={["#030303", 8, 25]} />
      
      {/* Dramatic realistic lighting — kept low ambient so the key/rim
          lights carve out real shadow depth instead of washing everything
          flat, which is what made the previous version read as fake. */}
      <ambientLight intensity={0.35} color="#1a1420" />
      <directionalLight
        position={[8, 12, 12]}
        intensity={3.2}
        color="#e6edff"
        castShadow
        shadow-bias={-0.0005}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      >
        <orthographicCamera attach="shadow-camera" args={[-10, 10, 10, -10]} />
      </directionalLight>
      <spotLight
        position={[-8, 6, 10]}
        intensity={40}
        color="#ff8a3d"
        angle={0.6}
        penumbra={1}
        decay={1.5}
        distance={40}
      />
      {/* Cool rim light from behind to separate the door silhouette from
          the wall instead of everything blending into one flat mass. */}
      <spotLight
        position={[0, 10, -6]}
        intensity={18}
        color="#5a6bff"
        angle={0.9}
        penumbra={1}
        decay={1.5}
        distance={30}
      />

      <CameraController isOpen={isOpen} onEnter={onEnter} />

      <Suspense fallback={null}>
        <CastleDoorModel isOpen={isOpen} onClick={() => setIsOpen(true)} />
        {/* Brand-matched environment: warm orange/gold Lightformers (same
            palette as the page's BackgroundGlow and CTA accent) so the
            gold/stone PBR reflections tie into the site instead of a
            generic blue-tinted "night" HDRI that reads as an unrelated
            stock castle scene. */}
        <Environment resolution={256} environmentIntensity={1.1}>
          <Lightformer form="rect" intensity={4} position={[6, 6, 8]} scale={[10, 10, 1]} target={[0, 3, 0]} color="#ff6b00" />
          <Lightformer form="rect" intensity={2.5} position={[-6, 4, 8]} scale={[8, 8, 1]} target={[0, 3, 0]} color="#ffb800" />
          <Lightformer form="circle" intensity={1.2} position={[0, 10, -4]} scale={[10, 10, 1]} target={[0, 3, 0]} color="#030303" />
        </Environment>
      </Suspense>

      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.6}
        scale={20}
        blur={2}
        far={6}
      />
    </Canvas>
  );
}
