import {
    AmbientLight,
    BoxGeometry,
    Color,
    DirectionalLight,
    Fog,
    InstancedMesh,
    Matrix4,
    MeshStandardMaterial,
    PerspectiveCamera,
    Plane,
    Raycaster,
    Scene,
    SRGBColorSpace,
    Vector2,
    Vector3,
    WebGLRenderer,
} from "three";

// The organization landing's scene (components/landing/hero-scene.tsx loads this module, and
// three with it, only on / and only after hydration). A field of blocks — the headless
// primitives — breathing in a slow wave and rising towards the pointer; some of them carry a
// chromatic palette — the design system painting the primitives. Every colour is read from the
// palette variables on the host, so the scene follows the site's theme and never hard-codes one.

/** the field's size: fewer blocks on a small screen, where the scene is shown faded */
const FIELD = {
    large: { columns: 34, rows: 20 },
    small: { columns: 20, rows: 14 },
};
const GAP = 1.15;
/** the share of blocks a chromatic palette paints */
const PAINTED = 0.14;
const PALETTES = ["purple", "blue", "green", "rose", "orange"] as const;

export interface HeroScene {
    /** renders one frame (the reduced-motion scene, or a still after a recolour) */
    frame(): void;
    start(): void;
    stop(): void;
    /** reads the palette colours again (the site's theme changed) */
    recolour(): void;
    resize(): void;
    dispose(): void;
}

// A CSS colour (oklch, lab, …) as sRGB: the canvas 2D context resolves any colour the browser
// knows, three's parser does not.
function reader() {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    // a colour the browser cannot parse leaves fillStyle as it was: the sentinel, then
    const sentinel = "rgba(1, 2, 3, 0.5)";
    return (css: string, fallback: Color): Color => {
        if (!context || !css.trim()) return fallback.clone();
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = sentinel;
        const unset = context.fillStyle;
        context.fillStyle = css.trim();
        if (context.fillStyle === unset) return fallback.clone();
        context.fillRect(0, 0, 1, 1);
        const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
        return new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
    };
}

/** A palette's roles, read from a probe element carrying its class inside the host. */
function paletteRoles(host: HTMLElement, palette: string) {
    const probe = document.createElement("span");
    probe.className = `palette-${palette}`;
    probe.style.display = "none";
    host.append(probe);
    const style = getComputedStyle(probe);
    const roles = {
        base: style.getPropertyValue("--palette-base"),
        soft: style.getPropertyValue("--palette-soft"),
        line: style.getPropertyValue("--palette-line"),
        accent: style.getPropertyValue("--palette-accent"),
    };
    probe.remove();
    return roles;
}

