"use client";

import { Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { MotionValue } from "framer-motion";
import { SoftShadows } from "./SoftShadows";

// Suppress THREE.Clock deprecation warning caused by @react-three/fiber internals
const origConsoleWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === "string" && args[0].includes("THREE.Clock: This module has been deprecated")) return;
  origConsoleWarn(...args);
};

// The flag cloth mesh — shared geometry (957 verts, identical bounding box)
// re-skinned per house across architecture_flag.glb / camt_flag.glb /
// Masscom_flag.glb / Fine_art_flag.glb — is a densely
// subdivided plane authored flat, thin along local Y — that's the axis we
// push a wind ripple through. Local Z is the axis running from the
// top/pole attachment (near z = min) down to the bottom (near z = max), so
// ripple amplitude tapers from 0 at the pole (z = min) to full strength at
// the bottom (z = max), like a real banner pinned at the top.
// glTF scene-graph objects are named after their *node*, not the mesh they
// reference, and Blender disambiguates re-imported "Plane" nodes by
// suffixing ".001"/".002"/etc per file — so match by prefix, not exact name.
const FLAG_MESH_NAME_PREFIX = "Plane";

function windVertexShader(
  shader: THREE.WebGLProgramParametersWithUniforms,
  zMin: number,
  zMax: number
) {
  shader.uniforms.uTime = { value: 0 };
  shader.uniforms.uWindStrength = { value: 1 };
  shader.uniforms.uZMin = { value: zMin };
  shader.uniforms.uZMax = { value: zMax };

  shader.vertexShader = `
    uniform float uTime;
    uniform float uWindStrength;
    uniform float uZMin;
    uniform float uZMax;
    ${shader.vertexShader}
  `.replace(
    "#include <begin_vertex>",
    `
    #include <begin_vertex>
    // Calculate distance from the hoist (top, zMin) down to the bottom (zMax)
    float hoistDistance = clamp((position.z - uZMin) / (uZMax - uZMin), 0.0, 1.0);
    float taper = smoothstep(0.0, 1.0, hoistDistance);
    
    // Richer wave harmonics with higher frequencies and multiple overlays
    float ripple =
      sin(position.z * 3.8 - uTime * 4.2) * 0.65 +
      sin(position.z * 8.5 - uTime * 6.5) * 0.35 +
      sin(position.x * 5.0 + uTime * 3.0) * 0.18 +
      cos(position.z * 2.0 - uTime * 2.0) * 0.15;
      
    // Shift ripple so the wind always blows away from the pole
    ripple += 1.35;
    
    // Shift cloth forward by 0.05 to clear the horizontal pole,
    // and apply the wind ripple only away from the pole.
    transformed.y += 0.05 + (ripple * taper * taper * 0.15 * uWindStrength);
    `
  );

  return shader;
}

function FlagModel({
  url,
  windStrength,
  onGrounded,
  scrollProgress,
  prefersReducedMotion,
}: {
  url: string;
  windStrength: number;
  onGrounded: (info: { groundY: number; footprint: number; height: number }) => void;
  scrollProgress?: MotionValue<number>;
  prefersReducedMotion: boolean;
}) {
  const { scene } = useGLTF(url);
  const group = useRef<THREE.Group>(null);
  const shadersRef = useRef<THREE.WebGLProgramParametersWithUniforms[]>([]);

  const cloned = useMemo(() => scene.clone(true), [scene]);

  useLayoutEffect(() => {
    // Clear shaders on remount
    shadersRef.current = [];

    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.name.startsWith(FLAG_MESH_NAME_PREFIX)) {
        const geometry = child.geometry;
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox || new THREE.Box3();
        const zMin = bbox.min.z;
        const zMax = bbox.max.z;

        const material = (
          Array.isArray(child.material) ? child.material[0] : child.material
        ) as THREE.MeshStandardMaterial;
        material.side = THREE.DoubleSide;
        
        // Improve material realism properties
        material.roughness = 0.8;
        material.metalness = 0.1;
        
        material.onBeforeCompile = (shader) => {
          shadersRef.current.push(windVertexShader(shader, zMin, zMax));
        };
        material.needsUpdate = true;

        // Custom depth material so the cast shadow flutters exactly like the flag
        const depthMaterial = new THREE.MeshDepthMaterial({
          depthPacking: THREE.RGBADepthPacking,
        });
        depthMaterial.onBeforeCompile = (shader) => {
          shadersRef.current.push(windVertexShader(shader, zMin, zMax));
        };
        child.customDepthMaterial = depthMaterial;
      }
    });

    // Center + normalize scale so the model frames consistently regardless
    // of the arbitrary world-space offset it was authored at in Blender.
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 3.4 / maxDim;

    if (group.current) {
      group.current.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      group.current.scale.setScalar(scale);
    }

    // Report where the model's base actually lands (not assumed) so the
    // contact-shadow plane sits exactly at its feet instead of guessing.
    onGrounded({
      groundY: -((size.y * scale) / 2),
      footprint: Math.max(size.x, size.z) * scale,
      height: size.y * scale,
    });
  }, [cloned, onGrounded]);

  const lastScrollVal = useRef<number | null>(null);
  const scrollVelocity = useRef(0);

  useFrame((state, delta) => {
    // 1. Calculate scroll progress and velocity (change per frame)
    let scrollVal = scrollProgress ? scrollProgress.get() : 0.5;
    // Guard against NaN or non-number values
    if (typeof scrollVal !== "number" || isNaN(scrollVal)) {
      scrollVal = 0.5;
    }

    if (lastScrollVal.current === null) {
      lastScrollVal.current = scrollVal;
    }
    const diff = scrollVal - lastScrollVal.current;
    lastScrollVal.current = scrollVal;

    // Smooth the velocity
    const absDiff = isNaN(diff) ? 0 : Math.abs(diff);
    scrollVelocity.current = THREE.MathUtils.lerp(
      scrollVelocity.current,
      absDiff / (delta || 0.016),
      0.1
    );
    // Cap velocity to avoid spikes and ensure it's a valid number
    let clampedVelocity = Math.min(scrollVelocity.current, 10);
    if (isNaN(clampedVelocity)) {
      clampedVelocity = 0;
    }

    // 2. Animate shaders
    shadersRef.current.forEach((shader) => {
      // Wind speed is driven by time and boosted by scroll velocity
      const speedMultiplier = prefersReducedMotion ? 1.0 : 1.0 + clampedVelocity * 1.5;
      const timeDelta = delta * speedMultiplier;
      shader.uniforms.uTime.value += isNaN(timeDelta) ? delta : timeDelta;
      
      const dynamicWind = prefersReducedMotion ? windStrength : windStrength * (1.0 + clampedVelocity * 0.4);
      shader.uniforms.uWindStrength.value = isNaN(dynamicWind) ? windStrength : dynamicWind;
    });

  });

  return (
    <group ref={group}>
      <primitive object={cloned} />
    </group>
  );
}

