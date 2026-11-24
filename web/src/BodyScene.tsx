import type { ThreeEvent } from "@react-three/fiber";
import { Canvas } from "@react-three/fiber";
import {
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";

const REGION_COLOR: Record<string, string> = {
  Shoulders: "#85ddcf",
  "Arms & hands": "#edbd75",
  Neck: "#a7b4f1",
  Trunk: "#d996aa",
  "Legs & feet": "#a7c8a8",
};

function Part({
  region,
  onSelect,
  children,
}: {
  region: string;
  onSelect: (name: string) => void;
  children: ReactNode;
}) {
  const handle = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onSelect(region);
  };
  return (
    <group
      onPointerDown={handle}
      onClick={handle}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {children}
    </group>
  );
}

function Form({
  position,
  scale,
  region,
  selected,
  onSelect,
  geometry = "sphere",
}: {
  position: [number, number, number];
  scale: [number, number, number];
  region: string;
  selected: string;
  onSelect: (name: string) => void;
  geometry?: "sphere" | "capsule";
}) {
  return (
    <Part region={region} onSelect={onSelect}>
      <mesh position={position} scale={scale} castShadow receiveShadow>
        {geometry === "sphere" ? (
          <sphereGeometry args={[1, 24, 18]} />
        ) : (
          <capsuleGeometry args={[scale[0], scale[1], 8, 14]} />
        )}
        <meshStandardMaterial
          color={selected === region ? REGION_COLOR[region] : "#8faaa9"}
          roughness={0.72}
          metalness={0.08}
        />
      </mesh>
    </Part>
  );
}

export default function BodyScene({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (name: string) => void;
}) {
  const [rotation, setRotation] = useState<[number, number]>([0, 0.2]);
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(
    null,
  );
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      rx: rotation[0],
      ry: rotation[1],
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const nextX = drag.current.rx + (event.clientY - drag.current.y) * 0.006;
    const nextY = drag.current.ry + (event.clientX - drag.current.x) * 0.008;
    setRotation([Math.max(-0.75, Math.min(0.75, nextX)), nextY]);
  };
  const pointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <div
      className="body-3d"
      role="img"
      aria-label="Interactive illustrative occupational body map. Drag to rotate; select a highlighted region."
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerEnd}
      onPointerCancel={pointerEnd}
    >
      <Canvas
        camera={{ position: [0, 0.05, 5.15], fov: 40 }}
        dpr={[1, 1.5]}
        fallback={
          <p className="canvas-fallback">
            3D rendering is unavailable on this device. Use the region buttons
            below.
          </p>
        }
      >
        <color attach="background" args={["#101821"]} />
        <ambientLight intensity={1.7} />
        <directionalLight position={[3, 4, 4]} intensity={2.4} />
        <directionalLight
          position={[-3, 0, -2]}
          intensity={1.2}
          color="#7dcfc4"
        />
        <mesh position={[0, 1.62, 0]} castShadow>
          <sphereGeometry args={[0.22, 24, 18]} />
          <meshStandardMaterial color="#aab9b5" roughness={0.72} />
        </mesh>
        <group position={[0, -0.1, 0]} rotation={[rotation[0], rotation[1], 0]}>
          <Form
            region="Neck"
            selected={selected}
            onSelect={onSelect}
            position={[0, 1.3, 0]}
            scale={[0.13, 0.2, 0.12]}
          />
          <Form
            region="Shoulders"
            selected={selected}
            onSelect={onSelect}
            position={[0, 1.0, 0]}
            scale={[0.48, 0.25, 0.22]}
          />
          <Form
            region="Trunk"
            selected={selected}
            onSelect={onSelect}
            position={[0, 0.58, 0]}
            scale={[0.34, 0.55, 0.21]}
          />
          <Form
            region="Trunk"
            selected={selected}
            onSelect={onSelect}
            position={[0, 0.12, 0]}
            scale={[0.35, 0.21, 0.22]}
          />
          <Form
            region="Arms & hands"
            selected={selected}
            onSelect={onSelect}
            position={[-0.54, 0.56, 0]}
            scale={[0.11, 0.51, 0.1]}
          />
          <Form
            region="Arms & hands"
            selected={selected}
            onSelect={onSelect}
            position={[-0.68, 0.04, 0]}
            scale={[0.09, 0.46, 0.09]}
          />
          <Form
            region="Arms & hands"
            selected={selected}
            onSelect={onSelect}
            position={[-0.7, -0.42, 0]}
            scale={[0.11, 0.16, 0.1]}
          />
          <Form
            region="Arms & hands"
            selected={selected}
            onSelect={onSelect}
            position={[0.54, 0.56, 0]}
            scale={[0.11, 0.51, 0.1]}
          />
          <Form
            region="Arms & hands"
            selected={selected}
            onSelect={onSelect}
            position={[0.68, 0.04, 0]}
            scale={[0.09, 0.46, 0.09]}
          />
          <Form
            region="Arms & hands"
            selected={selected}
            onSelect={onSelect}
            position={[0.7, -0.42, 0]}
            scale={[0.11, 0.16, 0.1]}
          />
          <Form
            region="Legs & feet"
            selected={selected}
            onSelect={onSelect}
            position={[-0.2, -0.46, 0]}
            scale={[0.15, 0.62, 0.14]}
          />
          <Form
            region="Legs & feet"
            selected={selected}
            onSelect={onSelect}
            position={[-0.2, -1.08, 0]}
            scale={[0.105, 0.52, 0.11]}
          />
          <Form
            region="Legs & feet"
            selected={selected}
            onSelect={onSelect}
            position={[-0.2, -1.56, 0.1]}
            scale={[0.17, 0.11, 0.28]}
          />
          <Form
            region="Legs & feet"
            selected={selected}
            onSelect={onSelect}
            position={[0.2, -0.46, 0]}
            scale={[0.15, 0.62, 0.14]}
          />
          <Form
            region="Legs & feet"
            selected={selected}
            onSelect={onSelect}
            position={[0.2, -1.08, 0]}
            scale={[0.105, 0.52, 0.11]}
          />
          <Form
            region="Legs & feet"
            selected={selected}
            onSelect={onSelect}
            position={[0.2, -1.56, 0.1]}
            scale={[0.17, 0.11, 0.28]}
          />
        </group>
      </Canvas>
    </div>
  );
}
