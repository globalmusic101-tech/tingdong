# Edge voice compatibility

Tingdong uses a modified JavaScript port of edge-tts 7.3.1 `src/edge_tts/drm.py`
by rany and contributors, under LGPLv3. Upstream: https://github.com/rany2/edge-tts/tree/7.3.1
The upstream license is in edge-tts-LICENSE.txt; GPL-3.0.txt contains the incorporated GPL terms.

Modified source: `electron/edgeTokenV2.js` (2026-10-23). Changes: JavaScript unsigned
arithmetic, Node Buffer operations, compact SHA round loop, exported token generator.
The separate `electron/edgeCompatibility.js` integrates it with pinned msedge-tts 2.1.0.

These modules are distributed as readable, replaceable source under
`Tingdong.app/Contents/Resources/app/electron/`. To use a modified compatible module,
quit Tingdong, replace that source file, and reopen the app. Modification of this
library and reverse engineering to debug those modifications are permitted.
No Python runtime or browser credentials are required.
