let pyodide = null;

async function initPyodide() {
  if (pyodide) return pyodide;
  pyodide = await loadPyodide();
  return pyodide;
}

function makeWorkerCode(treeData, target, userCode) {
  return `
import json
import traceback

class Node:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None
        self.parent = None

class Tree:
    def __init__(self, root=None):
        self.root = root

def build_tree(data, parent=None):
    if data is None:
        return None
    node = Node(data["value"])
    node.parent = parent
    node.left = build_tree(data.get("left"), node)
    node.right = build_tree(data.get("right"), node)
    return node

tree_data = json.loads(${JSON.stringify(JSON.stringify(treeData))})
tree = Tree(build_tree(tree_data))
target = json.loads(${JSON.stringify(target === undefined ? null : target)})

${userCode}

if "my_algorithm" not in globals():
    raise Exception("Function my_algorithm(tree, target=None) not found")

result = my_algorithm(tree, target)
`;
}

self.onmessage = async (event) => {
  const { code, treeData, target } = event.data;

  try {
    const py = await initPyodide();

    let stdout = "";
    py.setStdout({
      batched: (s) => { stdout += s; }
    });

    py.setStderr({
      batched: (s) => { stdout += s; }
    });

    const script = makeWorkerCode(treeData, target, code);
    const result = await py.runPythonAsync(script);

    self.postMessage({
      stdout,
      result: result?.toJs ? result.toJs() : result,
      target
    });
  } catch (error) {
    self.postMessage({
      error: error.message || String(error),
      target
    });
  }
};

