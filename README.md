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
5. **All tree logic lives in the backend.** It also returns node positions (`layout`),
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
  models/requests.py           TreeRequest  {"values": [...], "target": ...}
  models/responses.py          TreeView, AlgorithmResult, AlgorithmInfo, Layout
  api/routers/tree.py          POST /tree
  api/routers/algorithms.py    GET /algorithms, POST /algorithms/{name}
  services/algorithm_provider.py   ALGORITHMS: name -> AlgorithmSpec(algorithm, needs_target)
  services/layout.py           node positions (x, y) and edges for drawing
  static_algorithms/           one file per algorithm (9 files)
frontend/
  index.html     input panel (textarea, Submit, Reset), code editor (#code-editor), tree canvas <svg id="tree"> with settings
  script.js      API calls, insert/remove, running algorithms, step animation, drawing from `layout`
  style.css
  compiler-worker.js   (planned) Web Worker that runs the user's Python code with Pyodide
```

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/algorithms` | – | `[{"name": "inorder", "needs_target": false}, ...]` |
| POST | `/tree` | `{"values": [10, 5, 12]}` | `{"tree": {...}, "layout": {...}}` |
| POST | `/algorithms/{name}` | `{"values": [10, 5, 12], "target": 12}` | `{"tree": {...}, "layout": {...}, "steps": [...], "result": ...}` |

`target` is optional and only needed when `needs_target` is `true`.

Errors: `422` invalid input or missing `target` (message in `detail`), `404` unknown algorithm.

> **Partly working:** `inorder`, `preorder`, `postorder` and `bfs` work. `bst_search`, `dfs_search`, `calculate_tree_height`,
> `calculate_subtree_sum` and `count_nodes_and_leaves` return `500` until they get the new signature (they still expect a node).

### Response format

Example of `POST /algorithms/inorder` for `[10, 5, 12, 15, 16]`:

```json
{
  "tree": {"root": {"value": 10, "left": {...}, "right": {...}}},
  "layout": {
    "nodes": [
      {"value": 5,  "x": 0, "y": 1},
      {"value": 10, "x": 1, "y": 0},
      {"value": 12, "x": 2, "y": 1},
      {"value": 15, "x": 3, "y": 2},
      {"value": 16, "x": 4, "y": 3}
    ],
    "edges": [[10, 5], [10, 12], [12, 15], [15, 16]]
  },
  "steps": [5, 10, 12, 15, 16],
  "result": null
}
```

- `x` = position in in-order (0, 1, 2, ...), `y` = depth (root = 0). Nodes never overlap because every node gets its own `x`.
- The frontend multiplies `x`/`y` by its spacing in pixels. Vertical orientation = swap `x` and `y`.
- `edges` are `[parent, child]` pairs: draw a line between their positions.
- `steps` and `result` only in `POST /algorithms/{name}`.

## Compiler (custom algorithms)

Users write their own algorithm in Python in the code editor. It runs **in the browser with
[Pyodide](https://pyodide.org)** (Python compiled to WebAssembly), never on the server, so user code can't touch the backend.

```
POST /tree ──► backend ──► {"tree": {...}, "layout": {...}}
Web Worker with Pyodide ◄── tree JSON + target + user code
  Python in the browser: build Node objects from the JSON → my_algorithm(tree, target) → (steps, result)
same animation as the built-in algorithms
```

The user code follows the same contract as the built-in algorithms, so the animation works the same way.
Template in the editor:

```python
def my_algorithm(tree, target=None):
    steps = []

    def visit(node):
        if node is None:
            return
        steps.append(node.value)  # every append = one highlighted step
        visit(node.left)
        visit(node.right)

    visit(tree.root)
    return steps, None
```

- Available to the user: `tree.root`, `node.value`, `node.left`, `node.right`, `node.parent` (same names as in the backend)
- Runs in a Web Worker, so an infinite loop doesn't freeze the page; after 3 s the worker is terminated
- Python errors are shown under the editor with the line number
- Every value in `steps` must exist in `layout.nodes`, otherwise there is nothing to highlight

## Conventions

- **Imports** are relative to `backend/`: `from models.tree import BinaryTree`, not `from backend.models.tree ...`.
  In PyCharm mark `backend/` as *Sources Root* (right click → Mark Directory as).
- **Algorithm contract** (the router calls every algorithm like this):

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

State on 2026-11-05:

- ✅ `POST /tree` returns the tree and `layout`, `GET /algorithms` lists all 9 algorithms with `needs_target`
- ✅ `(tree, target) -> (steps, result)` contract in the router, `inorder`, `preorder`, `postorder`, `bfs` work
- ❌ `bst_search`, `dfs_search`, `calculate_tree_height`, `calculate_subtree_sum`, `count_nodes_and_leaves` return `500` (old signatures)
- ✅ `script.js` talks to the backend: Submit builds and draws the tree from `layout`; insert/remove, algorithms, animation and errors are written
- ❌ `script.js` looks for 10 elements that are missing in `index.html` (list in Person 3 tasks).
  It stops with an error at the first one (`insertButton.addEventListener`), so everything wired after it doesn't work yet
- ✅ ASCII panel replaced by a code editor panel; the compiler itself is not started

Person 2 moves the remaining 5 algorithms to the contract, Person 3 adds the missing elements,
Person 1 builds the compiler.

### Person 1 — Backend API: ______

- [x] `AlgorithmSpec(algorithm, needs_target)` in `algorithm_provider.py`
- [x] Fix `POST /algorithms/{name}`: the router calls `spec.algorithm`; type hint `ALGORITHMS: dict[str, AlgorithmSpec]`
- [x] Add optional `target: int | None` to `TreeRequest`; return `422` when `spec.needs_target` and `target` is missing
- [x] Switch the router to the `(tree, target) -> (steps, result)` contract, add `result` to `AlgorithmResult`
- [x] `GET /algorithms` returns `[{"name": "bst_search", "needs_target": true}, ...]` so the frontend knows when to show the target input
- [x] Register `calculate_tree_height` (all 9 are in `ALGORITHMS`)
- [x] Layout: `services/layout.py` computes `{"nodes": [{value, x, y}], "edges": [[parent, child]]}` (format in *Response format*),
  `layout` is in the responses of `POST /tree` and `POST /algorithms/{name}`

**Compiler (Pyodide, in the browser, see *Compiler* section):**

- [ ] `frontend/compiler-worker.js`: Web Worker that loads Pyodide from the CDN with a pinned version
  (`importScripts("https://cdn.jsdelivr.net/pyodide/v<version>/full/pyodide.js")`, check the current version on pyodide.org)
- [ ] Start loading when the page opens; *Run* stays disabled with "Loading Python…" until Pyodide is ready
- [ ] Python prelude in the worker: `Node` (`value`, `left`, `right`, `parent`) and `Tree` (`root`) built from the `tree` JSON of `POST /tree`.
  Run it separately from the user code so error line numbers match the editor
- [ ] Run the user's `my_algorithm(tree, target)` and send `(steps, result)` back to the page as JSON
- [ ] Time limit 3 s: `worker.terminate()`, start a new worker, show "Time limit exceeded"
- [ ] Show Python errors (traceback) under the editor
- [ ] Check `steps`: every value must exist in `layout.nodes`
- [ ] Hand `steps` and `result` to Person 3's animation function
- [ ] Optional: show `print()` output with `pyodide.setStdout(...)`

### Person 2 — Algorithms: ______

- [x] Fix imports in all `static_algorithms/` files: `backend.models.tree` → `models.tree`
- [x] `bfs`: missing `deque` import and `node.lelft` typo
- [ ] Bring every algorithm to the contract `(tree, target=None) -> (steps, result)`:
  - [x] `inorder`, `preorder`, `postorder`, `bfs`: return `(steps, None)` (done with the contract switch)
  - [ ] `bst_search`, `dfs_search`: take `(node, target)` and return a `Node` → take the tree, record visited values, return `(steps, found value or None)`
  - [ ] `calculate_tree_height`, `calculate_subtree_sum`, `count_nodes_and_leaves`: take a node and return only the number → take the tree, record visited values, return `(steps, number)`
- [ ] Check every algorithm against the expected results below (e.g. with `backend/test_main.http`)

### Person 3 — Frontend: ______

- [x] Page layout: input panel, code editor panel, tree canvas with settings
- [x] Submit sends the list to `POST /tree` and draws the result
- [x] Draw the tree into `<svg id="tree">` from `layout` with the settings (orientation, node/link shape, radius, color)
- [x] Remove the ASCII panel
- [x] Show API errors to the user (`#error`)
- [ ] **Add the elements `script.js` expects to `index.html`:** `#single-value`, `#insert-btn`, `#remove-btn`,
  `#algorithm`, `#target`, `#run-btn`, `#play-btn`, `#next-btn`, `#restart-btn`, `#speed`.
  The code below is already in `script.js`, but can't work until these exist:
  - [ ] Insert / remove a single value (every change resends the whole list and redraws)
  - [ ] Algorithm dropdown filled from `GET /algorithms`, target input when `needs_target`
  - [ ] Animate `steps`: play / pause / next step / restart / speed, show `result`
  - [ ] Reset (it also clears `#single-value` and `#target`)
  - [ ] *Hide Settings* (`#download`)
- [ ] Move the animation start out of `runAlgorithm()` into a function like `showSteps(steps, result)`,
  so the compiler can reuse it

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

- Narrow `CORS_ORIGINS` in `core/config.py` before deploying.