function Scene({
  url,
  prefersReducedMotion,
  scrollProgress,
}: {
  url: string;
  prefersReducedMotion: boolean;
  scrollProgress?: MotionValue<number>;
}) {
  const [ground, setGround] = useState({ groundY: -1.7, footprint: 1.2, height: 3.4 });
  const glowRadius = Math.max(ground.footprint * 1.8, 1.2);

  return (
    <>
      <SoftShadows size={25} focus={0.5} samples={10} />
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 8, 4]}
        intensity={2.8}
        castShadow
        shadow-bias={-0.0005}
        shadow-mapSize={[2048, 2048]}
      >
        <orthographicCamera attach="shadow-camera" args={[-3, 3, 3, -3, 0.1, 20]} />
      </directionalLight>
      <directionalLight position={[-4, 2, -3]} intensity={1.5} color="#ffaa00" />
      
      {/* Real directional shadow receiver */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ground.groundY, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial transparent opacity={0.6} />
      </mesh>

      <Suspense fallback={null}>
        <Environment resolution={256} environmentIntensity={1.2}>
          <Lightformer form="rect" intensity={3} position={[5, 5, 5]} scale={[10, 10, 1]} target={[0, 0, 0]} color="#ffffff" />
          <Lightformer form="rect" intensity={2.5} position={[-5, 5, -5]} scale={[10, 10, 1]} target={[0, 0, 0]} color="#ffaa00" />
          <Lightformer form="circle" intensity={1.5} position={[0, 8, 0]} scale={[8, 8, 1]} target={[0, 0, 0]} color="#4488ff" />
        </Environment>
        <FlagModel
          url={url}
          windStrength={prefersReducedMotion ? 0.08 : 1}
          onGrounded={setGround}
          scrollProgress={scrollProgress}
          prefersReducedMotion={prefersReducedMotion}
        />
      </Suspense>
      <ContactShadows
        position={[0, ground.groundY, 0]}
        opacity={0.4}
        scale={glowRadius * 1.1}
        blur={1.8}
        far={ground.height}
        resolution={512}
        color="#000000"
        renderOrder={1}
      />
    </>
  );
}

export function FlagFlutter3D({
  src,
  prefersReducedMotion,
  scrollProgress,
}: {
  src: string;
  prefersReducedMotion: boolean;
  scrollProgress?: MotionValue<number>;
}) {
  // R3F's Canvas only re-measures its size on window resize/scroll events
  // (see react-three-fiber's default `resize` debounce config), not on every
  // DOM layout change. When this mounts inside an animating flex/vh layout
  // (AnimatePresence + Framer Motion entry transitions), the very first
  // ResizeObserver reading can land before that layout has settled, so the
  // canvas renders undersized until something dispatches resize/scroll —
  // which is exactly why scrolling the page "fixes" it. Force a re-measure
  // right after the layout has had a chance to settle so users don't have to.
  useLayoutEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Canvas
        shadows={{ type: THREE.BasicShadowMap }}
        dpr={[1, 1.75]}
        camera={{ position: [-0.8, 1.2, 6], fov: 32 }}
        gl={{ alpha: true, antialias: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene url={src} prefersReducedMotion={prefersReducedMotion} scrollProgress={scrollProgress} />
      </Canvas>
    </div>
  );
}

