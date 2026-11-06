import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs";

const pyodideReady = loadPyodide();

pyodideReady.then(
  () => self.postMessage({ type: "ready" }),
  (error) => self.postMessage({ type: "failed", error: `Python could not load: ${error.message || error}` })
);

const HARNESS = `
import json
import sys
import inspect
import traceback

TRACE_LIMIT = 1000


class Node:
    def __init__(self, value, left=None, right=None, parent=None):
        self.value = value
        self.left = left
        self.right = right
        self.parent = parent

    def __repr__(self):
        return f"Node({self.value})"


class BinaryTree:
    def __init__(self, root=None):
        self.root = root

    def __repr__(self):
        return "BinaryTree"


class _Printed:
    def __init__(self):
        self.chunks = []

    def write(self, text):
        self.chunks.append(text)
        return len(text)

    def flush(self):
        pass


def _build(data, parent=None):
    if data is None:
        return None
    node = Node(data["value"], parent=parent)
    node.left = _build(data.get("left"), node)
    node.right = _build(data.get("right"), node)
    return node


def _plain(value):
    return value.value if isinstance(value, Node) else value


def _short(value):
    text = repr(value)
    return text if len(text) <= 60 else text[:57] + "..."


def _snapshot(frame):
    current = None
    values = {}
    for name, value in frame.f_locals.items():
        if inspect.isfunction(value) or inspect.isclass(value) or inspect.ismodule(value):
            continue
        if isinstance(value, Node) and (current is None or name == "node"):
            current = value.value
        values[name] = _short(value)
    return current, values


def _tracer(frame, event, arg):
    if frame.f_code.co_filename != "algorithm.py":
        return None
    if event == "line" and len(_events) < TRACE_LIMIT:
        current, values = _snapshot(frame)
        _events.append({
            "line": frame.f_lineno,
            "func": frame.f_code.co_name,
            "node": current,
            "locals": values,
            "printed": len(_printer.chunks),
        })
    return _tracer


def _format(error):
    if isinstance(error, SyntaxError):
        return f"SyntaxError: {error.msg} (line {error.lineno})", error.lineno
    frames = [f for f in traceback.extract_tb(error.__traceback__) if f.filename == "algorithm.py"]
    line = frames[-1].lineno if frames else None
    where = f" (line {line})" if line else ""
    return f"{type(error).__name__}: {error}{where}", line


def _finish(payload):
    payload["trace"] = _events
    payload["printed"] = _printer.chunks
    payload["truncated"] = len(_events) >= TRACE_LIMIT
    return payload


def _failure(error):
    message, line = _format(error)
    return _finish({"error": message, "error_line": line})


def _execute():
    tree = BinaryTree(_build(json.loads(tree_json).get("root")))
    target = json.loads(target_json)
    namespace = {"__name__": "algorithm", "Node": Node, "BinaryTree": BinaryTree}
    try:
        exec(compile(user_code, "algorithm.py", "exec"), namespace)
    except Exception as error:
        return _failure(error)

    functions = [v for v in namespace.values() if inspect.isfunction(v) and v.__module__ == "algorithm"]
    if not functions:
        return _finish({"error": "Define a function, e.g. def my_algorithm(tree, target=None):", "error_line": None})
    chosen = namespace.get("my_algorithm")
    function = chosen if inspect.isfunction(chosen) else functions[-1]

    sys.settrace(_tracer)
    try:
        if len(inspect.signature(function).parameters) >= 2:
            output = function(tree, target)
        else:
            output = function(tree)
    except Exception as error:
        sys.settrace(None)
        return _failure(error)
    sys.settrace(None)

    if isinstance(output, tuple) and len(output) == 2:
        steps, result = output
    elif isinstance(output, list):
        steps, result = output, None
    else:
        steps, result = [], output

    return _finish({"name": function.__name__, "steps": [_plain(s) for s in (steps or [])], "result": _plain(result)})


def _run():
    global _events, _printer
    _events = []
    _printer = _Printed()
    previous = sys.stdout
    sys.stdout = _printer
    try:
        return _execute()
    finally:
        sys.settrace(None)
        sys.stdout = previous


json.dumps(_run(), default=str)
`;

self.onmessage = async ({ data }) => {
  const pyodide = await pyodideReady;
  const output = [];
  pyodide.setStdout({ batched: (line) => output.push(line) });
  pyodide.setStderr({ batched: (line) => output.push(line) });
  pyodide.globals.set("user_code", data.code);
  pyodide.globals.set("tree_json", JSON.stringify(data.tree));
  pyodide.globals.set("target_json", JSON.stringify(data.target ?? null));
  try {
    const response = JSON.parse(await pyodide.runPythonAsync(HARNESS));
    self.postMessage({ type: "done", output, ...response });
  } catch (error) {
    self.postMessage({ type: "done", output, error: String(error.message || error) });
  }
};