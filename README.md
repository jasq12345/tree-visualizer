# Tree Visualizer

Web app that builds a binary search tree from a list of numbers and animates tree algorithms step by step.
Backend: FastAPI (`backend/`). Frontend: plain HTML/CSS/JS (`frontend/`).

## Running locally

Backend (run from `backend/`, imports depend on it):

```bash
cd backend
uv sync
uv run uvicorn main:app --reload
```

- API: http://127.0.0.1:8000
- Interactive docs (try every endpoint): http://127.0.0.1:8000/docs
- Ready-made requests for PyCharm: `backend/test_main.http`

Frontend: open `frontend/index.html` with Live Server or PyCharm's built-in server. CORS is open, so any origin works.

## How it works

1. The frontend keeps the list of values, e.g. `[10, 5, 12, 15, 16]`. Inserting or removing a value only changes this list.
2. After every change the frontend sends the **whole list** to the backend. The backend builds the tree from scratch, nothing is stored on the server.
3. Tree rules: the first value is the root; each next value goes left if smaller, right if larger. Duplicates and lists longer than 50 are rejected with `422`.
4. An algorithm returns `steps` (node values in the order it visits them) and the frontend highlights them one by one.
5. **All tree logic lives in the backend.** It also returns node positions (`layout`) and a text drawing (`ascii`),
   so the frontend has no tree code at all: it only draws what it gets and plays the animation.

```
[10, 5, 12, 15, 16]  →      10
                           /  \
                          5    12
                                 \
                                  15
                                    \
                                     16
```

## Project structure

