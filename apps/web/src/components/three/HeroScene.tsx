import { useMemo, useRef, useState } from 'react';
import { Canvas, type ThreeElements, useFrame } from '@react-three/fiber';
import { ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';
import { type MascotMood, useMascot } from '../../stores/mascot';

/**
 * The 3D hero: Nova plus a few floating snacks, all built from primitives (no model files to
 * download). Toon shading keeps the sticker look of the 2D art. The canvas only renders while
 * visible, and the scene is only loaded on capable devices.
 */

function useToonGradient() {
  return useMemo(() => {
    const tones = new Uint8Array([90, 160, 225, 255]);
    const texture = new THREE.DataTexture(tones, tones.length, 1, THREE.RedFormat);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }, []);
}

function Toon({ color, gradient, ...rest }: { color: string; gradient: THREE.Texture } & ThreeElements['meshToonMaterial']) {
  return <meshToonMaterial color={color} gradientMap={gradient} {...rest} />;
}

function starShape() {
  const shape = new THREE.Shape();
  const spikes = 5;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 0.32 : 0.14;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = -Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function NovaMascot({ gradient, hovering }: { gradient: THREE.Texture; hovering: boolean }) {
  const mood = useMascot((s) => s.mood);
  const effective: MascotMood = hovering && mood === 'idle' ? 'hungry' : mood;
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const star = useRef<THREE.Mesh>(null);
  const pupils = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const eyes = useRef<THREE.Group>(null);
  const star3d = useMemo(() => new THREE.ExtrudeGeometry(starShape(), { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const g = root.current;
    if (!g || !head.current) return;

    // Look toward the cursor.
    const targetY = state.pointer.x * 0.6;
    const targetX = -state.pointer.y * 0.35;
    head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, targetY, 6, delta);
    head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, targetX, 6, delta);
    if (pupils.current) {
      pupils.current.position.x = THREE.MathUtils.damp(pupils.current.position.x, state.pointer.x * 0.07, 10, delta);
      pupils.current.position.y = THREE.MathUtils.damp(pupils.current.position.y, state.pointer.y * 0.06, 10, delta);
    }

    let y = Math.sin(t * 1.6) * 0.06;
    let spin = 0;
    let shake = 0;
    if (effective === 'happy') y = Math.abs(Math.sin(t * 7)) * 0.25;
    if (effective === 'celebrate') {
      y = Math.abs(Math.sin(t * 5)) * 0.55;
      spin = t * 4;
    }
    if (effective === 'worried') shake = Math.sin(t * 30) * 0.05;
    g.position.y = THREE.MathUtils.damp(g.position.y, y - 0.35, 12, delta);
    g.position.x = shake;
    g.rotation.y = effective === 'celebrate' ? spin : THREE.MathUtils.damp(g.rotation.y, 0, 4, delta);

    if (star.current) star.current.rotation.z += delta * (effective === 'celebrate' ? 8 : 1.2);

    const mouthOpen = effective === 'hungry' ? 1.6 + Math.sin(t * 12) * 0.35 : effective === 'happy' || effective === 'celebrate' ? 1.25 : 0.7;
    if (mouth.current) mouth.current.scale.y = THREE.MathUtils.damp(mouth.current.scale.y, mouthOpen, 10, delta);

    // Blink every few seconds; squint when happy.
    const blink = (t % 4) < 0.12 ? 0.1 : 1;
    const squint = effective === 'happy' || effective === 'celebrate' ? 0.45 : 1;
    if (eyes.current) eyes.current.scale.y = THREE.MathUtils.damp(eyes.current.scale.y, Math.min(blink, squint), 25, delta);
  });

  return (
    <group ref={root} position={[0, -0.35, 0]}>
      <group ref={head}>
        {/* body */}
        <mesh castShadow scale={[1, 0.93, 0.95]}>
          <sphereGeometry args={[1.15, 48, 48]} />
          <Toon color="#ff6a3d" gradient={gradient} />
        </mesh>
        {/* belly highlight */}
        <mesh position={[-0.35, 0.45, 0.8]} scale={[0.28, 0.14, 0.05]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color="#ffd2bd" transparent opacity={0.8} />
        </mesh>
        {/* eyes */}
        <group ref={eyes} position={[0, 0.18, 0.93]}>
          {[-0.38, 0.38].map((x) => (
            <mesh key={x} position={[x, 0, 0]} scale={[0.24, 0.28, 0.12]}>
              <sphereGeometry args={[1, 24, 24]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          ))}
          <group ref={pupils} position={[0, 0, 0.1]}>
            {[-0.38, 0.38].map((x) => (
              <mesh key={x} position={[x, -0.02, 0]} scale={[0.12, 0.14, 0.06]}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial color="#1b0f3b" />
              </mesh>
            ))}
          </group>
        </group>
        {/* cheeks */}
        {[-0.68, 0.68].map((x) => (
          <mesh key={x} position={[x, -0.18, 0.82]} scale={[0.18, 0.1, 0.05]}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial color="#ff7ac6" transparent opacity={0.7} />
          </mesh>
        ))}
        {/* mouth */}
        <mesh ref={mouth} position={[0, -0.3, 1.02]} scale={[0.22, 0.7, 0.08]}>
          <sphereGeometry args={[0.5, 24, 24]} />
          <meshBasicMaterial color="#1b0f3b" />
        </mesh>
        {/* antenna + star */}
        <mesh position={[0.05, 1.22, 0]} rotation={[0, 0, -0.15]}>
          <cylinderGeometry args={[0.035, 0.05, 0.45, 12]} />
          <Toon color="#e5471f" gradient={gradient} />
        </mesh>
        <mesh ref={star} geometry={star3d} position={[0.1, 1.55, -0.04]} castShadow>
          <Toon color="#ffc93c" gradient={gradient} emissive="#ffb300" emissiveIntensity={0.25} />
        </mesh>
        {/* arms */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 1.12, -0.3, 0.1]} rotation={[0, 0, side * (effective === 'celebrate' ? -2.4 : 0.5)]}>
            <capsuleGeometry args={[0.13, 0.35, 8, 16]} />
            <Toon color="#e5471f" gradient={gradient} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Burger({ gradient }: { gradient: THREE.Texture }) {
  return (
    <group scale={0.55}>
      <mesh position={[0, 0.42, 0]} scale={[1, 0.6, 1]}>
        <sphereGeometry args={[0.8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Toon color="#f4a340" gradient={gradient} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.86, 0.86, 0.08, 32]} />
        <Toon color="#5ccf59" gradient={gradient} />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[1.25, 0.05, 1.25]} />
        <Toon color="#ffd23c" gradient={gradient} />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 0.22, 32]} />
        <Toon color="#6b3a22" gradient={gradient} />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.8, 0.72, 0.2, 32]} />
        <Toon color="#f4a340" gradient={gradient} />
      </mesh>
    </group>
  );
}

