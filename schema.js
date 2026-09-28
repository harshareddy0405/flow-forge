/* Validate persisted data before it reaches rendering or simulation. */
(() => {
  "use strict";
  const text = (v) => typeof v === "string" && v.length <= 100000;
  const id = (v) => text(v) && /^[a-zA-Z0-9_-]{1,120}$/.test(v);
  const number =
    (min = 0, max = 1e15) =>
    (v) =>
      Number.isFinite(v) && v >= min && v <= max;
  const bool = (v) => typeof v === "boolean";
  const one =
    (...values) =>
    (v) =>
      values.includes(v);
  const optional = (check) => (v) => v === undefined || check(v);
  const nullable = (check) => (v) => v === null || check(v);
  const array =
    (check, min = 0, max = 1000) =>
    (v) =>
      Array.isArray(v) && v.length >= min && v.length <= max && v.every(check);
  const object = (fields) => (v) =>
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.entries(fields).every(([key, check]) => check(v[key]));
  const record = (check) => (v) =>
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.values(v).every(check);
  const unique = (items) =>
    new Set(items.map((item) => item.id)).size === items.length;
  const node = object({
    id,
    kind: one("trigger", "intelligence", "logic", "action"),
    label: text,
    description: text,
    x: number(0, 5000),
    y: number(0, 5000),
    mode: one("fast", "balanced", "deep"),
    temperature: number(0, 1),
    payload: text,
  });
  window.validateWorkspace = (v) =>
    object({ title: text, runs: number(), nodes: array(node, 0, 100) })(v) &&
    unique(v.nodes);
})();
