import * as THREE from '../vendor/three.module.min.js';
import { OrbitControls } from '../vendor/OrbitControls.js';

const WHITE = 0xf3f6ff;
const RED = 0xff233f;
const TAU = Math.PI * 2;

function makeEnvironment(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const wash = ctx.createLinearGradient(0, 0, 0, 512);
  wash.addColorStop(0, '#172131');
  wash.addColorStop(.45, '#080b12');
  wash.addColorStop(1, '#252d39');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 1024, 512);
  // Large studio softboxes are reflected by the physical orb material.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(145, 82, 290, 72);
  ctx.fillStyle = '#c0cbdc';
  ctx.fillRect(735, 175, 35, 190);
  ctx.fillStyle = '#4f5c72';
  ctx.fillRect(390, 385, 260, 48);
  ctx.fillStyle = '#f42c45';
  ctx.fillRect(950, 230, 42, 100);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromEquirectangular(texture);
  texture.dispose();
  generator.dispose();
  return target;
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255,45,67,0.65)');
  glow.addColorStop(.18, 'rgba(255,30,55,0.24)');
  glow.addColorStop(.48, 'rgba(235,12,41,0.07)');
  glow.addColorStop(1, 'rgba(235,12,41,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function outlinedShape(shape, depth, material, lineMaterial) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: false, steps: 1, curveSegments: 1,
  });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, material));
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), lineMaterial));
  return group;
}

function makeFolder() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0x080c14, roughness: .42, metalness: .42,
    side: THREE.DoubleSide, transparent: true, opacity: .9,
  });
  const lineMaterial = new THREE.LineBasicMaterial({
    color: WHITE, transparent: true, opacity: .94, toneMapped: false,
  });
  const back = new THREE.Shape();
  back.moveTo(-.73, -.43);
  back.lineTo(-.73, .48);
  back.lineTo(-.23, .48);
  back.lineTo(-.08, .32);
  back.lineTo(.73, .32);
  back.lineTo(.73, -.43);
  back.closePath();
  group.add(outlinedShape(back, .11, material, lineMaterial));

  const lid = new THREE.Group();
  lid.position.set(0, -.43, .15);
  lid.rotation.x = .12;
  const front = new THREE.Shape();
  front.moveTo(-.73, 0);
  front.lineTo(-.73, .72);
  front.lineTo(.73, .72);
  front.lineTo(.73, 0);
  front.closePath();
  lid.add(outlinedShape(front, .035, material, lineMaterial));
  group.add(lid);

  // A pair of inset sheets becomes visible as the front opens.
  const sheets = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const sheet = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-.58, -.28, .13 + i * .025),
      new THREE.Vector3(-.58, .22 - i * .04, .13 + i * .025),
      new THREE.Vector3(.58, .22 - i * .04, .13 + i * .025),
      new THREE.Vector3(.58, -.28, .13 + i * .025),
    ]);
    sheets.add(new THREE.LineLoop(sheet, new THREE.LineBasicMaterial({
      color: 0xb5becf, transparent: true, opacity: .54,
    })));
  }
  group.add(sheets);
  const line = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-.51, .14, .19),
    new THREE.Vector3(-.15, .14, .19),
  ]);
  lid.add(new THREE.Line(line, lineMaterial));
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(.045, .045, .016),
    new THREE.MeshBasicMaterial({ color: RED, toneMapped: false }),
  );
  led.position.set(.52, .17, .045);
  lid.add(led);
  group.userData = { lid, lineMaterial, material, opening: 0 };
  return group;
}

function surfacePoint(x, y, radius) {
  return new THREE.Vector3(x, y, Math.sqrt(Math.max(0, radius * radius - x * x - y * y)));
}

