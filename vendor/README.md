# Viewer dependency

- Package: `@google/model-viewer`
- Pinned version: `4.4.0`
- Retrieved: 2026-10-22
- Bundle source: https://unpkg.com/@google/model-viewer@4.4.0/dist/model-viewer.min.js
- Package source: https://www.npmjs.com/package/@google/model-viewer/v/4.4.0
- Upstream: https://github.com/google/model-viewer
- Main license: Apache-2.0 (included in LICENSE-model-viewer.txt)
- Bundle SHA-256: `18B2E711035AA4705EE281530A55DC2338FF05EED3D70AE16D54105282A75ED5`
- Bundled notices: retained inside the JavaScript; companion licenses in THIRD-PARTY-LICENSES.txt.

No runtime CDN import is used. The original source-map comment refers to the upstream development map, which is not included; it has no effect on normal page operation.

## Projects 3D viewer

- Package: `three`
- Pinned version: `0.180.0` (r180)
- Retrieved: 2026-10-24
- Official package metadata: https://registry.npmjs.org/three/0.180.0
- Archive source: https://registry.npmjs.org/three/-/three-0.180.0.tgz
- Upstream: https://github.com/mrdoob/three.js/tree/r180
- License: MIT (included in LICENSE-three.txt)
- Archive integrity: npm SHA-512 verified before extraction; the original archive and registry metadata are retained in the NOX redesign backup outside this website repository.
- Runtime files: `three.module.min.js`, `three.core.min.js`, and `OrbitControls.js`.
- Local modification: the single bare `from 'three'` import in OrbitControls.js is changed to `from './three.module.min.js'`. Both build files are otherwise byte-for-byte copies of the official package. No runtime package manager, import map, CDN fetch, or third-party network request is required for the 3D engine.
- File sizes, SHA-256 hashes and the archive integrity are recorded in `three-0.180.0.manifest.json`.

The Three.js copy embedded in the existing model-viewer bundle is independent of these ESM files. Its original notices remain in THIRD-PARTY-LICENSES.txt.
