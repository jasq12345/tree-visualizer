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

const state = {
  values: [],
  layout: null,
  algorithms: [],
  backendOnline: false,
  spec: null,
  steps: [],
  stepIndex: -1,
  result: null,
  timer: null,
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
  state.layout = data.layout;
  drawTree();
}

async function buildTree(values) {
  const data = await api("/tree", { values });
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
  clearSteps();
  setValues([]);
  state.layout = null;
  drawTree();
  singleValueInput.value = "";
  targetInput.value = "";
}

function prettyName(name) {
  const upper = ["bfs", "dfs", "bst"];
  return name
    .split("_")
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
  setValues(values);
  state.spec = spec;
  state.steps = data.steps || [];
  state.stepIndex = -1;
  state.result = data.result ?? null;
  showTree(data);
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

function formatResult(result) {
  if (result === null || result === undefined) {
    return state.spec && state.spec.needs_target ? "Target not found" : "Done";
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
  restartButton.disabled = !hasSteps;
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
  if (state.stepIndex < 0) return "idle";
  const position = state.steps.indexOf(value);
  if (position === state.stepIndex) return "current";
  if (position !== -1 && position < state.stepIndex) return "visited";
  return "idle";
}

function nodeColors(status, isRoot) {
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

function handleEditorTab(event) {
  if (event.key !== "Tab") return;
  event.preventDefault();
  const { selectionStart, selectionEnd, value } = codeEditor;
  codeEditor.value = value.slice(0, selectionStart) + "    " + value.slice(selectionEnd);
  codeEditor.selectionStart = codeEditor.selectionEnd = selectionStart + 4;
}

function toggleSettings() {
  const hide = settingsButton.textContent === "Hide Settings";
  settingsRows.forEach((row) => (row.hidden = hide));
  settingsButton.textContent = hide ? "Show Settings" : "Hide Settings";
}

submitButton.addEventListener("click", () => guarded(submitTree));
resetButton.addEventListener("click", resetAll);
insertButton.addEventListener("click", () => guarded(insertValue));
removeButton.addEventListener("click", () => guarded(removeValue));
singleValueInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") guarded(insertValue);
});
algorithmSelect.addEventListener("change", updateTargetVisibility);
runButton.addEventListener("click", () => guarded(runAlgorithm));
playButton.addEventListener("click", togglePlay);
nextButton.addEventListener("click", () => {
  stopAnimation();
  nextStep();
});
restartButton.addEventListener("click", restartSteps);
speedInput.addEventListener("input", () => {
  if (state.timer) startTimer();
});
settingsButton.addEventListener("click", toggleSettings);
[orientationSelect, nodeShapeSelect, linkShapeSelect, colorSelect].forEach((s) => s.addEventListener("change", drawTree));
radiusInput.addEventListener("input", drawTree);
codeEditor.addEventListener("keydown", handleEditorTab);

guarded(loadAlgorithms);
renderSteps();