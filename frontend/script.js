const API_URL = "http://127.0.0.1:8000";
const SVG_NS = "http://www.w3.org/2000/svg";

const textarea = document.getElementById("textarea");
const countLabel = document.getElementById("count");
const submitButton = document.getElementById("submit-btn");
const resetButton = document.getElementById("reset-btn");
const singleValueInput = document.getElementById("single-value");
const insertButton = document.getElementById("insert-btn");
const removeButton = document.getElementById("remove-btn");
const algorithmSelect = document.getElementById("algorithm");
const targetInput = document.getElementById("target");
const runButton = document.getElementById("run-btn");
const playButton = document.getElementById("play-btn");
const nextButton = document.getElementById("next-btn");
const restartButton = document.getElementById("restart-btn");
const speedInput = document.getElementById("speed");
const stepsBox = document.getElementById("steps");
const resultLabel = document.getElementById("result");
const errorBox = document.getElementById("error");
const svg = document.getElementById("tree");
const settingsButton = document.getElementById("download");
const settingsRows = document.querySelectorAll(".SettingsRow");
const orientationSelect = document.getElementById("orientation");
const nodeShapeSelect = document.getElementById("nodeShape");
const linkShapeSelect = document.getElementById("linkShape");
const radiusInput = document.getElementById("nodeRadius");
const colorSelect = document.getElementById("nodeColor");
const codeEditor = document.getElementById("code-editor");
const codeTarget = document.getElementById("code-target");
const runCodeButton = document.getElementById("run-code-btn");
const codeOutput = document.getElementById("code-output");
const linePrevButton = document.getElementById("line-prev-btn");
const lineNextButton = document.getElementById("line-next-btn");
const linePlayButton = document.getElementById("line-play-btn");
const lineHighlight = document.getElementById("line-highlight");

const PYTHON_TIMEOUT_MS = 5000;
const PYTHON_LOAD_TIMEOUT_MS = 60000;
let pythonWorker = null;
let pythonReady = false;
let pendingRun = null;

const state = {
  values: [],
  tree: null,
  layout: null,
  algorithms: [],
  backendOnline: false,
  spec: null,
  steps: [],
  stepIndex: -1,
  result: null,
  timer: null,
  trace: null,
  traceIndex: -1,
  traceTimer: null,
  highlightLine: null,
  notFound: false,
};

class ApiError extends Error {}
class NetworkError extends Error {}

async function api(path, body) {
  const options =
    body === undefined
      ? {}
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  let response;
  try {
    response = await fetch(API_URL + path, options);
  } catch {
    throw new NetworkError(path);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(formatDetail(data && data.detail) || `Request failed (${response.status})`);
  }
  return data;
}

function formatDetail(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => String(d.msg || d).replace(/^Value error, /, "")).join("; ");
  }
  return JSON.stringify(detail);
}

function networkMessage(path) {
  if (state.backendOnline && path.startsWith("/algorithms/")) {
    return "Backend crashed while running this algorithm (500). It is probably not finished yet.";
  }
  return `Cannot reach backend at ${API_URL}. Start it in backend/: uv run uvicorn main:app --reload`;
}

function showError(error) {
  const message = error instanceof NetworkError ? networkMessage(error.message) : error.message;
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.textContent = "";
  errorBox.hidden = true;
}

async function guarded(action) {
  clearError();
  try {
    await action();
  } catch (error) {
    showError(error);
  }
}

function parseValues(text) {
  const tokens = text.replace(/[\[\]]/g, " ").split(/[\s,]+/).filter(Boolean);
  const invalid = tokens.filter((t) => !/^-?\d+$/.test(t));
  if (invalid.length > 0) {
    throw new ApiError(`Only whole numbers are allowed: ${invalid.join(", ")}`);
  }
  return tokens.map(Number);
}

function counting() {
  countLabel.textContent = "The number of tree nodes: " + state.values.length;
}

function setValues(values) {
  state.values = values;
  textarea.value = values.join(", ");
  counting();
}

function showTree(data) {
  state.tree = data.tree;
  state.layout = data.layout;
  drawTree();
}

async function buildTree(values) {
  const data = await api("/tree", { values });
  state.notFound = false;
  hideTrace();
  clearSteps();
  setValues(values);
  showTree(data);
}

async function submitTree() {
  await buildTree(parseValues(textarea.value));
}