```
backend/
  main.py                      app, CORS, routers
  core/config.py               CORS_ORIGINS, MAX_NODES
  models/tree.py               Node, BinaryTree, BinaryTree.from_values
  models/requests.py           TreeRequest  {"values": [...]}
  models/responses.py          AlgorithmResult  {"tree": ..., "steps": [...]}
  api/routers/tree.py          POST /tree
  api/routers/algorithms.py    GET /algorithms, POST /algorithms/{name}
  services/algorithm_provider.py   ALGORITHMS: name -> AlgorithmSpec(algorithm, needs_target)
  services/execution_manager.py    empty, reserved for the compiler
  static_algorithms/           one file per algorithm (9 files)
frontend/
  index.html     input panel (textarea, Submit, Reset), tree canvas <svg id="tree"> with settings, ASCII panel
  script.js      counting(): counts the numbers in the textarea on Submit
  style.css
```

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/algorithms` | – | `["inorder", "preorder", ...]` |
| POST | `/tree` | `{"values": [10, 5, 12]}` | `{"root": {"value": 10, "left": {...}, "right": {...}}}` |
| POST | `/algorithms/{name}` | `{"values": [10, 5, 12]}` | `{"tree": {...}, "steps": [5, 10, 12]}` |

Errors: `422` invalid input (message in `detail`), `404` unknown algorithm, `501` not implemented yet.

> **Currently broken:** every `POST /algorithms/{name}` returns `500` (`TypeError: 'AlgorithmSpec' object is not callable`).
> The registry now holds `AlgorithmSpec` objects, but the router still calls the entry directly. First task of Person 1.

### Planned response (layout + ASCII)

Both `POST /tree` and `POST /algorithms/{name}` will also return `layout` and `ascii`, example for `[10, 5, 12, 15, 16]`:

```json
{
  "tree": {"root": {...}},
  "layout": {
    "nodes": [
      {"value": 10, "x": 1, "y": 0},
      {"value": 5,  "x": 0, "y": 1},
      {"value": 12, "x": 2, "y": 1},
      {"value": 15, "x": 3, "y": 2},
      {"value": 16, "x": 4, "y": 3}
    ],
    "edges": [[10, 5], [10, 12], [12, 15], [15, 16]]
  },
  "ascii": "    10\n   /  \\\n  5    12\n ...",
  "steps": [5, 10, 12, 15, 16],
  "result": null
}
```

- `x` = position in in-order (0, 1, 2, ...), `y` = depth (root = 0). Nodes never overlap because every node gets its own `x`.
- The frontend multiplies `x`/`y` by its spacing in pixels. Vertical orientation = swap `x` and `y`.
- `edges` are `[parent, child]` pairs: draw a line between their positions.
- `steps` and `result` only in `POST /algorithms/{name}`.

## Conventions

- **Imports** are relative to `backend/`: `from models.tree import BinaryTree`, not `from backend.models.tree ...`.
  In PyCharm mark `backend/` as *Sources Root* (right click → Mark Directory as).
- **Algorithm contract** (target version, see Person 1 tasks):

  ```python
  def bst_search(tree: BinaryTree, target: int | None = None) -> tuple[list[int], Any]:
      ...
      return steps, result
  ```

  - `steps`: node values in the order the algorithm visits them (used for the animation)
  - `result`: the answer, e.g. found value, height, `{"nodes": 5, "leaves": 2}`; `None` for traversals
  - a new algorithm = new file in `static_algorithms/` + one line in `ALGORITHMS`:

    ```python
    "bst_search": AlgorithmSpec(algorithm=bst_search, needs_target=True),
    ```
- **Git**: `git pull` before you start, one branch per task, pull request to `main`. Commit messages in English.

## Tasks

State on 2026-11-04:

- ✅ `POST /tree` builds the tree, `GET /algorithms` lists 8 algorithms
- ❌ `POST /algorithms/{name}` returns `500` (see API section)
- ✅ all algorithms import from `models.tree`, but still use their old signatures
- ✅ frontend layout (input, tree canvas, settings, ASCII panel), Submit counts the nodes; nothing talks to the backend yet

Person 1 fixes the router and the contract first, Person 2 builds on it.
Person 3 can start right away with `POST /tree`.

### Person 1 — Backend API: ______

- [x] `AlgorithmSpec(algorithm, needs_target)` in `algorithm_provider.py`
- [ ] Fix `POST /algorithms/{name}`: the router must call `spec.algorithm`, not the spec; change the type hint to `ALGORITHMS: dict[str, AlgorithmSpec]`
- [ ] Add optional `target: int | None` to `TreeRequest`; return `422` when `spec.needs_target` and `target` is missing
- [ ] Switch the router to the `(tree, target) -> (steps, result)` contract, add `result` to `AlgorithmResult`
- [ ] `GET /algorithms` returns `[{"name": "bst_search", "needs_target": true}, ...]` so the frontend knows when to show the target input
- [ ] Register `calculate_tree_height` (8 of 9 are in `ALGORITHMS`)
- [ ] Layout: `services/layout.py` computes `{"nodes": [{value, x, y}], "edges": [[parent, child]]}` (format in *Planned response*),
  add `layout` to the responses of `POST /tree` and `POST /algorithms/{name}`
- [ ] Add `ascii` to both responses (string from Person 2's renderer)
- [ ] Endpoint tests: `uv add --dev pytest httpx`, cover 200, 422 (duplicates, too long, missing target), 404
- [ ] When done: help Person 3 with the step animation

### Person 2 — Algorithms: ______

- [x] Fix imports in all `static_algorithms/` files: `backend.models.tree` → `models.tree`
- [x] `bfs`: missing `deque` import and `node.lelft` typo
- [ ] Bring every algorithm to the contract `(tree, target=None) -> (steps, result)`:
  - [ ] `inorder`, `preorder`, `postorder`, `bfs`: already return the visit order, only need to return `(steps, None)`
  - [ ] `bst_search`, `dfs_search`: take `(node, target)` and return a `Node` → take the tree, record visited values, return `(steps, found value or None)`
  - [ ] `calculate_tree_height`, `calculate_subtree_sum`, `count_nodes_and_leaves`: take a node and return only the number → take the tree, record visited values, return `(steps, number)`
- [ ] ASCII renderer: `services/ascii_renderer.py`, `render_ascii(tree) -> str`, drawing like the one in *How it works*
  (whitespace matters, the frontend shows it in a `<pre>`)
- [ ] Unit test per algorithm with the expected results below, plus the ASCII output for that list

### Person 3 — Frontend: ______

- [x] Page layout: input panel, tree canvas with settings, ASCII panel
- [x] Submit counts the nodes (`counting()` in `script.js`)
- [ ] Submit also sends the list to `POST /tree` and draws the result; Reset clears the textarea, count and tree.
  Reuse the `-?\d+` regex from `counting()` (note: `1.5` currently turns into `1` and `5`)
- [ ] Insert / remove a single value; every change resends the whole list and redraws
- [ ] Draw the tree into `<svg id="tree">` from `layout` (no tree logic in JS: circles at `x`/`y` × spacing, lines for `edges`),
  respect the settings (orientation, node/link shape, radius, color), make *Hide Settings* (`#download`) work.
  Until Person 1 adds `layout`, use the example from *Planned response* as mock data
- [ ] ASCII panel: put `ascii` from the response into `#ascii-output`, *Copy with spaces* (`#copy-ascii`) copies it
- [ ] Add an algorithm dropdown (not in `index.html` yet), filled from `GET /algorithms`, with a target input when `needs_target`
- [ ] Animate `steps`: highlight nodes in order, play / pause / next step / speed, show `result`
- [ ] Show API errors to the user (`detail` from `422`, e.g. duplicate values)

## Expected results for `[10, 5, 12, 15, 16]`

| Algorithm | steps | result |
|---|---|---|
| inorder | `[5, 10, 12, 15, 16]` | – |
| preorder | `[10, 5, 12, 15, 16]` | – |
| postorder | `[5, 16, 15, 12, 10]` | – |
| bfs | `[10, 5, 12, 15, 16]` | – |
| bst_search, target 15 | `[10, 12, 15]` | `15` |
| dfs_search, target 15 | `[10, 5, 12, 15]` | `15` |
| calculate_tree_height | visit order | `4` |
| calculate_subtree_sum | visit order | `58` |
| count_nodes_and_leaves | visit order | `{"nodes": 5, "leaves": 2}` |

## Later

- **Compiler** (users write their own algorithm): decide where the code runs. Never `exec()` user code inside the FastAPI process;
  run it in the browser (Pyodide) or in a separate sandboxed process with a timeout.
- Narrow `CORS_ORIGINS` in `core/config.py` before deploying.
