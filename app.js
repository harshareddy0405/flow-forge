const STORE = "flow-forge-canvas-v1";
const colors = {
  trigger: "#b8f36b",
  intelligence: "#a98cff",
  logic: "#ff9c64",
  action: "#72b7ff",
};
const icons = { trigger: "↯", intelligence: "✦", logic: "◇", action: "→" };
const blockLibrary = [
  {
    group: "Triggers",
    items: [
      { kind: "trigger", label: "Webhook", description: "Incoming event" },
      { kind: "trigger", label: "Schedule", description: "Time-based start" },
    ],
  },
  {
    group: "Intelligence",
    items: [
      {
        kind: "intelligence",
        label: "Extract insights",
        description: "Find useful signals",
      },
      {
        kind: "intelligence",
        label: "Generate copy",
        description: "Create content",
      },
    ],
  },
  {
    group: "Logic",
    items: [
      { kind: "logic", label: "Human review", description: "Approval gate" },
      { kind: "logic", label: "Condition", description: "Branch by rule" },
    ],
  },
  {
    group: "Actions",
    items: [
      { kind: "action", label: "Send message", description: "Email or Slack" },
      {
        kind: "action",
        label: "Save record",
        description: "Write to a system",
      },
    ],
  },
];

const recipes = {
  story: {
    title: "Signal-to-story engine",
    nodes: [
      ["trigger", "New source added", "Watch inbox & feeds", 65, 95],
      ["intelligence", "Extract insights", "Pull themes and evidence", 265, 65],
      ["intelligence", "Shape narrative", "Build a clear story arc", 465, 115],
      ["logic", "Editorial review", "Human approval gate", 665, 70],
      ["action", "Publish package", "Notion · Email · Slack", 855, 115],
    ],
  },
  support: {
    title: "Support triage loop",
    nodes: [
      ["trigger", "Ticket received", "Shared support inbox", 55, 100],
      [
        "intelligence",
        "Classify intent",
        "Topic · urgency · sentiment",
        235,
        55,
      ],
      ["logic", "Check severity", "Priority decision", 415, 105],
      ["intelligence", "Draft response", "Use approved knowledge", 595, 55],
      ["logic", "Agent review", "Human quality check", 775, 105],
      ["action", "Reply & route", "Help desk · owner", 955, 55],
    ],
  },
  research: {
    title: "Research pulse",
    nodes: [
      ["trigger", "Monday schedule", "09:00 local time", 65, 85],
      ["action", "Gather sources", "Five trusted inputs", 265, 125],
      ["intelligence", "Rank evidence", "Relevance · recency", 465, 65],
      ["intelligence", "Create briefing", "Synthesis with citations", 665, 115],
      ["action", "Archive & notify", "Workspace · Email", 865, 75],
    ],
  },
};

const $ = (q, p = document) => p.querySelector(q);
const $$ = (q, p = document) => [...p.querySelectorAll(q)];
const clone = (value) => JSON.parse(JSON.stringify(value));
const stored = safeParse(WorkspaceStorage.getItem(STORE));
let state = stored ? stored : createRecipe("story");
let selectedId = null;
let zoom = 0.75;
let history = [];
let running = false;

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
function createRecipe(key) {
  const recipe = recipes[key];
  return {
    title: recipe.title,
    runs: 3,
    nodes: recipe.nodes.map((n, i) => ({
      id: `${n[0]}_${Date.now().toString().slice(-4)}_${i}`,
      kind: n[0],
      label: n[1],
      description: n[2],
      x: n[3],
      y: n[4],
      mode: "balanced",
      temperature: 0.4,
      payload: '{"topic":"AI design tools"}',
    })),
  };
}
function esc(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
}
function pushHistory() {
  history.push(clone(state));
  if (history.length > 25) history.shift();
}
function save() {
  const saved = WorkspaceStorage.setItem(STORE, JSON.stringify(state));
  $("#saveState").innerHTML = saved
    ? "<i></i> Saved locally"
    : "<i></i> Session only";
}

