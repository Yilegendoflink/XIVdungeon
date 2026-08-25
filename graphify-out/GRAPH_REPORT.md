# Graph Report - XIVdungeon  (2026-08-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 284 nodes · 721 edges · 12 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4f1156d6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8

## God Nodes (most connected - your core abstractions)
1. `idx()` - 23 edges
2. `isValidState()` - 20 edges
3. `compilerOptions` - 19 edges
4. `generateFloor()` - 16 edges
5. `GameState` - 14 edges
6. `buildStructuredLayout()` - 14 edges
7. `isPassable()` - 14 edges
8. `setupInput()` - 11 edges
9. `isRecord()` - 11 edges
10. `attackEnemy()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `ItemDef` --references--> `ItemType`  [EXTRACTED]
  src/data/items.ts → src/game/state.ts
- `SaveBlob` --references--> `GameState`  [EXTRACTED]
  src/save/save.ts → src/game/state.ts
- `MapLayout` --references--> `TileKind`  [EXTRACTED]
  src/world/generate.ts → src/config.ts
- `EnemyDef` --references--> `EnemyType`  [EXTRACTED]
  src/data/enemies.ts → src/game/state.ts
- `isValidState()` --calls--> `getJobDefinition()`  [EXTRACTED]
  src/save/save.ts → src/data/jobs.ts

## Import Cycles
- None detected.

## Communities (12 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (41): SAVE_KEY, SAVE_VERSION, getJobDefinition(), JOB_DEFINITIONS, JobDefinition, JobId, JobResourceDefinition, createNewGame() (+33 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (43): idx(), addOptionalChord(), boundaryPoint(), branchSlots(), buildStructuredLayout(), carveRoom(), chooseEntranceRoom(), chooseExitRoom() (+35 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (27): BOSS_FLOOR_NUMBER, INVENTORY_SIZE, ITEM_DEFS, ITEM_TYPES, ItemDef, applyFloorModifiers(), heroOnExit(), BuffState (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (24): DEFAULT_PLAYER_JOB, MAP_H, MAP_W, NORMAL_FLOOR_COUNT, PLAYER_ASSET_DIR, playerTexturePath(), RENDER_SCALE, TILE_SIZE (+16 more)

### Community 4 - "Community 4"
Cohesion: 0.19
Nodes (28): ENEMY_TYPES, hasSave(), isCoordinate(), isEnemyType(), isFiniteNumber(), isInteger(), isItemType(), isMapPosition() (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (25): DOM, DOM.Iterable, ES2020, node, src, compilerOptions, allowImportingTsExtensions, baseUrl (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (23): dependencies, pixi.js, rot-js, devDependencies, @types/node, typescript, vite, vitest (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.23
Nodes (17): VIEW_RADIUS, inBounds(), isPassable(), blockedSet(), bombAct(), cactuarAct(), manhattan(), morbolAct() (+9 more)

### Community 8 - "Community 8"
Cohesion: 0.22
Nodes (16): ENEMY_DEFS, ENEMY_FLOOR_RULES, EnemyDef, EnemyFloorRule, getEnemyFloorRule(), RewardRange, enemyName(), EnemyType (+8 more)

## Knowledge Gaps
- **69 isolated node(s):** `JobDefinition`, `JobResourceDefinition`, `UIHandles`, `ConnectionKind`, `CorridorLayout` (+64 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `idx()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 7`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `GameState` connect `Community 2` to `Community 0`, `Community 3`, `Community 4`, `Community 7`, `Community 8`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `GameRenderer` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `isValidState()` (e.g. with `isTileKind()` and `isValidBuff()`) actually correct?**
  _`isValidState()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `JobDefinition`, `JobResourceDefinition`, `UIHandles` to the rest of the system?**
  _69 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10106382978723404 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09393939393939393 - nodes in this community are weakly interconnected._