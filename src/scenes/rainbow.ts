import * as THREE from "three";
import fragmentShader from "../shaders/rainbow.frag?raw";
import vertexShader from "../shaders/rainbow.vert?raw";

const MAX_PIXEL_RATIO = 1.5;

export function mountRainbow(canvas: HTMLElement) {
  // ----------------------
  // Three.js setup
  // ----------------------

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    100,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    5000,
  );
  camera.position.z = 300;
  camera.zoom = 2;
  camera.updateProjectionMatrix();

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
  });
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = 5;
  canvas.appendChild(renderer.domElement);

  let width = canvas.clientWidth;
  let height = canvas.clientHeight;

  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setSize(width, height);
  };
  resize();
  window.addEventListener("resize", resize);

  // ----------------------
  // Animated Mesh BG
  // ----------------------

  const background = new THREE.Object3D();
  scene.add(background);

  // Create shader material for wavy background
  const backgroundMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 0.1 },
      uNoiseFreq: { value: 2.0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uExposure: { value: renderer.toneMappingExposure },
    },
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
  });

  const backgroundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 600, 128, 128),
    backgroundMaterial,
  );

  // Update rotation for more dramatic angle
  backgroundMesh.rotation.set(-Math.PI * 0.05, 0, 0); // More tilted back and rotated
  backgroundMesh.position.set(0, 20, -100); // Move it down and back slightly
  background.add(backgroundMesh);

  // Add mouse position tracking
  const mouse = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  };

  // Update mouse position on move
  const handleMouseMove = (event: MouseEvent) => {
    // Convert mouse position to normalized device coordinates (-1 to +1)
    mouse.targetX = (event.clientX / width) * 2 - 1;
    mouse.targetY = -(event.clientY / height) * 2 + 1;
  };
  window.addEventListener("mousemove", handleMouseMove);

  // ----------------------
  // Render loop
  // ----------------------

  function animate() {
    backgroundMaterial.uniforms.uTime.value = performance.now() * 0.0003;
    // Update mouse position in shader
    backgroundMaterial.uniforms.uMouse.value.set(mouse.x, mouse.y);

    // Smooth interpolation of cursor position
    mouse.x += (mouse.targetX - mouse.x) * 0.1;
    mouse.y += (mouse.targetY - mouse.y) * 0.1;

    renderer.render(scene, camera);
  }

  const visibilityObserver = new IntersectionObserver(([entry]) => {
    renderer.setAnimationLoop(entry.isIntersecting ? animate : null);
  });
  visibilityObserver.observe(canvas);

  return () => {
    visibilityObserver.disconnect();
    window.removeEventListener("resize", resize);
    window.removeEventListener("mousemove", handleMouseMove);
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