function curvedSurface(outline, radius, holes = [], subdivisions = 3) {
  const shape = new THREE.Shape(outline.map(point => new THREE.Vector2(point[0], point[1])));
  for (const polygon of holes) shape.holes.push(new THREE.Path(polygon.map(point => new THREE.Vector2(point[0], point[1]))));
  const flat = new THREE.ShapeGeometry(shape, 1);
  const source = flat.getAttribute('position');
  const indices = flat.getIndex();
  const positions = [];
  const normals = [];
  function midpoint(a, b) {
    const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    // Keep subdivided hemisphere boundary vertices on the equator.
    if (Math.abs(Math.hypot(...a) - radius) < .00001 && Math.abs(Math.hypot(...b) - radius) < .00001) {
      const factor = radius / Math.hypot(...middle);
      middle[0] *= factor; middle[1] *= factor;
    }
    return middle;
  }
  function triangle(a, b, c, depth) {
    if (depth) {
      const ab = midpoint(a, b); const bc = midpoint(b, c); const ca = midpoint(c, a);
      triangle(a, ab, ca, depth - 1); triangle(ab, b, bc, depth - 1);
      triangle(ca, bc, c, depth - 1); triangle(ab, bc, ca, depth - 1);
      return;
    }
    for (const point of [a, b, c]) {
      const vector = surfacePoint(point[0], point[1], radius);
      positions.push(vector.x, vector.y, vector.z);
      normals.push(vector.x / radius, vector.y / radius, vector.z / radius);
    }
  }
  for (let i = 0; i < indices.count; i += 3) {
    const points = [0, 1, 2].map(offset => {
      const index = indices.getX(i + offset);
      return [source.getX(index), source.getY(index)];
    });
    triangle(...points, subdivisions);
  }
  flat.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

function recessedWall(outer, inner, outerRadius, innerRadius) {
  const positions = [];
  for (let edge = 0; edge < outer.length; edge++) {
    const next = (edge + 1) % outer.length;
    for (let step = 0; step < 8; step++) {
      const points = [];
      for (const [polygon, radius, amount] of [[outer, outerRadius, step / 8], [outer, outerRadius, (step + 1) / 8], [inner, innerRadius, step / 8], [inner, innerRadius, (step + 1) / 8]]) {
        points.push(surfacePoint(THREE.MathUtils.lerp(polygon[edge][0], polygon[next][0], amount), THREE.MathUtils.lerp(polygon[edge][1], polygon[next][1], amount), radius));
      }
      for (const index of [0, 2, 1, 1, 2, 3]) positions.push(...points[index].toArray());
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function makeOrb(glowTexture) {
  const group = new THREE.Group();
  const shell = new THREE.MeshPhysicalMaterial({
    color: 0x8993a2, metalness: .95, roughness: .23,
    clearcoat: 1, clearcoatRoughness: .12, envMapIntensity: 1.7,
  });
  // Trace the angular pair in images/nox-header-eyes.png, mirrored about the centre.
  const leftOutline = [[85, 64], [520, 192], [589, 255], [423, 239], [140, 136]]
    .map(([x, y]) => [(x - 800) * .000874, (160 - y) * .000874 + .05]);
  const outlines = [leftOutline, leftOutline.map(([x, y]) => [-x, y]).reverse()];
  const equator = Array.from({ length: 96 }, (_, index) => [.84 * Math.cos(index / 96 * TAU), .84 * Math.sin(index / 96 * TAU)]);
  // These are genuine openings in the curved metal surface, with a recessed back.
  const frontShell = new THREE.Mesh(curvedSurface(equator, .84, outlines, 4), shell);
  frontShell.name = 'nox-shell-front-with-eye-recesses';
  const rearShell = new THREE.Mesh(new THREE.SphereGeometry(.84, 64, 48, Math.PI, Math.PI), shell);
  rearShell.name = 'nox-shell-rear';
  group.add(frontShell, rearShell);
  const bezelMaterial = new THREE.MeshStandardMaterial({ color: 0x212734, roughness: .32, metalness: .9, side: THREE.DoubleSide });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0735, toneMapped: false });
  const eyes = outlines.map((outline, eyeIndex) => {
    const centre = outline.reduce((point, vertex) => [point[0] + vertex[0] / outline.length, point[1] + vertex[1] / outline.length], [0, 0]);
    const inset = outline.map(([x, y]) => [centre[0] + (x - centre[0]) * .94, centre[1] + (y - centre[1]) * .94]);
    const socket = new THREE.Mesh(recessedWall(outline, inset, .84, .812), bezelMaterial);
    socket.name = `nox-eye-${eyeIndex ? 'right' : 'left'}-socket`;
    const emitter = new THREE.Mesh(curvedSurface(inset, .812, [], 2), eyeMaterial);
    emitter.name = `nox-eye-${eyeIndex ? 'right' : 'left'}-emitter`;
    group.add(socket, emitter);
    const closed = { value: 0 };
    const minY = Math.min(...inset.map(point => point[1]));
    const maxY = Math.max(...inset.map(point => point[1]));
    const shutterMaterial = new THREE.MeshPhysicalMaterial({ color: 0x1c2430, metalness: .9, roughness: .25, clearcoat: .7 });
    shutterMaterial.onBeforeCompile = shader => {
      shader.uniforms.noxEyeClosed = closed;
      shader.vertexShader = 'varying float noxEyeY;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nnoxEyeY = position.y;');
      shader.fragmentShader = 'varying float noxEyeY;\nuniform float noxEyeClosed;\n' + shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (noxEyeY < mix(${(maxY + .001).toFixed(6)}, ${(minY - .001).toFixed(6)}, noxEyeClosed)) discard;`);
    };
    shutterMaterial.customProgramCacheKey = () => 'nox-angular-eye-shutter';
    const shutter = new THREE.Mesh(curvedSurface(inset, .815, [], 2), shutterMaterial);
    shutter.name = `nox-eye-${eyeIndex ? 'right' : 'left'}-shutter`;
    group.add(shutter);
    return { closed, baseClosed: 0 };
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0xff344c, transparent: true,
    opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.scale.set(2.7, 2.7, 1);
  halo.position.z = -.18;
  group.add(halo);
  const redLight = new THREE.PointLight(RED, 1.1, 5, 2);
  redLight.position.set(-1.2, -.2, -.85);
  group.add(redLight);
  group.userData = { eyes, halo, redLight, nextBlink: 5.8, blink: null };
  return group;
}

function disposeObject(object) {
  const geometries = new Set();
  const materials = new Set();
  object.traverse(child => {
    if (child.geometry) geometries.add(child.geometry);
    if (child.material) {
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        materials.add(material);
      }
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}

function projectId(project, index = 0) {
  return String(project.id ?? project._id ?? project.slug?.current ?? project.slug ?? index);
}

export function createProjectScene({
  container, onProjectClick = () => {}, onProjectHover = () => {}, onBackgroundClick = () => {},
  onFrame = () => {}, onStatus = () => {},
} = {}) {
  if (!container) throw new Error('The project viewer needs a container.');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.domElement.className = 'projects-webgl';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const environment = makeEnvironment(renderer);
  scene.environment = environment.texture;
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 150);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .085;
  controls.rotateSpeed = .55;
  controls.panSpeed = .65;
  controls.zoomSpeed = .7;
  controls.minPolarAngle = .3;
  controls.maxPolarAngle = Math.PI - .3;
  controls.screenSpacePanning = true;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  scene.add(new THREE.HemisphereLight(0xe3ecff, 0x1b1422, 2.5));
  const keyLight = new THREE.DirectionalLight(0xffffff, 4);
  keyLight.position.set(-3, 5, 5);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xa4b9db, 2);
  rimLight.position.set(4, -1, -3);
  scene.add(rimLight);

  const glowTexture = makeGlowTexture();
  const orb = makeOrb(glowTexture);
  scene.add(orb);
  const projectGroup = new THREE.Group();
  const pathGroup = new THREE.Group();
  scene.add(projectGroup, pathGroup);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const temp = new THREE.Vector3();
  const labelAnchor = new THREE.Vector3();
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let motionEnabled = !reducedQuery.matches;
  let width = 1;
  let height = 1;
  let nodes = [];
  let paths = [];
  let hoveredId = null;
  let visible = true;
  let destroyed = false;
  let frameHandle = 0;
  let lastTime = 0;
  let elapsed = 0;
  let pointerStart = null;
  const activePointers = new Set();
  let cameraDistance = 12;
  let initialEye = new THREE.Vector3(0, .6, 12);

  function makePath(node, index) {
    const destination = node.group.position;
    const xSign = Math.sign(destination.x) || 1;
    const ySign = Math.sign(destination.y) || 1;
    const points = [
      new THREE.Vector3(xSign * .73, ySign * .33, 0),
      new THREE.Vector3(destination.x * .5, ySign * .33, 0),
      new THREE.Vector3(destination.x * .5, destination.y, 0),
      new THREE.Vector3(destination.x, destination.y, destination.z - .1),
    ];
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: WHITE, transparent: true, opacity: .24 }),
    );
    pathGroup.add(line);
    const distances = [0];
    for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + points[i].distanceTo(points[i - 1]));
    const pulseMaterial = new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: .95, toneMapped: false });
    const pulseGeometry = new THREE.BufferGeometry();
    pulseGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    const pulse = new THREE.Line(pulseGeometry, pulseMaterial);
    pulse.frustumCulled = false;
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(.029, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff5267, toneMapped: false }),
    );
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: RED, transparent: true,
      opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(.4, .4, .4);
    pathGroup.add(pulse, dot, glow);
    return { id: node.id, points, distances, length: distances.at(-1), line, pulse, dot, glow, offset: index * .37 };
  }

  function pointAlong(path, amount, target) {
    const distance = THREE.MathUtils.clamp(amount, 0, 1) * path.length;
    for (let i = 1; i < path.distances.length; i++) {
      if (distance <= path.distances[i] || i === path.distances.length - 1) {
        const length = path.distances[i] - path.distances[i - 1];
        return target.copy(path.points[i - 1]).lerp(path.points[i], length ? (distance - path.distances[i - 1]) / length : 0);
      }
    }
    return target.copy(path.points[0]);
  }

  function clearPaths() {
    disposeObject(pathGroup);
    pathGroup.clear();
    paths = [];
  }

  function layout(reset = true) {
    const narrow = width / height < .95;
    const count = nodes.length;
    const extentX = narrow ? (count <= 2 ? 1.28 : Math.max(1.65, Math.sqrt(count) * .72)) : Math.max(3.6, Math.sqrt(count) * 1.15);
    const extentY = count <= 2 ? (narrow ? 2.85 : 1.8) : Math.max(1.8, extentX / THREE.MathUtils.clamp(width / height * .96, .48, 2));
    const ringCount = Math.max(1, Math.ceil(count / 12));
    const ringWeight = ringCount * (ringCount + 1) / 2;
    const ringSizes = Array.from({ length: ringCount }, (_, ring) => Math.floor(count * (ring + 1) / ringWeight));
    ringSizes[ringSizes.length - 1] += count - ringSizes.reduce((sum, size) => sum + size, 0);
    let denseSlots = [];
    if (count > 12) {
      const columns = narrow ? 3 : Math.max(4, Math.min(8, Math.round(Math.sqrt(count * width / height * 1.4))));
      let rows = Math.ceil(count / columns);
      do {
        denseSlots = [];
        for (let row = 0; row < rows; row++) {
          for (let column = 0; column < columns; column++) {
            const x = (column - (columns - 1) / 2) * (narrow ? 3 : 2.35);
            const y = ((rows - 1) / 2 - row) * 1.85;
            if (Math.abs(x) < 1.7 && Math.abs(y) < 3.1) continue;
            denseSlots.push({ x, y });
          }
        }
        if (denseSlots.length < count) rows++;
      } while (denseSlots.length < count);
      if (denseSlots.length > count) {
        // Remove the nearest opposing slots first, preserving an open central hub.
        const pairs = denseSlots.filter(point => point.y > 0 || (point.y === 0 && point.x > 0))
          .sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y));
        denseSlots = pairs.flatMap(point => [point, { x: -point.x, y: -point.y }]).slice(0, count)
          .sort((a, b) => b.y - a.y || a.x - b.x);
      }
    }
    nodes.forEach((node, index) => {
      let x;
      let y;
      if (count <= 2) {
        x = index === 0 ? -extentX : extentX;
        y = index === 0 ? extentY : -extentY;
      } else if (count > 12) {
        ({ x, y } = denseSlots[index]);
      } else {
        // Sparse collections occupy the perimeter; larger ones fill evenly spaced rings.
        let ring = 0;
        let ringIndex = index;
        while (ringIndex >= ringSizes[ring] && ring < ringSizes.length - 1) {
          ringIndex -= ringSizes[ring];
          ring++;
        }
        const angle = Math.PI * .75 + TAU * ringIndex / ringSizes[ring] + ring * .24;
        const radius = ringCount === 1 ? 1 : .58 + .42 * ring / (ringCount - 1);
        x = Math.cos(angle) * extentX * radius;
        y = Math.sin(angle) * extentY * radius;
      }
      node.group.position.set(x, y, index % 2 ? -.24 : .16);
      node.group.rotation.y = index % 2 ? -.06 : .06;
      node.group.scale.setScalar(Math.max(.68, 1 - Math.max(0, count - 8) * .027));
    });
    clearPaths();
    paths = nodes.map(makePath);
    if (reset) resetView();
  }

  function resetView() {
    const box = new THREE.Box3().setFromObject(projectGroup);
    box.expandByPoint(new THREE.Vector3(-1, -1.1, -1));
    box.expandByPoint(new THREE.Vector3(1, 1, 1));
    const size = box.getSize(new THREE.Vector3());
    const uiSpace = nodes.length > 12 ? (camera.aspect < .95 ? 220 : 150) : 0;
    const fitHeight = Math.max(height - uiSpace, height * .55);
    const vertical = (size.y + 1.9) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * height / fitHeight;
    const horizontal = (size.x + 1.8) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    cameraDistance = Math.max(8.5, vertical, horizontal);
    controls.target.set(0, -.15, 0);
    initialEye.set(.05, .48, cameraDistance);
    camera.position.copy(initialEye);
    controls.minDistance = Math.max(3, cameraDistance * .35);
    controls.maxDistance = Math.max(24, cameraDistance * 2.6);
    controls.update();
  }

  function resize() {
    const bounds = container.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const oldAspect = width / height;
    width = bounds.width;
    height = bounds.height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    layout(Math.abs(oldAspect - camera.aspect) > .08 || nodes.length === 0);
  }

  function emitHover(id) {
    if (hoveredId === id) return;
    hoveredId = id;
    renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
    onProjectHover(id);
  }

  function hitProject(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(projectGroup.children, true)[0];
    if (!hit) return null;
    let object = hit.object;
    while (object && object.parent !== projectGroup) object = object.parent;
    return object?.userData.projectId ?? null;
  }

  const onPointerDown = event => {
    activePointers.add(event.pointerId);
    if (activePointers.size === 1 && event.isPrimary) {
      pointerStart = { x: event.clientX, y: event.clientY, time: performance.now(), pointerId: event.pointerId, maxDistance: 0, multiple: false, button: event.button };
    } else if (pointerStart) pointerStart.multiple = true;
    renderer.domElement.style.cursor = 'grabbing';
  };
  const onPointerMove = event => {
    if (pointerStart?.pointerId === event.pointerId) {
      pointerStart.maxDistance = Math.max(pointerStart.maxDistance, Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y));
    }
    if (event.pointerType === 'touch' || event.buttons) return;
    emitHover(hitProject(event));
  };
  const onPointerUp = event => {
    if (pointerStart && !pointerStart.multiple && pointerStart.button === 0 && pointerStart.pointerId === event.pointerId && event.isPrimary && pointerStart.maxDistance < 7 && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) < 7 && performance.now() - pointerStart.time < 700) {
      const id = hitProject(event);
      if (id) onProjectClick(id, event);
      else onBackgroundClick(event);
    }
    activePointers.delete(event.pointerId);
    if (!activePointers.size || pointerStart?.pointerId === event.pointerId) pointerStart = null;
    renderer.domElement.style.cursor = hoveredId ? 'pointer' : 'grab';
  };
  const onPointerCancel = event => { activePointers.delete(event.pointerId); pointerStart = null; };
  const onPointerLeave = () => { emitHover(null); };
  const onContextLost = event => {
    event.preventDefault();
    onStatus({ type: 'context-lost', message: 'The 3D view paused. The project list is still available.' });
  };
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerCancel);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);

  function getScreenPoint(vector) {
    const projected = vector.clone().project(camera);
    return {
      x: (projected.x + 1) * width / 2,
      y: (1 - projected.y) * height / 2,
      visible: projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.3 && Math.abs(projected.y) < 1.3,
    };
  }

  function render(now) {
    frameHandle = 0;
    if (destroyed || document.hidden || !visible) return;
    const delta = lastTime ? Math.min((now - lastTime) / 1000, .05) : .016;
    lastTime = now;
    if (motionEnabled) elapsed += delta;
    controls.update();
    for (const node of nodes) {
      const target = node.id === hoveredId ? 1 : 0;
      node.group.userData.opening = THREE.MathUtils.damp(node.group.userData.opening, target, motionEnabled ? 12 : 60, delta);
      node.group.userData.lid.rotation.x = .12 + node.group.userData.opening * .72;
      node.group.userData.lineMaterial.opacity = .94 + node.group.userData.opening * .06;
    }
    for (const path of paths) {
      path.line.material.opacity = hoveredId === path.id ? .6 : .24;
      path.pulse.visible = path.dot.visible = path.glow.visible = motionEnabled;
      if (!motionEnabled) continue;
      const phase = (elapsed * .17 + path.offset) % 1;
      const opacity = Math.min(1, phase * 12, (1 - phase) * 12);
      const positions = path.pulse.geometry.attributes.position;
      for (let i = 0; i < 4; i++) {
        pointAlong(path, Math.max(0, phase - i * .016), temp);
        positions.setXYZ(i, temp.x, temp.y, temp.z);
      }
      positions.needsUpdate = true;
      pointAlong(path, phase, path.dot.position);
      path.glow.position.copy(path.dot.position);
      path.pulse.material.opacity = opacity;
      path.glow.material.opacity = opacity * .75;
    }
    const breath = motionEnabled ? .5 + .5 * Math.sin(elapsed * 1.9) : .5;
    orb.userData.halo.material.opacity = .45 + breath * .18;
    orb.userData.redLight.intensity = 1 + breath * .3;
    if (motionEnabled && elapsed >= orb.userData.nextBlink && !orb.userData.blink) {
      orb.userData.blink = { start: elapsed, side: 'both' };
      orb.userData.nextBlink = elapsed + 6.8;
    }
    orb.userData.eyes.forEach((eye, index) => {
      const blink = orb.userData.blink;
      const active = motionEnabled && blink && (blink.side === 'both' || blink.side === (index ? 'right' : 'left'));
      const phase = active ? (elapsed - blink.start - index * .018) / .26 : -1;
      const closure = phase >= 0 && phase <= 1 ? Math.sin(phase * Math.PI) ** 2 : 0;
      eye.closed.value = Math.max(eye.baseClosed, closure);
    });
    if (orb.userData.blink && elapsed - orb.userData.blink.start > .3) orb.userData.blink = null;
    renderer.render(scene, camera);
    camera.updateMatrixWorld();
    const projectedNodes = nodes.map(node => {
      labelAnchor.copy(node.group.position).add(new THREE.Vector3(0, -.69 * node.group.scale.y, .18));
      const screen = getScreenPoint(labelAnchor);
      return { id: node.id, ...screen, iconCenter: getScreenPoint(node.group.position), hovered: node.id === hoveredId, scale: cameraDistance / camera.position.distanceTo(node.group.position) };
    });
    onFrame(projectedNodes, { width, height, orb: getScreenPoint(new THREE.Vector3(0, -1.08, .1)) });
    frameHandle = requestAnimationFrame(render);
  }

  function resume() {
    if (!destroyed && !document.hidden && visible && !frameHandle) {
      lastTime = 0;
      frameHandle = requestAnimationFrame(render);
    }
  }
  const onVisibility = () => {
    if (document.hidden && frameHandle) {
      cancelAnimationFrame(frameHandle);
      frameHandle = 0;
    } else resume();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const observer = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    if (!visible && frameHandle) {
      cancelAnimationFrame(frameHandle);
      frameHandle = 0;
    } else resume();
  });
  observer.observe(container);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();
  resume();
  onStatus({ type: 'ready' });

  return {
    setProjects(projects = []) {
      emitHover(null);
      disposeObject(projectGroup);
      projectGroup.clear();
      nodes = projects.map((project, index) => {
        const id = projectId(project, index);
        const group = makeFolder();
        group.userData.projectId = id;
        projectGroup.add(group);
        return { id, project, group };
      });
      layout();
      resume();
    },
    setHovered(id) { hoveredId = id === null || id === undefined ? null : String(id); },
    focusProject(id) {
      const node = nodes.find(item => item.id === String(id));
      if (!node) return;
      const offset = camera.position.clone().sub(controls.target);
      controls.target.copy(node.group.position);
      camera.position.copy(controls.target).add(offset);
      hoveredId = node.id;
      controls.update();
    },
    resetView,
    setMotion(enabled) { motionEnabled = Boolean(enabled) && !reducedQuery.matches; },
    zoomBy(factor) {
      if (!Number.isFinite(factor) || factor <= 0) return;
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(offset);
      controls.update();
    },
    getCameraState() {
      return { position: camera.position.toArray(), target: controls.target.toArray(), zoom: camera.zoom, distance: camera.position.distanceTo(controls.target) };
    },
    getLayout() {
      return nodes.map(node => ({ id: node.id, position: node.group.position.toArray(), open: node.group.userData.opening }));
    },
    blink(side = 'both') {
      if (!motionEnabled || !['both', 'left', 'right'].includes(side)) return false;
      orb.userData.blink = { start: elapsed, side };
      orb.userData.nextBlink = elapsed + 6.8;
      return true;
    },
    setBotExpression(expression = 'neutral') {
      const values = typeof expression === 'object' && expression !== null ? expression : {
        neutral: { left: 0, right: 0 }, sleep: { left: 1, right: 1 },
        'wink-left': { left: 1, right: 0 }, 'wink-right': { left: 0, right: 1 },
      }[expression];
      if (!values) return false;
      orb.userData.eyes.forEach((eye, index) => { eye.baseClosed = THREE.MathUtils.clamp(Number(values[index ? 'right' : 'left']) || 0, 0, 1); });
      return true;
    },
    getBotState() {
      return { eyeStyle: 'nox-angular-inset', motionEnabled, eyes: orb.userData.eyes.map((eye, index) => ({ side: index ? 'right' : 'left', closed: eye.closed.value, baseClosed: eye.baseClosed })), blinkActive: Boolean(orb.userData.blink) };
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frameHandle);
      resizeObserver.disconnect();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      disposeObject(scene);
      environment.dispose();
      glowTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