async function insertValue() {
  const value = readSingleValue();
  if (state.values.includes(value)) throw new ApiError(`${value} is already in the tree`);
  await buildTree([...state.values, value]);
  singleValueInput.value = "";
}

async function removeValue() {
  const value = readSingleValue();
  if (!state.values.includes(value)) throw new ApiError(`${value} is not in the tree`);
  await buildTree(state.values.filter((v) => v !== value));
  singleValueInput.value = "";
}

function readSingleValue() {
  const raw = singleValueInput.value.trim();
  if (!/^-?\d+$/.test(raw)) throw new ApiError("Enter a whole number to insert or remove");
  return Number(raw);
}

function resetAll() {
  clearError();
  hideTrace();
  state.trace = null;
  state.notFound = false;
  clearSteps();
  setValues([]);
  state.layout = null;
  drawTree();
  if (singleValueInput) singleValueInput.value = "";
  targetInput.value = "";
}

function prettyName(name) {
  const upper = ["bfs", "dfs", "bst"];
  return name
    .split("_")
    .filter(Boolean)
    .map((w) => (upper.includes(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

async function loadAlgorithms() {
  const list = await api("/algorithms");
  state.algorithms = list;
  state.backendOnline = true;
  algorithmSelect.replaceChildren(...list.map((a) => new Option(prettyName(a.name), a.name)));
  updateTargetVisibility();
}

function selectedSpec() {
  return state.algorithms.find((a) => a.name === algorithmSelect.value) || null;
}

function updateTargetVisibility() {
  const spec = selectedSpec();
  targetInput.hidden = !(spec && spec.needs_target);
}

async function runAlgorithm() {
  const spec = selectedSpec();
  if (!spec) throw new ApiError("Algorithms are not loaded. Is the backend running?");
  const values = parseValues(textarea.value);
  if (values.length === 0) throw new ApiError("Enter some values first");
  const body = { values };
  if (spec.needs_target) {
    const raw = targetInput.value.trim();
    if (!/^-?\d+$/.test(raw)) throw new ApiError(`${prettyName(spec.name)} needs a whole-number target`);
    body.target = Number(raw);
  }
  stopAnimation();
  const data = await api(`/algorithms/${spec.name}`, body);
  state.notFound = spec.needs_target && (data.result ?? null) === null;
  setValues(values);
  showTree(data);
  showSteps(data.steps || [], data.result, spec);
}

function showSteps(steps, result, spec) {
  hideTrace();
  stopAnimation();
  state.spec = spec;
  state.steps = steps;
  state.stepIndex = -1;
  state.result = result ?? null;
  renderSteps();
  play();
}

function clearSteps() {
  stopAnimation();
  state.spec = null;
  state.steps = [];
  state.stepIndex = -1;
  state.result = null;
  renderSteps();
}

function stepDelay() {
  return 1300 - Number(speedInput.value) * 120;
}

function isFinished() {
  return state.steps.length > 0 && state.stepIndex >= state.steps.length - 1;
}

function startTimer() {
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    nextStep();
    if (isFinished()) stopAnimation();
  }, stepDelay());
  playButton.textContent = "Pause";
}

function play() {
  if (state.steps.length === 0) {
    renderSteps();
    return;
  }
  if (isFinished()) state.stepIndex = -1;
  nextStep();
  if (!isFinished()) startTimer();
}

function stopAnimation() {
  clearInterval(state.timer);
  state.timer = null;
  playButton.textContent = "Play";
}

function togglePlay() {
  if (state.timer) stopAnimation();
  else play();
}

function nextStep() {
  if (isFinished()) return;
  state.stepIndex++;
  drawTree();
  renderSteps();
}

function restartSteps() {
  stopAnimation();
  state.stepIndex = -1;
  drawTree();
  renderSteps();
}

function formatResult(result, spec = state.spec) {
  if (result === null || result === undefined) {
    return spec && spec.needs_target ? "Target not found" : "Done";
  }
  if (typeof result === "object") {
    return Object.entries(result)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }
  return String(result);
}

function renderSteps() {
  const hasSteps = state.steps.length > 0;
  playButton.disabled = !hasSteps;
  nextButton.disabled = !hasSteps;
  if (restartButton) restartButton.disabled = !hasSteps;
  stepsBox.replaceChildren(
    ...state.steps.map((value, i) => {
      const chip = document.createElement("span");
      chip.className = "StepChip";
      if (i < state.stepIndex) chip.classList.add("visited");
      if (i === state.stepIndex) chip.classList.add("current");
      chip.textContent = value;
      return chip;
    })
  );
  if (!state.spec) {
    resultLabel.textContent = "";
  } else if (!hasSteps) {
    resultLabel.textContent = `${prettyName(state.spec.name)} result: ${formatResult(state.result)}`;
  } else if (isFinished()) {
    resultLabel.textContent = `${prettyName(state.spec.name)} result: ${formatResult(state.result)}`;
  } else {
    resultLabel.textContent = `${prettyName(state.spec.name)}: step ${state.stepIndex + 1} / ${state.steps.length}`;
  }
}

function svgElement(tag, attributes) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function nodeStatus(value) {
  if (state.traceIndex >= 0) {
    const events = state.trace.events;
    if (events[state.traceIndex].node === value) return "current";
    for (let i = 0; i < state.traceIndex; i++) {
      if (events[i].node === value) return "visited";
    }
    return "idle";
  }
  if (state.stepIndex < 0) return "idle";
  const position = state.steps.indexOf(value);
  if (position === state.stepIndex) return "current";
  if (position !== -1 && position < state.stepIndex) return "visited";
  return "idle";
}

function searchFinished() {
  if (state.traceIndex >= 0) return state.traceIndex === state.trace.events.length - 1;
  return state.steps.length === 0 || isFinished();
}

function nodeColors(status, isRoot) {
  if (state.notFound && searchFinished()) return { fill: "#ef4444", text: "#ffffff" };
  if (colorSelect.value === "green") {
    if (status === "current") return { fill: "#111827", text: "#ffffff" };
    if (status === "visited") return { fill: "#9ca3af", text: "#111827" };
    return { fill: "#ffffff", text: "#111827" };
  }
  if (status === "current") return { fill: "#f59e0b", text: "#0f172a" };
  if (status === "visited") return { fill: "#22c55e", text: "#ffffff" };
  return isRoot ? { fill: "#2563eb", text: "#ffffff" } : { fill: "#93c5fd", text: "#0f172a" };
}

function linkPath(s, t, vertical) {
  const shape = linkShapeSelect.value;
  if (shape === "straight") return `M${s.x},${s.y}L${t.x},${t.y}`;
  if (vertical) {
    const mid = (s.y + t.y) / 2;
    if (shape === "diagonal") return `M${s.x},${s.y}C${s.x},${mid} ${t.x},${mid} ${t.x},${t.y}`;
    if (shape === "step") return `M${s.x},${s.y}V${mid}H${t.x}V${t.y}`;
    return `M${s.x},${s.y}H${t.x}V${t.y}`;
  }
  const mid = (s.x + t.x) / 2;
  if (shape === "diagonal") return `M${s.x},${s.y}C${mid},${s.y} ${mid},${t.y} ${t.x},${t.y}`;
  if (shape === "step") return `M${s.x},${s.y}H${mid}V${t.y}H${t.x}`;
  return `M${s.x},${s.y}V${t.y}H${t.x}`;
}

function drawTree() {
  svg.replaceChildren();
  const layout = state.layout;
  if (!layout || layout.nodes.length === 0) {
    svg.setAttribute("width", 0);
    svg.setAttribute("height", 0);
    return;
  }
  const radius = Math.min(30, Math.max(5, Number(radiusInput.value) || 13));
  const vertical = orientationSelect.value === "vertical";
  const gapAcross = radius * 2 + 16;
  const gapDepth = radius * 2 + 40;
  const padding = radius + 20;
  const rootDepth = Math.min(...layout.nodes.map((n) => n.y));
  const positions = new Map();
  let maxX = 0;
  let maxY = 0;
  for (const node of layout.nodes) {
    const across = padding + node.x * gapAcross;
    const depth = padding + node.y * gapDepth;
    const point = vertical ? { x: across, y: depth } : { x: depth, y: across };
    positions.set(node.value, point);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  svg.setAttribute("width", maxX + padding);
  svg.setAttribute("height", maxY + padding);

  const links = svgElement("g", { fill: "none", stroke: "#0f172a", "stroke-width": 1.5 });
  for (const [parent, child] of layout.edges) {
    links.append(svgElement("path", { d: linkPath(positions.get(parent), positions.get(child), vertical) }));
  }

  const nodes = svgElement("g", {});
  for (const node of layout.nodes) {
    const { x, y } = positions.get(node.value);
    const colors = nodeColors(nodeStatus(node.value), node.y === rootDepth);
    const shapeAttributes = { fill: colors.fill, stroke: "#0f172a", "stroke-width": 2 };
    const shape =
      nodeShapeSelect.value === "square"
        ? svgElement("rect", { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2, rx: 3, ...shapeAttributes })
        : svgElement("circle", { cx: x, cy: y, r: radius, ...shapeAttributes });
    const label = svgElement("text", {
      x,
      y,
      fill: colors.text,
      "font-size": Math.max(9, radius * 0.9),
      "font-weight": "bold",
      "text-anchor": "middle",
      "dominant-baseline": "central",
    });
    label.textContent = node.value;
    nodes.append(shape, label);
  }
  svg.append(links, nodes);
}

function setRunCodeState(label, disabled) {
  runCodeButton.textContent = label;
  runCodeButton.disabled = disabled;
  linePrevButton.disabled = disabled;
  lineNextButton.disabled = disabled;
  linePlayButton.disabled = disabled;
}

function startWorker() {
  pythonReady = false;
  setRunCodeState("Loading Python...", true);
  pythonWorker = new Worker("compiler.js", { type: "module" });
  pythonWorker.onmessage = ({ data }) => {
    if (data.type === "ready") {
      pythonReady = true;
      setRunCodeState("Run code", false);
    } else if (data.type === "failed") {
      failWorker(data.error);
    } else if (pendingRun) {
      pendingRun.finish(data);
    }
  };
  pythonWorker.onerror = (event) => {
    event.preventDefault();
    failWorker("Python could not load. Check your internet connection.");
  };
}

function failWorker(message) {
  if (pythonWorker) pythonWorker.terminate();
  pythonWorker = null;
  pythonReady = false;
  setRunCodeState("Retry Python", false);
  if (pendingRun) pendingRun.fail(message);
  else showCodeOutput([message], true);
}

function runPython(payload) {
  return new Promise((resolve, reject) => {
<<<<<<< HEAD
    const timer = setTimeout(() => {
      pendingRun = null;
      pythonWorker.terminate();
      startWorker();
      reject(new ApiError(`Time limit exceeded (${PYTHON_TIMEOUT_MS / 1000} s). Infinite loop?`));
    }, PYTHON_TIMEOUT_MS);
    pendingRun = {
      finish: (data) => {
        clearTimeout(timer);
        pendingRun = null;
        resolve(data);
      },
      fail: (message) => {
        clearTimeout(timer);
        pendingRun = null;
        reject(new ApiError(message));
      },
=======
    if (!pythonWorker) pythonWorker = new Worker("compiler.js");
    let timer = setTimeout(() => {
      stopWorker();
      reject(new ApiError("Python took too long to load. Check your connection and try again."));
    }, PYTHON_LOAD_TIMEOUT_MS);
    pythonWorker.onmessage = ({ data }) => {
      if (data.type === "loading") {
        codeOutput.textContent = "Loading Python...";
        return;
      }
      if (data.type === "started") {
        clearTimeout(timer);
        codeOutput.textContent = "Running...";
        timer = setTimeout(() => {
          stopWorker();
          reject(new ApiError(`Stopped after ${PYTHON_TIMEOUT_MS / 1000} s. Infinite loop?`));
        }, PYTHON_TIMEOUT_MS);
        return;
      }
      clearTimeout(timer);
      resolve(data);
    };
    pythonWorker.onerror = (event) => {
      event.preventDefault();
      clearTimeout(timer);
      stopWorker();
      reject(new ApiError(`Python worker failed: ${event.message || "unknown worker error"}`));
>>>>>>> 730151b (fix bugs in the compiler)
    };
    pythonWorker.postMessage(payload);
  });
}

function showCodeOutput(lines, failed) {
  codeOutput.textContent = lines.filter((line) => line !== "").join("\n");
  codeOutput.classList.toggle("failed", failed);
  codeOutput.scrollTop = codeOutput.scrollHeight;
}

function traceKey() {
  return [codeEditor.value, textarea.value.trim(), codeTarget.value.trim()].join("\u0000");
}

function printedLines(chunks) {
  return chunks.join("").split("\n");
}

function finalLines(response, spec) {
  if (response.error) return [response.error];
  return [`steps: [${response.steps.join(", ")}]`, `result: ${formatResult(response.result ?? null, spec)}`];
}

async function runCode(mode = "run") {
  clearError();
  if (!pythonWorker) startWorker();
  if (!pythonReady) throw new ApiError("Python is still loading, try again in a moment");
  const raw = codeTarget.value.trim();
  if (raw !== "" && !/^-?\d+$/.test(raw)) throw new ApiError("Target must be a whole number");
  const target = raw === "" ? null : Number(raw);
  const values = parseValues(textarea.value);
  if (values.length === 0) throw new ApiError("Enter some values first");
  if (!codeEditor.value.trim()) throw new ApiError("Write some code first");

  stopAnimation();
  hideTrace();
  const data = await api("/tree", { values });
  state.notFound = false;
  clearSteps();
  setValues(values);
  showTree(data);

  setRunCodeState("Running...", true);
  let response;
  try {
    response = await runPython({ code: codeEditor.value, tree: data.tree, target });
  } finally {
    if (pythonReady) setRunCodeState("Run code", false);
  }

  const spec = { name: response.name || "my_algorithm", needs_target: target !== null };
  state.notFound = target !== null && !response.error && (response.result ?? null) === null;
  const printed = printedLines(response.printed || []);
  state.trace = {
    key: traceKey(),
    events: response.trace || [],
    printed: response.printed || [],
    truncated: Boolean(response.truncated),
    response,
    spec,
  };

  if (!response.error) {
    const known = new Set(data.layout.nodes.map((n) => n.value));
    const unknown = response.steps.filter((value) => !known.has(value));
    if (unknown.length > 0) {
      response.error = `steps contain values that are not in the tree: ${unknown.join(", ")}`;
    }
  }

  if (mode === "step" && state.trace.events.length > 0) {
    state.traceIndex = 0;
    renderTrace();
    return;
  }
<<<<<<< HEAD
  if (response.error) {
    showCodeOutput([...response.output, ...printed, response.error], true);
    if (response.error_line) showLine(response.error_line);
    return;
  }
  showCodeOutput([...response.output, ...printed, ...finalLines(response, spec)], false);
  showSteps(response.steps, response.result, spec);
=======
  if (!Array.isArray(response.steps) || response.steps.some((value) => !data.layout.nodes.some((node) => node.value === value))) {
    showCodeOutput(["my_algorithm must return steps containing only values from the current tree."], true);
    return;
  }
  // Custom algorithms define their own result semantics; a null result does
  // not necessarily mean that a supplied target was absent.
  state.spec = { name: response.name, needs_target: false };
  state.steps = response.steps;
  state.result = response.result ?? null;
  showCodeOutput([...response.output, `steps: [${response.steps.join(", ")}]`, `result: ${formatResult(state.result)}`], false);
  renderSteps();
  play();
>>>>>>> 730151b (fix bugs in the compiler)
}

async function runCodeSafely(mode = "run") {
  try {
    await runCode(mode);
  } catch (error) {
    const message = error instanceof NetworkError ? networkMessage(error.message) : error.message;
    showCodeOutput([message], true);
  }
}

function lineMetrics() {
  const style = getComputedStyle(codeEditor);
  return { lineHeight: parseFloat(style.lineHeight), paddingTop: parseFloat(style.paddingTop) };
}

function positionHighlight() {
  if (!state.highlightLine) {
    lineHighlight.hidden = true;
    return;
  }
  const { lineHeight, paddingTop } = lineMetrics();
  lineHighlight.style.top = `${paddingTop + (state.highlightLine - 1) * lineHeight - codeEditor.scrollTop}px`;
  lineHighlight.style.height = `${lineHeight}px`;
  lineHighlight.hidden = false;
}

function showLine(line) {
  const { lineHeight, paddingTop } = lineMetrics();
  const top = paddingTop + (line - 1) * lineHeight;
  const view = codeEditor.clientHeight;
  if (top < codeEditor.scrollTop || top + lineHeight > codeEditor.scrollTop + view) {
    codeEditor.scrollTop = Math.max(0, top - view / 3);
  }
  state.highlightLine = line;
  positionHighlight();
}

function stopTracePlayback() {
  clearInterval(state.traceTimer);
  state.traceTimer = null;
  linePlayButton.textContent = "Play";
}

function hideTrace() {
  stopTracePlayback();
  state.traceIndex = -1;
  state.highlightLine = null;
  positionHighlight();
}

function invalidateTrace() {
  if (state.traceIndex >= 0 || state.highlightLine) {
    hideTrace();
    drawTree();
  }
  state.trace = null;
}

function renderTrace() {
  const { events, printed, response, spec, truncated } = state.trace;
  const event = events[state.traceIndex];
  const last = state.traceIndex === events.length - 1;
  showLine(event.line);
  drawTree();
  const lines = printedLines(printed.slice(0, last ? printed.length : event.printed));
  lines.push(`> line ${event.line} in ${event.func}()   [${state.traceIndex + 1} / ${events.length}]`);
  for (const [name, value] of Object.entries(event.locals)) lines.push(`  ${name} = ${value}`);
  if (last) {
    lines.push(...finalLines(response, spec));
    if (truncated) lines.push(`(trace stopped after ${events.length} lines)`);
  }
  showCodeOutput(lines, last && Boolean(response.error));
}

async function prepareTrace() {
  if (state.trace && state.trace.key === traceKey() && state.trace.events.length > 0) {
    return "existing";
  }
  await runCodeSafely("step");
  return state.traceIndex >= 0 ? "fresh" : "empty";
}

function moveTrace(delta) {
  const lastIndex = state.trace.events.length - 1;
  state.traceIndex = Math.min(lastIndex, Math.max(0, state.traceIndex + delta));
  renderTrace();
}

async function lineNext() {
  stopTracePlayback();
  if ((await prepareTrace()) === "existing") moveTrace(1);
}

async function linePrev() {
  stopTracePlayback();
  if ((await prepareTrace()) === "existing") moveTrace(-1);
}

async function linePlay() {
  if (state.traceTimer) {
    stopTracePlayback();
    return;
  }
  const status = await prepareTrace();
  if (status === "empty") return;
  if (status === "existing") {
    if (state.traceIndex >= state.trace.events.length - 1) state.traceIndex = -1;
    moveTrace(1);
  }
  if (state.traceIndex >= state.trace.events.length - 1) return;
  linePlayButton.textContent = "Pause";
  state.traceTimer = setInterval(() => {
    moveTrace(1);
    if (state.traceIndex >= state.trace.events.length - 1) stopTracePlayback();
  }, stepDelay());
}

function handleEditorTab(event) {
  if (event.key !== "Tab") return;
  event.preventDefault();
  const { selectionStart, selectionEnd, value } = codeEditor;
  codeEditor.value = value.slice(0, selectionStart) + "    " + value.slice(selectionEnd);
  codeEditor.selectionStart = codeEditor.selectionEnd = selectionStart + 4;
  invalidateTrace();
}

function toggleSettings() {
  const hide = settingsButton.textContent === "Hide Settings";
  settingsRows.forEach((row) => (row.hidden = hide));
  settingsButton.textContent = hide ? "Show Settings" : "Hide Settings";
}

submitButton.addEventListener("click", () => guarded(submitTree));
resetButton.addEventListener("click", resetAll);
insertButton?.addEventListener("click", () => guarded(insertValue));
removeButton?.addEventListener("click", () => guarded(removeValue));
singleValueInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") guarded(insertValue);
});
algorithmSelect.addEventListener("change", updateTargetVisibility);
runButton.addEventListener("click", () => guarded(runAlgorithm));
playButton.addEventListener("click", togglePlay);
nextButton.addEventListener("click", () => {
  stopAnimation();
  nextStep();
});
restartButton?.addEventListener("click", restartSteps);
speedInput.addEventListener("input", () => {
  if (state.timer) startTimer();
});
settingsButton.addEventListener("click", toggleSettings);
[orientationSelect, nodeShapeSelect, linkShapeSelect, colorSelect].forEach((s) => s.addEventListener("change", drawTree));
radiusInput.addEventListener("input", drawTree);
codeEditor.addEventListener("keydown", handleEditorTab);
runCodeButton.addEventListener("click", () => runCodeSafely("run"));
codeEditor.addEventListener("input", invalidateTrace);
codeEditor.addEventListener("scroll", positionHighlight);
lineNextButton.addEventListener("click", lineNext);
linePrevButton.addEventListener("click", linePrev);
linePlayButton.addEventListener("click", linePlay);
startWorker();

guarded(loadAlgorithms);
renderSteps();
