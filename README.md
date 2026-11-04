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
  services/algorithm_provider.py   ALGORITHMS: name -> function
  static_algorithms/           one file per algorithm
frontend/
  index.html, style.css, script.js
```

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/algorithms` | – | `["inorder", ...]` |
| POST | `/tree` | `{"values": [10, 5, 12]}` | `{"root": {"value": 10, "left": {...}, "right": {...}}}` |
| POST | `/algorithms/{name}` | `{"values": [10, 5, 12]}` | `{"tree": {...}, "steps": [5, 10, 12]}` |

Errors: `422` invalid input (message in `detail`), `404` unknown algorithm, `501` not implemented yet.

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
  - a new algorithm = new file in `static_algorithms/` + one line in `ALGORITHMS`
- **Git**: `git pull` before you start, one branch per task, pull request to `main`. Commit messages in English.

## Tasks

The algorithm contract (Person 1, first two tasks) goes first, Person 2 builds on it.
Person 3 can start right away: `POST /tree` and `POST /algorithms/inorder` already work.

### Person 1 — Backend API: ______

- [ ] Add optional `target: int | None` to `TreeRequest`; return `422` when an algorithm needs it and it is missing
- [ ] Switch `algorithm_provider.py` and the router to the `(tree, target) -> (steps, result)` contract, add `result` to `AlgorithmResult`
- [ ] `GET /algorithms` returns `[{"name": "bst_search", "needs_target": true}, ...]` so the frontend knows when to show the target input
- [ ] Register all 9 algorithms in `ALGORITHMS` as Person 2 finishes them
- [ ] Endpoint tests: `uv add --dev pytest httpx`, cover 200, 422 (duplicates, too long), 404
- [ ] When done: help Person 3 with the step animation

### Person 2 — Algorithms: ______

- [ ] Fix imports in all `static_algorithms/` files: `backend.models.tree` → `models.tree`
- [ ] Bring every algorithm to the contract (record `steps`, return `result`):
  - [ ] `inorder` (works, only needs the new return format)
  - [ ] `preorder`
  - [ ] `postorder`
  - [ ] `bfs`
  - [ ] `bst_search` (uses `target`)
  - [ ] `dfs_search` (uses `target`)
  - [ ] `calculate_tree_height`
  - [ ] `calculate_subtree_sum`
  - [ ] `count_nodes_and_leaves`
- [ ] Unit test per algorithm with the expected results below

### Person 3 — Frontend: ______

- [ ] `script.js`: parse the textarea (`1,2,3` or `1 2 3`) into numbers, update `#count`, Submit → `POST /tree`, Reset → clear
- [ ] Insert / remove a single value; every change resends the whole list and redraws
- [ ] Draw the tree into `<svg id="tree">` from `tree.root` (tip: x = in-order index, y = depth), respect the settings panel (orientation, node/link shape, radius, color)
- [ ] Algorithm dropdown filled from `GET /algorithms`, target input when `needs_target`
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
