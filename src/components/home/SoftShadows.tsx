import * as React from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

const pcss = ({ focus = 0, size = 25, samples = 10 } = {}) => `
#define PENUMBRA_FILTER_SIZE float(${size})
#define RGB_NOISE_FUNCTION(uv) (randRGB(uv))

vec3 randRGB(vec2 uv) {
  return vec3(
    fract(sin(dot(uv, vec2(12.75613, 38.12123))) * 13234.76575),
    fract(sin(dot(uv, vec2(19.45531, 58.46547))) * 43678.23431),
    fract(sin(dot(uv, vec2(23.67817, 78.23121))) * 93567.23423)
  );
}

vec3 lowPassRandRGB(vec2 uv) {
  vec3 result = vec3(0);
  result += RGB_NOISE_FUNCTION(uv + vec2(-1.0, -1.0));
  result += RGB_NOISE_FUNCTION(uv + vec2(-1.0,  0.0));
  result += RGB_NOISE_FUNCTION(uv + vec2(-1.0, +1.0));
  result += RGB_NOISE_FUNCTION(uv + vec2( 0.0, -1.0));
  result += RGB_NOISE_FUNCTION(uv + vec2( 0.0,  0.0));
  result += RGB_NOISE_FUNCTION(uv + vec2( 0.0, +1.0));
  result += RGB_NOISE_FUNCTION(uv + vec2(+1.0, -1.0));
  result += RGB_NOISE_FUNCTION(uv + vec2(+1.0,  0.0));
  result += RGB_NOISE_FUNCTION(uv + vec2(+1.0, +1.0));
  result *= 0.111111111; // 1.0 / 9.0
  return result;
}

vec3 highPassRandRGB(vec2 uv) {
  return RGB_NOISE_FUNCTION(uv) - lowPassRandRGB(uv) + 0.5;
}

vec2 pcssVogelDiskSample(int sampleIndex, int sampleCount, float angle) {
  const float goldenAngle = 2.399963f; // radians
  float r = sqrt(float(sampleIndex) + 0.5f) / sqrt(float(sampleCount));
  float theta = float(sampleIndex) * goldenAngle + angle;
  float sine = sin(theta);
  float cosine = cos(theta);
  return vec2(cosine, sine) * r;
}

float penumbraSize( const in float zReceiver, const in float zBlocker ) {
  return (zReceiver - zBlocker) / zBlocker;
}

float findBlocker(sampler2D shadowMap, vec2 uv, float compare, float angle) {
  float texelSize = 1.0 / float(textureSize(shadowMap, 0).x);
  float blockerDepthSum = float(${focus});
  float blockers = 0.0;

  int j = 0;
  vec2 offset = vec2(0.);
  float depth = 0.;

  #pragma unroll_loop_start
  for(int i = 0; i < ${samples}; i ++) {
    offset = (pcssVogelDiskSample(j, ${samples}, angle) * texelSize) * 2.0 * PENUMBRA_FILTER_SIZE;
    depth = texture2D( shadowMap, uv + offset).r;
    
    #ifdef USE_REVERSED_DEPTH_BUFFER
      depth = 1.0 - depth;
    #endif

    if (depth < compare) {
      blockerDepthSum += depth;
      blockers++;
    }
    j++;
  }
  #pragma unroll_loop_end

  if (blockers > 0.0) {
    return blockerDepthSum / blockers;
  }
  return -1.0;
}

float vogelFilter(sampler2D shadowMap, vec2 uv, float zReceiver, float filterRadius, float angle) {
  float texelSize = 1.0 / float(textureSize(shadowMap, 0).x);
  float shadow = 0.0f;
  int j = 0;
  vec2 vogelSample = vec2(0.0);
  vec2 offset = vec2(0.0);
  float depth = 0.0;

  #pragma unroll_loop_start
  for (int i = 0; i < ${samples}; i++) {
    vogelSample = pcssVogelDiskSample(j, ${samples}, angle) * texelSize;
    offset = vogelSample * (1.0 + filterRadius * float(${size}));
    depth = texture2D( shadowMap, uv + offset ).r;
    
    #ifdef USE_REVERSED_DEPTH_BUFFER
      shadow += step( depth, zReceiver );
    #else
      shadow += step( zReceiver, depth );
    #endif

    j++;
  }
  #pragma unroll_loop_end

  return shadow * 1.0 / ${samples}.0;
}

float PCSS (sampler2D shadowMap, vec4 coords) {
  vec2 uv = coords.xy;
  float zReceiver = coords.z;
  float angle = highPassRandRGB(gl_FragCoord.xy).r * PI2;
  float avgBlockerDepth = findBlocker(shadowMap, uv, zReceiver, angle);
  if (avgBlockerDepth == -1.0) {
    return 1.0;
  }
  float penumbraRatio = penumbraSize(zReceiver, avgBlockerDepth);
  return vogelFilter(shadowMap, uv, zReceiver, 1.25 * penumbraRatio, angle);
}
`;

function reset(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  scene.traverse((object: any) => {
    if (object.material) {
      gl.properties.remove(object.material);
      object.material.dispose?.();
    }
  });
  if (gl.info.programs) {
    gl.info.programs.length = 0;
  }
  gl.compile(scene, camera);
}

let mountCount = 0;
let originalShader: string | null = null;

export function SoftShadows({ focus = 0, samples = 10, size = 25 }: { focus?: number; samples?: number; size?: number }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  React.useEffect(() => {
    mountCount++;

    if (mountCount === 1) {
      originalShader = THREE.ShaderChunk.shadowmap_pars_fragment;
      
      // Inject the PCSS functions at the beginning of the USE_SHADOWMAP block
      let patched = originalShader.replace(
        "#ifdef USE_SHADOWMAP",
        "#ifdef USE_SHADOWMAP\n" + pcss({ size, samples, focus })
      );

      // Find the basic shadow return statement and replace it with our PCSS call
      patched = patched.replace(
        /shadow\s*=\s*step\(\s*shadowCoord\.z\s*,\s*depth\s*\);/g,
        "shadow = PCSS( shadowMap, shadowCoord );"
      ).replace(
        /shadow\s*=\s*step\(\s*depth\s*,\s*shadowCoord\.z\s*\);/g,
        "shadow = PCSS( shadowMap, shadowCoord );"
      );

      THREE.ShaderChunk.shadowmap_pars_fragment = patched;
      reset(gl, scene, camera);
    } else {
      // Force compile scene/camera to ensure proper shadow shader binding even if already patched
      reset(gl, scene, camera);
    }

    return () => {
      mountCount--;
      if (mountCount === 0 && originalShader !== null) {
        THREE.ShaderChunk.shadowmap_pars_fragment = originalShader;
        originalShader = null;
        reset(gl, scene, camera);
      }
    };
  }, [focus, size, samples, gl, scene, camera]);

  return null;
}