function renderLibrary(filter = "") {
  const term = filter.toLowerCase();
  $("#nodeGroups").innerHTML =
    blockLibrary
      .map((group) => {
        const items = group.items.filter((i) =>
          `${i.label} ${i.description}`.toLowerCase().includes(term),
        );
        if (!items.length) return "";
        return `<section class="group"><div class="group-head"><span>${group.group}</span><span>${items.length}</span></div>${items.map((item) => `<button class="block" data-kind="${item.kind}" data-label="${esc(item.label)}" data-description="${esc(item.description)}" style="--block-color:${colors[item.kind]}"><span class="block-icon">${icons[item.kind]}</span><span class="block-copy"><strong>${esc(item.label)}</strong><small>${esc(item.description)}</small></span><span class="block-add">+</span></button>`).join("")}</section>`;
      })
      .join("") ||
    `<p class="library-note">No blocks match “${esc(filter)}”.</p>`;
  $$(".block").forEach((button) =>
    button.addEventListener("click", () =>
      addNode(
        button.dataset.kind,
        button.dataset.label,
        button.dataset.description,
      ),
    ),
  );
}

function render(updateInspector = true) {
  $("#workflowTitle").textContent = state.title;
  $("#nodeCount").textContent =
    `${state.nodes.length} node${state.nodes.length === 1 ? "" : "s"}`;
  $("#runCount").textContent = state.runs;
  $("#nodes").innerHTML = state.nodes
    .map(
      (node, index) =>
        `<article class="flow-node ${node.id === selectedId ? "selected" : ""}" data-id="${node.id}" style="left:${node.x}px;top:${node.y}px;--node-color:${colors[node.kind]};z-index:${node.id === selectedId ? 4 : 2}" tabindex="0" aria-label="${esc(node.label)} node"><i class="port in"></i><div class="node-head"><span>${icons[node.kind]}</span><i></i></div><strong>${esc(node.label)}</strong><p>${esc(node.description)}</p><i class="port out"></i></article>`,
    )
    .join("");
  $("#nodes").style.transform = `scale(${zoom})`;
  bindNodes();
  renderConnections();
  renderMinimap();
  if (updateInspector) renderInspector();
}

function bindNodes() {
  $$(".flow-node").forEach((element) => {
    const choose = () => {
      selectedId = element.dataset.id;
      render();
    };
    element.addEventListener("click", choose);
    element.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose();
      }
    });
    element.addEventListener("pointerdown", startDrag);
  });
}

function startDrag(event) {
  if (running) return;
  const element = event.currentTarget;
  const node = state.nodes.find((n) => n.id === element.dataset.id);
  selectedId = node.id;
  pushHistory();
  element.setPointerCapture(event.pointerId);
  const startX = event.clientX,
    startY = event.clientY,
    originX = node.x,
    originY = node.y;
  const move = (e) => {
    node.x = Math.max(5, originX + (e.clientX - startX) / zoom);
    node.y = Math.max(5, originY + (e.clientY - startY) / zoom);
    element.style.left = `${node.x}px`;
    element.style.top = `${node.y}px`;
    renderConnections();
    renderMinimap();
  };
  const end = () => {
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointercancel", end);
    element.removeEventListener("pointerup", end);
    save();
    render();
  };
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", end, { once: true });
  element.addEventListener("pointercancel", end, { once: true });
}

function renderConnections(liveIndex = -1) {
  const svg = $("#connections");
  svg.innerHTML = state.nodes
    .slice(0, -1)
    .map((node, index) => {
      const next = state.nodes[index + 1];
      const x1 = (node.x + 150) * zoom,
        y1 = (node.y + 42) * zoom,
        x2 = next.x * zoom,
        y2 = (next.y + 42) * zoom;
      const bend = Math.max(35, Math.abs(x2 - x1) * 0.5);
      return `<path class="connection ${index === liveIndex ? "live" : ""}" d="M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}"/>`;
    })
    .join("");
}

function renderMinimap() {
  const maxX = Math.max(...state.nodes.map((n) => n.x + 150), 1000),
    maxY = Math.max(...state.nodes.map((n) => n.y + 90), 360);
  $("#minimapNodes").innerHTML = state.nodes
    .map(
      (n) =>
        `<i class="mini-node" style="left:${(n.x / maxX) * 82 + 6}px;top:${(n.y / maxY) * 43 + 5}px;--mini-color:${colors[n.kind]}"></i>`,
    )
    .join("");
}

function renderInspector() {
  const node = state.nodes.find((n) => n.id === selectedId);
  const has = Boolean(node);
  $("#inspectorEmpty").hidden = has;
  $("#inspectorContent").hidden = !has;
  $("#inspector").classList.toggle("open", has);
  if (!node) return;
  $("#inspectorKind").textContent =
    node.kind[0].toUpperCase() + node.kind.slice(1);
  $("#inspectorIcon").textContent = icons[node.kind];
  $("#inspectorIcon").style.color = colors[node.kind];
  $("#inspectorName").textContent = node.label;
  $("#inspectorId").textContent = node.id;
  $("#labelInput").value = node.label;
  $("#descriptionInput").value = node.description;
  $("#modelInput").value = node.mode;
  $("#temperatureInput").value = node.temperature;
  $("#temperatureValue").value = node.temperature;
  $("#payloadInput").value = node.payload;
  $("#aiSettings").hidden = node.kind !== "intelligence";
}