function Donut({ gradient }: { gradient: THREE.Texture }) {
  const sprinkles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        const r = 0.5 + (i % 3) * 0.06;
        return { pos: [Math.cos(a) * r, 0.2, Math.sin(a) * r] as const, rot: a * 3, color: ['#c6f432', '#6c2bd9', '#fff7f0', '#2ec4a0'][i % 4]! };
      }),
    [],
  );
  return (
    <group scale={0.55} rotation={[Math.PI / 2.6, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.55, 0.26, 20, 48]} />
        <Toon color="#e9a441" gradient={gradient} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} scale={[1, 1, 0.7]}>
        <torusGeometry args={[0.55, 0.24, 20, 48]} />
        <Toon color="#ff7ac6" gradient={gradient} />
      </mesh>
      {sprinkles.map((s, i) => (
        <mesh key={i} position={s.pos as unknown as [number, number, number]} rotation={[0, s.rot, Math.PI / 2]}>
          <capsuleGeometry args={[0.025, 0.08, 4, 8]} />
          <meshBasicMaterial color={s.color} />
        </mesh>
      ))}
    </group>
  );
}

function Pizza({ gradient }: { gradient: THREE.Texture }) {
  return (
    <group scale={0.62} rotation={[0.9, 0.3, 0]}>
      <mesh>
        <cylinderGeometry args={[1, 1, 0.1, 32, 1, false, 0, Math.PI / 3.2]} />
        <Toon color="#ffcf5c" gradient={gradient} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[1.02, 1.02, 0.16, 32, 1, true, 0, Math.PI / 3.2]} />
        <Toon color="#e9973a" gradient={gradient} side={THREE.DoubleSide} />
      </mesh>
      {[
        [0.35, 0.62],
        [0.55, 0.3],
        [0.22, 0.28],
      ].map(([r, a], i) => (
        <mesh key={i} position={[Math.sin(a! * 1.6) * r! * 1.2, 0.07, Math.cos(a! * 1.6) * r! * 1.2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.04, 16]} />
          <Toon color="#e8243c" gradient={gradient} />
        </mesh>
      ))}
    </group>
  );
}

