const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { boot } = require("./harness.cjs");
const key = fs
  .readFileSync(path.join(__dirname, "../app.js"), "utf8")
  .match(/const (?:STORAGE_KEY|STORE|KEY) = "([^"]+)"/)[1];
const fixture = async (t, options) => {
  const h = await boot(options);
  t.after(() => {
    const errors = [...h.errors];
    h.close();
    assert.deepEqual(errors, []);
  });
  return h;
};
const submit = (h, selector) =>
  h
    .$(selector)
    .dispatchEvent(
      new h.window.Event("submit", { bubbles: true, cancelable: true }),
    );
const readBlob = (h, blob) =>
  new Promise((resolve, reject) => {
    const r = new h.window.FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsText(blob);
  });
async function roundTrip(t, h) {
  await h.wait(450);
  const raw = h.window.localStorage.getItem(key);
  assert.ok(raw, "Interaction should persist workspace data");
  assert.equal(
    h.window.validateWorkspace(JSON.parse(raw)),
    true,
    "Generated state must satisfy its schema",
  );
  const reloaded = await fixture(t, { saved: { [key]: raw } });
  assert.equal(
    reloaded.$("#storage-notice"),
    null,
    "Valid edits must not be discarded on reload",
  );
}
test("editing preserves caret, validates JSON, and survives reload", async (t) => {
  const h = await fixture(t);
  h.click(".flow-node");
  const field = h.$("#labelInput");
  field.focus();
  h.input("#labelInput", "Validated event");
  field.setSelectionRange(4, 4);
  await h.wait(320);
  assert.equal(h.document.activeElement, field);
  assert.equal(field.selectionStart, 4);
  h.input("#payloadInput", "not JSON");
  h.click("#runButton");
  assert.equal(h.$("#consoleStatus").textContent, "Validation failed");
  h.input("#payloadInput", '{"topic":"research"}');
  await roundTrip(t, h);
});
test("library can be reopened and duplicate is undoable", async (t) => {
  const h = await fixture(t);
  h.click("#collapseLibrary");
  assert.equal(h.$("#expandLibrary").hidden, false);
  h.click("#expandLibrary");
  assert.equal(h.$("#expandLibrary").hidden, true);
  const count = h.document.querySelectorAll(".flow-node").length;
  h.click(".flow-node");
  h.click("#duplicateButton");
  assert.equal(h.document.querySelectorAll(".flow-node").length, count + 1);
  h.click("#undoButton");
  assert.equal(h.document.querySelectorAll(".flow-node").length, count);
  h.click("#exportButton");
  assert.equal(h.downloads.length, 1);
});
