import * as THREE from "three";
import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal, useFrame } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";

import { DofPointsMaterial } from "./shaders/pointMaterial";
import { SimulationMaterial } from "./shaders/simulationMaterial";
import * as easing from "maath/easing";

interface Ripple {
  origin: [number, number];
  startTime: number;
  id: number;
}

export function Particles({
  speed,
  aperture,
  focus,
  size = 512,
  noiseScale = 1.0,
  noiseIntensity = 0.5,
  timeScale = 0.5,
  pointSize = 2.0,
  opacity = 1.0,
  planeScale = 1.0,
  useManualTime = false,
  manualTime = 0,
  introspect = false,
  mousePosition = { x: 0.5, y: 0.5 },
  ...props
}: {
  speed: number;
  // fov: number
  aperture: number;
  focus: number;
  size: number;
  noiseScale?: number;
  noiseIntensity?: number;
  timeScale?: number;
  pointSize?: number;
  opacity?: number;
  planeScale?: number;
  useManualTime?: boolean;
  manualTime?: number;
  introspect?: boolean;
  mousePosition?: { x: number; y: number };
}) {
  // Reveal animation state
  const revealStartTime = useRef<number | null>(null);
  const [isRevealing, setIsRevealing] = useState(true);
  const revealDuration = 3.5; // seconds
  
  // Ripple effects state
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const rippleIdCounter = useRef(0);
  const lastMousePosition = useRef<{ x: number; y: number }>({ x: mousePosition.x, y: mousePosition.y });
  const lastRippleTime = useRef(0);
  
  // Create simulation material with scale parameter
  const simulationMaterial = useMemo(() => {
    return new SimulationMaterial(planeScale);
  }, [planeScale]);

  const target = useFBO(size, size, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  });

  const dofPointsMaterial = useMemo(() => {
    const m = new DofPointsMaterial();
    m.uniforms.positions.value = target.texture;
    m.uniforms.initialPositions.value =
      simulationMaterial.uniforms.positions.value;
    return m;
  }, [simulationMaterial]);

  const [scene] = useState(() => new THREE.Scene());
  const [camera] = useState(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, 1 / Math.pow(2, 53), 1)
  );
  const [positions] = useState(
    () =>
      new Float32Array([
        -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0,
      ])
  );
  const [uvs] = useState(
    () => new Float32Array([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0])
  );

  const particles = useMemo(() => {
    const length = size * size;
    const particles = new Float32Array(length * 3);
    for (let i = 0; i < length; i++) {
      const i3 = i * 3;
      particles[i3 + 0] = (i % size) / size;
      particles[i3 + 1] = i / size / size;
    }
    return particles;
  }, [size]);

  // Track mouse movement and create ripples in useFrame for better performance
  const createRippleIfNeeded = (currentTimeMs: number) => {
    const timeSinceLastRipple = currentTimeMs - lastRippleTime.current;
    
    // Check if mouse has moved significantly (dragging)
    const dx = mousePosition.x - lastMousePosition.current.x;
    const dy = mousePosition.y - lastMousePosition.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Create ripple if mouse moved enough and enough time has passed
    if (distance > 0.005 && timeSinceLastRipple > 30) { // 30ms between ripples, smaller threshold
      const newRipple: Ripple = {
        origin: [mousePosition.x, mousePosition.y],
        startTime: currentTimeMs,
        id: rippleIdCounter.current++
      };
      
      setRipples(prev => {
        const updated = [...prev, newRipple];
        // Keep only recent ripples (last 3 seconds)
        return updated.filter(r => currentTimeMs - r.startTime < 3000);
      });
      
      lastRippleTime.current = currentTimeMs;
      lastMousePosition.current = { x: mousePosition.x, y: mousePosition.y };
    } else if (distance > 0.001) {
      // Update position even if not creating ripple
      lastMousePosition.current = { x: mousePosition.x, y: mousePosition.y };
    }
  };

  useFrame((state, delta) => {
    if (!dofPointsMaterial || !simulationMaterial) return;

    state.gl.setRenderTarget(target);
    state.gl.clear();
    // @ts-ignore
    state.gl.render(scene, camera);
    state.gl.setRenderTarget(null);

    // Use manual time if enabled, otherwise use elapsed time
    const currentTime = useManualTime ? manualTime : state.clock.elapsedTime;
    const currentTimeMs = Date.now();
    
    // Create ripples based on mouse movement
    createRippleIfNeeded(currentTimeMs);

    // Initialize reveal start time on first frame
    if (revealStartTime.current === null) {
      revealStartTime.current = currentTime;
    }

    // Calculate reveal progress
    const revealElapsed = currentTime - revealStartTime.current;
    const revealProgress = Math.min(revealElapsed / revealDuration, 1.0);

    // Ease out the reveal animation
    const easedProgress = 1 - Math.pow(1 - revealProgress, 3);

    // Map progress to reveal factor (0 = fully hidden, higher values = more revealed)
    // We want to start from center (0) and expand outward (higher values)
    const revealFactor = easedProgress * 4.0; // Doubled the radius for larger coverage

    if (revealProgress >= 1.0 && isRevealing) {
      setIsRevealing(false);
    }

    dofPointsMaterial.uniforms.uTime.value = currentTime;

    dofPointsMaterial.uniforms.uFocus.value = focus;
    dofPointsMaterial.uniforms.uBlur.value = aperture;

    // Always keep transition active when hovering (introspect)
    easing.damp(
      dofPointsMaterial.uniforms.uTransition,
      "value",
      introspect ? 1.0 : 0.0,
      introspect ? 0.35 : 0.2,
      delta
    );

    simulationMaterial.uniforms.uTime.value = currentTime;
    simulationMaterial.uniforms.uNoiseScale.value = noiseScale;
    simulationMaterial.uniforms.uNoiseIntensity.value = noiseIntensity;
    simulationMaterial.uniforms.uTimeScale.value = timeScale * speed;

    // Find the most recent active ripple
    let activeRipple: Ripple | null = null;
    let rippleAge = -1.0;
    
    if (ripples.length > 0) {
      // Get the most recent ripple
      const mostRecent = ripples[ripples.length - 1];
      const age = (currentTimeMs - mostRecent.startTime) / 1000.0; // Convert to seconds
      
      if (age < 1.5) { // Ripple is active for 1.5 seconds
        activeRipple = mostRecent;
        rippleAge = age;
      }
    }
    
    // Update point material uniforms
    dofPointsMaterial.uniforms.uPointSize.value = pointSize;
    dofPointsMaterial.uniforms.uOpacity.value = opacity;
    dofPointsMaterial.uniforms.uRevealFactor.value = revealFactor;
    dofPointsMaterial.uniforms.uRevealProgress.value = easedProgress;
    dofPointsMaterial.uniforms.uMousePosition.value = [mousePosition.x, mousePosition.y];
    
    // Update ripple uniforms
    if (activeRipple) {
      dofPointsMaterial.uniforms.uRippleTime.value = rippleAge;
      dofPointsMaterial.uniforms.uRippleOrigin.value = activeRipple.origin;
    } else {
      dofPointsMaterial.uniforms.uRippleTime.value = -1.0; // Disable ripple
      dofPointsMaterial.uniforms.uRippleOrigin.value = [mousePosition.x, mousePosition.y];
    }
  });

  return (
    <>
      {createPortal(
        // @ts-ignore
        <mesh material={simulationMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[positions, 3]}
            />
            <bufferAttribute attach="attributes-uv" args={[uvs, 2]} />
          </bufferGeometry>
        </mesh>,
        // @ts-ignore
        scene
      )}
      {/* @ts-ignore */}
      <points material={dofPointsMaterial} {...props}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particles, 3]} />
        </bufferGeometry>
      </points>

      {/* Plane showing simulation texture */}
      {/* <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={target.texture} />
      </mesh> */}
    </>
  );
}