// deterministic, so the painted blocks are the same on every load
function random(seed: number) {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

export function createHeroScene(
    host: HTMLElement,
    canvas: HTMLCanvasElement,
): HeroScene {
    const small = host.clientWidth < 640;
    // the context first: without one, three logs errors before it throws, and a page without
    // WebGL must stay quiet (three needs WebGL 2)
    const context = canvas.getContext("webgl2", {
        antialias: !small,
        alpha: true,
        powerPreference: "low-power",
    });
    if (!context) throw new Error("hero scene: no WebGL 2");
    const renderer = new WebGLRenderer({ canvas, context });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    const scene = new Scene();
    const camera = new PerspectiveCamera(38, 1, 0.1, 200);
    camera.position.set(0, 15, 22);
    camera.lookAt(0, 0, -2);

    const ambient = new AmbientLight(0xffffff, 1.4);
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(-8, 18, 10);
    scene.add(ambient, key);
    scene.fog = new Fog(0x000000, 18, 42);

    const { columns: COLUMNS, rows: ROWS } = small ? FIELD.small : FIELD.large;
    const count = COLUMNS * ROWS;
    const geometry = new BoxGeometry(0.92, 1, 0.92);
    const material = new MeshStandardMaterial({
        roughness: 0.55,
        metalness: 0.15,
    });
    const blocks = new InstancedMesh(geometry, material, count);
    scene.add(blocks);

    const next = random(7);
    const painted = Array.from({ length: count }, () =>
        next() < PAINTED
            ? (PALETTES[Math.floor(next() * PALETTES.length)] ?? null)
            : null,
    );
    const positions = Array.from({ length: count }, (_, index) => ({
        x: ((index % COLUMNS) - (COLUMNS - 1) / 2) * GAP,
        z: (Math.floor(index / COLUMNS) - (ROWS - 1) / 2) * GAP - 4,
    }));

    function recolour() {
        const read = reader();
        const surface = paletteRoles(host, "surface");
        const floor = read(surface.base, new Color(0x0b0d10));
        const neutral = read(surface.line, new Color(0x333333));
        const chromatic = Object.fromEntries(
            PALETTES.map((palette) => [
                palette,
                read(paletteRoles(host, palette).base, neutral),
            ]),
        );
        scene.fog?.color.copy(floor);
        for (let index = 0; index < count; index++) {
            const palette = painted[index];
            blocks.setColorAt(
                index,
                palette ? (chromatic[palette] ?? neutral) : neutral,
            );
        }
        if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;
    }

    // the pointer, projected onto the field's plane, only while the scene runs; leaving the
    // window lets the field settle
    let running = false;
    const away = new Vector3(999, 0, 999);
    const pointer = new Vector2(10, 10);
    const target = away.clone();
    const focus = away.clone();
    const plane = new Plane(new Vector3(0, 1, 0), 0);
    const raycaster = new Raycaster();
    const onLeave = () => target.copy(away);
    const onPointer = (event: PointerEvent) => {
        if (!running) return;
        const box = canvas.getBoundingClientRect();
        pointer.set(
            ((event.clientX - box.left) / box.width) * 2 - 1,
            -((event.clientY - box.top) / box.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, camera);
        if (!raycaster.ray.intersectPlane(plane, target)) target.copy(away);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    const matrix = new Matrix4();
    const start = performance.now();
    let last = 0;
    function layout(time: number) {
        // the same lean at any refresh rate: 8% of the way per 60th of a second
        const elapsed = Math.min(0.1, Math.max(0, time - last));
        last = time;
        focus.lerp(target, 1 - 0.92 ** (elapsed * 60));
        for (let index = 0; index < count; index++) {
            const { x, z } = positions[index] ?? { x: 0, z: 0 };
            const wave =
                Math.sin(x * 0.32 + time * 0.9) *
                    Math.cos(z * 0.28 + time * 0.7) *
                    0.9 +
                Math.sin((x + z) * 0.12 - time * 0.5) * 0.5;
            const distance = Math.hypot(x - focus.x, z - focus.z);
            const lift = Math.max(0, 1 - distance / 5) ** 2 * 3.2;
            const height = 1 + Math.max(0, wave + 1.4) * 0.9 + lift;
            matrix.makeScale(1, height, 1);
            matrix.setPosition(x, height / 2 - 1.5, z);
            blocks.setMatrixAt(index, matrix);
        }
        blocks.instanceMatrix.needsUpdate = true;
    }

    function frame() {
        layout((performance.now() - start) / 1000);
        renderer.render(scene, camera);
    }

    function resize() {
        const { clientWidth: width, clientHeight: height } = host;
        if (width === 0 || height === 0) return;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        // a narrow screen sees the field from further away
        camera.position.set(0, 15, width < 640 ? 30 : 22);
        camera.lookAt(0, 0, -2);
        camera.updateProjectionMatrix();
    }

    // a new pixel ratio with no new size (the window moved to another screen)
    let resolution: MediaQueryList | undefined;
    const onResolution = () => {
        resize();
        renderer.render(scene, camera);
        watchResolution();
    };
    function watchResolution() {
        resolution?.removeEventListener("change", onResolution);
        resolution = window.matchMedia(
            `(resolution: ${window.devicePixelRatio}dppx)`,
        );
        resolution.addEventListener("change", onResolution);
    }

    recolour();
    resize();
    watchResolution();

    return {
        frame,
        start: () => {
            running = true;
            renderer.setAnimationLoop(frame);
        },
        stop: () => {
            running = false;
            renderer.setAnimationLoop(null);
        },
        recolour: () => {
            recolour();
            renderer.render(scene, camera);
        },
        resize,
        dispose() {
            renderer.setAnimationLoop(null);
            window.removeEventListener("pointermove", onPointer);
            document.documentElement.removeEventListener(
                "pointerleave",
                onLeave,
            );
            resolution?.removeEventListener("change", onResolution);
            blocks.dispose();
            geometry.dispose();
            material.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
        },
    };
}
