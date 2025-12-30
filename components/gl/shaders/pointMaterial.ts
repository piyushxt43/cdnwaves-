import * as THREE from 'three'
import { periodicNoiseGLSL } from './utils'

export class DofPointsMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader: /* glsl */ `
      uniform sampler2D positions;
      uniform sampler2D initialPositions;
      uniform float uTime;
      uniform float uFocus;
      uniform float uFov;
      uniform float uBlur;
      uniform float uPointSize;
      varying float vDistance;
      varying float vPosY;
      varying vec3 vWorldPosition;
      varying vec3 vInitialPosition;
      void main() { 
        vec3 pos = texture2D(positions, position.xy).xyz;
        vec3 initialPos = texture2D(initialPositions, position.xy).xyz;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        vDistance = abs(uFocus - -mvPosition.z);
        vPosY = pos.y;
        vWorldPosition = pos;
        vInitialPosition = initialPos;
        gl_PointSize = max(vDistance * uBlur * uPointSize, 3.0);
      }`,
      fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uRevealFactor;
      uniform float uRevealProgress;
      uniform float uTime;
      uniform vec2 uMousePosition;
      uniform float uRippleTime;
      uniform vec2 uRippleOrigin;
      varying float vDistance;
      varying float vPosY;
      varying vec3 vWorldPosition;
      varying vec3 vInitialPosition;
      uniform float uTransition;

      ${periodicNoiseGLSL}

      // Sparkle noise function for subtle brightness variations
      float sparkleNoise(vec3 seed, float time) {
        // Use initial position as seed for consistent per-particle variation
        float hash = sin(seed.x * 127.1 + seed.y * 311.7 + seed.z * 74.7) * 43758.5453;
        hash = fract(hash);
        
        // Slow time variation (time / 10) for gentle sparkle effect
        float slowTime = time * 1.0;
        
        // Create sparkle pattern using multiple sine waves with the hash as phase offset
        float sparkle = 0.0;
        sparkle += sin(slowTime + hash * 6.28318) * 0.5;
        sparkle += sin(slowTime * 1.7 + hash * 12.56636) * 0.3;
        sparkle += sin(slowTime * 0.8 + hash * 18.84954) * 0.2;
        
        // Create a different noise pattern to reduce sparkle frequency
        // Using different hash for uncorrelated pattern
        float hash2 = sin(seed.x * 113.5 + seed.y * 271.9 + seed.z * 97.3) * 37849.3241;
        hash2 = fract(hash2);
        
        // Static spatial mask to create sparse sparkles (no time dependency)
        float sparkleMask = sin(hash2 * 6.28318) * 0.7;
        sparkleMask += sin(hash2 * 12.56636) * 0.3;
        
        // Only allow sparkles when mask is positive (reduces frequency by ~70%)
        if (sparkleMask < 0.3) {
          sparkle *= 0.05; // Heavily dampen sparkle when mask is low
        }
        
        // Map sparkle to brightness with smooth exponential emphasis on high peaks only
        float normalizedSparkle = (sparkle + 1.0) * 0.5; // Convert [-1,1] to [0,1]
        
        // Create smooth curve: linear for low values, exponential for high values
        // Using pow(x, n) where n > 1 creates a curve that's nearly linear at low end, exponential at high end
        float smoothCurve = pow(normalizedSparkle, 4.0); // High exponent = dramatic high-end emphasis
        
        // Blend between linear (for low values) and exponential (for high values)
        float blendFactor = normalizedSparkle * normalizedSparkle; // Smooth transition weight
        float finalBrightness = mix(normalizedSparkle, smoothCurve, blendFactor);
        
        // Map to brightness range [0.7, 2.0] - conservative range with exponential peaks
        return 0.7 + finalBrightness * 1.3;
      }

      float sdCircle(vec2 p, float r) {
        return length(p) - r;
      }

      void main() {
        vec2 cxy = 2.0 * gl_PointCoord - 1.0;

        // Define triangle vertices (equilateral triangle)
        vec2 p0 = vec2(0.0, -0.8);     // top tip (flipped Y)
        vec2 p1 = vec2(-0.7, 0.4);     // bottom left (flipped Y)
        vec2 p2 = vec2(0.7, 0.4);      // bottom right (flipped Y)
        
        float sdf = sdCircle(cxy, 0.5);
        
        if (sdf > 0.0) discard;

        // Calculate distance from center for reveal effect
        float distanceFromCenter = length(vWorldPosition.xz);
        
        // Add noise to the reveal threshold for organic edge
        float noiseValue = periodicNoise(vInitialPosition * 4.0, 0.0);
        float revealThreshold = uRevealFactor + noiseValue * 0.3;
        
        // Create reveal mask based on distance from center (inverted for proper reveal)
        float revealMask = 1.0 - smoothstep(revealThreshold - 0.2, revealThreshold + 0.1, distanceFromCenter);
        
        // Calculate sparkle brightness multiplier
        float sparkleBrightness = sparkleNoise(vInitialPosition, uTime);
        
        // Convert world position to normalized screen space (0-1 range)
        // Map xz coordinates to screen space, assuming particles are in a -10 to 10 range
        vec2 screenPos = vec2(
          (vWorldPosition.x + 10.0) / 20.0,
          (vWorldPosition.z + 10.0) / 20.0
        );
        
        // Calculate distance from mouse position
        float mouseDistance = length(screenPos - uMousePosition);
        
        // Create glow effect that follows mouse (stronger when closer to mouse)
        float mouseGlow = 1.0 - smoothstep(0.0, 0.4, mouseDistance);
        mouseGlow = pow(mouseGlow, 1.5); // Make it more focused
        
        // RIPPLE EFFECT - Strong, visible ripples
        float rippleIntensity = 0.0;
        
        // Only process if ripple is active
        if (uRippleTime > 0.0 && uRippleTime < 1.5) {
          // Calculate distance from ripple origin
          float rippleDistance = length(screenPos - uRippleOrigin);
          
          // Create multiple ripple layers (3 concentric rings)
          for (int i = 0; i < 3; i++) {
            float layerOffset = float(i) * 0.12; // Stagger each layer
            float rippleTime = uRippleTime - layerOffset;
            
            if (rippleTime > 0.0 && rippleTime < 1.5) {
              // Calculate ripple wave - expanding outward
              float wave = rippleDistance - rippleTime * 0.7; // Ripple speed
              
              // Create strong wave pattern with multiple frequencies
              float ripple = abs(sin(wave * 10.0 - rippleTime * 8.0));
              ripple += abs(sin(wave * 15.0 - rippleTime * 12.0)) * 0.5; // Higher frequency detail
              ripple = clamp(ripple, 0.0, 1.0);
              
              // Create smooth falloff from center (ripples fade with distance)
              float falloff = 1.0 - smoothstep(0.0, 0.8, rippleDistance);
              
              // Create sharp ring effect (stronger at wave peaks)
              float ring = 1.0 - smoothstep(0.0, 0.08, abs(wave));
              ring = pow(ring, 2.5); // Sharper, more visible rings
              
              // Fade out over time
              float fade = 1.0 - smoothstep(0.0, 1.5, rippleTime);
              fade = pow(fade, 1.2); // Slower fade for more visibility
              
              // Combine all effects - make each layer progressively weaker
              float layerRipple = ripple * ring * falloff * fade * (1.0 - float(i) * 0.15);
              rippleIntensity += layerRipple;
            }
          }
        }
        
        // Make ripples VERY visible and strong
        rippleIntensity = pow(rippleIntensity, 0.6); // More pronounced
        rippleIntensity *= 2.0; // Strong amplification for visibility
        rippleIntensity = clamp(rippleIntensity, 0.0, 1.5); // Allow some over-brightness
        
        // Combine transition effect with mouse glow and ripples
        float glowIntensity = mouseGlow * 0.4 + (uTransition * 0.3) + rippleIntensity * 0.8;
        
        float alpha = (1.04 - clamp(vDistance, 0.0, 1.0)) * clamp(smoothstep(-0.5, 0.25, vPosY), 0.0, 1.0) * uOpacity * revealMask * uRevealProgress * sparkleBrightness;

        // Orange gradient tint - mix white with orange based on position and glow
        vec3 orangeTint = vec3(1.0, 0.5, 0.1); // Orange color
        vec3 baseColor = vec3(1.0, 0.7, 0.3); // Light orange base
        
        // Ripple color - brighter white/cyan for ripple effect
        vec3 rippleColor = vec3(1.0, 0.9, 0.7); // Bright warm white for ripples
        
        // Create gradient from center (more orange) to edges (less orange)
        float gradientFactor = 1.0 - distanceFromCenter * 0.2;
        gradientFactor = clamp(gradientFactor, 0.6, 1.0);
        
        // Mix base color with orange tint based on gradient and glow
        vec3 finalColor = mix(baseColor, orangeTint, gradientFactor * 0.4 + glowIntensity * 0.2);
        
        // Add ripple color overlay - make ripples very visible
        finalColor = mix(finalColor, rippleColor, rippleIntensity * 0.6);
        
        // Apply glow intensity to color brightness (ripples make it much brighter)
        finalColor *= (1.0 + glowIntensity * 0.6 + rippleIntensity * 0.8);
        
        gl_FragColor = vec4(finalColor, mix(alpha, sparkleBrightness - 1.1, uTransition));
      }`,
      uniforms: {
        positions: { value: null },
        initialPositions: { value: null },
        uTime: { value: 0 },
        uFocus: { value: 5.1 },
        uFov: { value: 50 },
        uBlur: { value: 30 },
        uTransition: { value: 0.0 },
        uPointSize: { value: 2.0 },
        uOpacity: { value: 1.0 },
        uRevealFactor: { value: 0.0 },
        uRevealProgress: { value: 0.0 },
        uMousePosition: { value: [0.5, 0.5] },
        uRippleTime: { value: -1.0 },
        uRippleOrigin: { value: [0.5, 0.5] }
      },
      transparent: true,
      // blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  }
}