function Boba({ gradient }: { gradient: THREE.Texture }) {
  return (
    <group scale={0.5}>
      <mesh>
        <cylinderGeometry args={[0.55, 0.42, 1.4, 32]} />
        <meshStandardMaterial color="#fff7f0" transparent opacity={0.55} roughness={0.2} />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.5, 0.42, 1.05, 32]} />
        <Toon color="#c98a4a" gradient={gradient} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[Math.cos(i * 2.3) * 0.26, -0.55 + (i % 2) * 0.1, Math.sin(i * 2.3) * 0.26]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshBasicMaterial color="#2a1a14" />
        </mesh>
      ))}
      <mesh position={[0.15, 0.9, 0]} rotation={[0, 0, -0.2]}>
        <cylinderGeometry args={[0.06, 0.06, 1.1, 12]} />
        <Toon color="#6c2bd9" gradient={gradient} />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.58, 0.58, 0.08, 32]} />
        <Toon color="#ff4d2e" gradient={gradient} />
      </mesh>
    </group>
  );
}

function Snack({ position, children, onHover }: { position: [number, number, number]; children: React.ReactNode; onHover: (on: boolean) => void }) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const s = THREE.MathUtils.damp(ref.current.scale.x, hovered ? 1.25 : 1, 8, delta);
    ref.current.scale.setScalar(s);
    ref.current.rotation.y += delta * (hovered ? 2 : 0.4);
  });
  return (
    <Float speed={2} rotationIntensity={0.8} floatIntensity={1.2}>
      <group
        ref={ref}
        position={position}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover(true);
          document.body.style.cursor = 'grab';
        }}
        onPointerOut={() => {
          setHovered(false);
          onHover(false);
          document.body.style.cursor = '';
        }}
      >
        {children}
      </group>
    </Float>
  );
}

function Parallax({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, state.pointer.x * 0.15, 3, delta);
    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, -state.pointer.y * 0.08, 3, delta);
  });
  return <group ref={ref}>{children}</group>;
}

export default function HeroScene({ active }: { active: boolean }) {
  const gradient = useToonGradient();
  const [hovering, setHovering] = useState(false);
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.4, 8.2], fov: 35 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      aria-hidden
    >
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#fff7f0', '#6c2bd9', 0.6]} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <Parallax>
        <NovaMascot gradient={gradient} hovering={hovering} />
        <Snack position={[-2.05, 1.15, -0.6]} onHover={setHovering}>
          <Burger gradient={gradient} />
        </Snack>
        <Snack position={[2.05, 1.2, -0.8]} onHover={setHovering}>
          <Donut gradient={gradient} />
        </Snack>
        <Snack position={[-1.95, -1.0, 0.2]} onHover={setHovering}>
          <Pizza gradient={gradient} />
        </Snack>
        <Snack position={[1.95, -0.9, 0.3]} onHover={setHovering}>
          <Boba gradient={gradient} />
        </Snack>
      </Parallax>
      <ContactShadows position={[0, -1.65, 0]} opacity={0.35} scale={8} blur={2.4} far={3} />
    </Canvas>
  );
}