function addNode(kind, label, description) {
  pushHistory();
  const last = state.nodes.at(-1);
  const id = `${kind}_${Date.now().toString().slice(-6)}`;
  state.nodes.push({
    id,
    kind,
    label,
    description,
    x: Math.min((last?.x || 30) + 185, 900),
    y: Math.max(35, ((last?.y || 70) + 65) % 190),
    mode: "balanced",
    temperature: 0.4,
    payload: '{"input":"sample"}',
  });
  selectedId = id;
  save();
  render();
  toast(`${label} added to the canvas`);
}

function updateSelected(field, value) {
  const node = state.nodes.find((n) => n.id === selectedId);
  if (!node) return;
  node[field] = value;
  $("#saveState").innerHTML = "<i></i> Saving…";
  clearTimeout(updateSelected.timer);
  updateSelected.timer = setTimeout(() => {
    save();
    render(false);
  }, 260);
}

async function runWorkflow() {
  if (running || !state.nodes.length) return;
  const snapshot = clone(state.nodes);
  for (const node of snapshot) {
    try {
      const payload = JSON.parse(node.payload);
      if (!payload || typeof payload !== "object" || Array.isArray(payload))
        throw new Error();
    } catch {
      $("#consoleStatus").textContent = "Validation failed";
      addLog(
        "run",
        "ERROR",
        `${node.label}: test payload must be a valid JSON object.`,
      );
      return toast("Fix the invalid payload before running");
    }
  }
  running = true;
  $("#runButton").disabled = true;
  $("#runButton").innerHTML = "<span>◌</span> Running…";
  $("#consoleStatus").textContent = "Executing";
  $("#logs").innerHTML = "";
  addLog(
    "run",
    "START",
    `Local simulation with ${snapshot.length} nodes. No external actions are sent.`,
  );
  for (let index = 0; index < snapshot.length; index++) {
    const node = snapshot[index];
    $$(".flow-node").forEach((n) => n.classList.remove("running"));
    const element = $(`.flow-node[data-id="${node.id}"]`);
    element?.classList.add("running");
    renderConnections(index - 1);
    addLog(
      "run",
      `0${index + 1}`,
      `${node.label} · ${node.mode} · temperature ${node.temperature}`,
    );
    await wait(470 + index * 50);
    addLog(
      "ok",
      "OK",
      `${Object.keys(JSON.parse(node.payload)).length} payload fields validated · ${node.kind === "logic" ? "approval simulated" : node.kind === "action" ? "delivery simulated" : "processing simulated"} · ${{ fast: 80, balanced: 160, deep: 320 }[node.mode]}ms estimated`,
    );
  }
  $$(".flow-node").forEach((n) => n.classList.remove("running"));
  renderConnections();
  state.runs += 1;
  save();
  running = false;
  $("#runButton").disabled = false;
  $("#runButton").innerHTML = "<span>▶</span> Test run <kbd>R</kbd>";
  $("#consoleStatus").textContent = "Completed";
  addLog(
    "done",
    "DONE",
    `Workflow completed · ${(1.8 + state.nodes.length * 0.21).toFixed(2)}s simulated runtime`,
  );
  $("#runCount").textContent = state.runs;
  toast("Test run completed successfully");
}
function addLog(type, badge, message) {
  const now = new Date().toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  $("#logs").insertAdjacentHTML(
    "beforeend",
    `<p><time>${now}</time><b class="${type}">${badge}</b>${esc(message)}</p>`,
  );
  $("#logs").scrollTop = $("#logs").scrollHeight;
}
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function toast(message) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  $("#toasts").append(t);
  setTimeout(() => t.remove(), 2600);
}
function exportFlow() {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          format: "flow-forge/v1",
          exportedAt: new Date().toISOString(),
          ...state,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${state.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.flow.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Workflow exported as JSON");
}

renderLibrary();
render();
$("#nodeSearch").addEventListener("input", (e) =>
  renderLibrary(e.target.value),
);
$("#collapseLibrary").addEventListener("click", () => {
  const collapsed = $(".studio").classList.toggle("library-collapsed");
  $("#expandLibrary").hidden = !collapsed;
  $("#collapseLibrary").textContent = collapsed ? "›" : "‹";
  $("#collapseLibrary").setAttribute(
    "aria-label",
    collapsed ? "Expand library" : "Collapse library",
  );
  renderConnections();
});
$("#expandLibrary").addEventListener("click", () =>
  $("#collapseLibrary").click(),
);
$("#runButton").addEventListener("click", runWorkflow);
$("#exportButton").addEventListener("click", exportFlow);
$("#undoButton").addEventListener("click", () => {
  if (!history.length) return toast("Nothing to undo");
  state = history.pop();
  selectedId = null;
  save();
  render();
  toast("Last canvas change undone");
});
$("#zoomIn").addEventListener("click", () => {
  zoom = Math.min(1.25, zoom + 0.1);
  $("#zoomValue").textContent = `${Math.round(zoom * 100)}%`;
  render();
});
$("#zoomOut").addEventListener("click", () => {
  zoom = Math.max(0.25, zoom - 0.1);
  $("#zoomValue").textContent = `${Math.round(zoom * 100)}%`;
  render();
});
$("#fitButton").addEventListener("click", () => {
  const width = Math.max(...state.nodes.map((n) => n.x + 180), 300);
  const height = Math.max(...state.nodes.map((n) => n.y + 120), 200);
  zoom = Math.max(
    0.25,
    Math.min(
      1.25,
      ($("#canvas").clientWidth - 40) / width,
      ($("#canvas").clientHeight - 40) / height,
    ),
  );
  $("#zoomValue").textContent = `${Math.round(zoom * 100)}%`;
  render();
  toast("Workflow fitted to canvas");
});
$("#templateButton").addEventListener("click", () =>
  $("#recipeDialog").showModal(),
);
$("#closeRecipes").addEventListener("click", () => $("#recipeDialog").close());
$$("[data-recipe]").forEach((b) =>
  b.addEventListener("click", () => {
    pushHistory();
    state = createRecipe(b.dataset.recipe);
    selectedId = null;
    save();
    render();
    $("#recipeDialog").close();
    toast(`${state.title} recipe loaded`);
  }),
);
$("#renameButton").addEventListener("click", () => {
  const name = prompt("Name this workflow", state.title);
  if (name?.trim()) {
    state.title = name.trim().slice(0, 60);
    save();
    render();
  }
});
$("#closeInspector").addEventListener("click", () => {
  selectedId = null;
  render();
});
$("#labelInput").addEventListener("input", (e) =>
  updateSelected("label", e.target.value),
);
$("#descriptionInput").addEventListener("input", (e) =>
  updateSelected("description", e.target.value),
);
$("#modelInput").addEventListener("change", (e) =>
  updateSelected("mode", e.target.value),
);
$("#temperatureInput").addEventListener("input", (e) => {
  $("#temperatureValue").value = e.target.value;
  updateSelected("temperature", Number(e.target.value));
});
$("#payloadInput").addEventListener("input", (e) =>
  updateSelected("payload", e.target.value),
);
$("#duplicateButton").addEventListener("click", () => {
  const n = state.nodes.find((n) => n.id === selectedId);
  if (n) {
    pushHistory();
    const copy = {
      ...clone(n),
      id: `${n.kind}_${Date.now().toString().slice(-6)}`,
      x: n.x + 35,
      y: n.y + 35,
      label: `${n.label} copy`,
    };
    state.nodes.splice(state.nodes.indexOf(n) + 1, 0, copy);
    selectedId = copy.id;
    save();
    render();
    toast("Node duplicated");
  }
});
$("#deleteButton").addEventListener("click", () => {
  const i = state.nodes.findIndex((n) => n.id === selectedId);
  if (i > -1) {
    pushHistory();
    const [n] = state.nodes.splice(i, 1);
    selectedId = null;
    save();
    render();
    toast(`${n.label} removed`);
  }
});
$("#clearConsole").addEventListener("click", () => {
  $("#logs").innerHTML =
    '<p class="muted">Console cleared. Start another test run when ready.</p>';
  $("#consoleStatus").textContent = "Ready";
});
$("#runsMode").addEventListener("click", () => {
  document.querySelector(".console").scrollIntoView({ behavior: "smooth" });
  toast(`${state.runs} local test runs in this workspace`);
});
document.addEventListener("keydown", (e) => {
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(
    document.activeElement?.tagName,
  );
  if (!typing && e.key === "/") {
    e.preventDefault();
    $("#nodeSearch").focus();
  }
  if (!typing && e.key.toLowerCase() === "r") runWorkflow();
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    $("#undoButton").click();
  }
});
window.addEventListener("resize", renderConnections);
