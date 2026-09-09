import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/components/employees/EmployeeProfileManager.jsx", import.meta.url), "utf8");
const start = source.indexOf("  const saveExistingProfile = async");
const end = source.indexOf("  useEffect(() =>", start);
assert.ok(start >= 0 && end > start);

function setup(request) {
  const original = { _id: "employee-1", personal: { fullName: "Employee" }, employment: { company: "VN" }, compensation: {} };
  const editorRef = { current: { ...original, employment: { company: "ABC" } } };
  const editorSnapshotRef = { current: JSON.stringify(original) };
  const profileSaveRef = { current: null };
  const failedProfileSnapshotRef = { current: null };
  const state = { error: "", saving: false };
  const context = {
    editorRef, editorSnapshotRef, profileSaveRef, failedProfileSnapshotRef,
    clone: (value) => JSON.parse(JSON.stringify(value)),
    canProfileAction: () => true,
    allowanceSummary: () => "",
    request,
    setSavingProfile: (value) => { state.saving = value; },
    setProfileSaveError: (value) => { state.error = value; },
    setEditorSnapshot: (value) => { editorSnapshotRef.current = value; },
    setEditor: (value) => { editorRef.current = value; },
    setProfiles: () => {},
  };
  const actions = vm.runInNewContext(`${source.slice(start, end)}; ({ saveExistingProfile, flushProfileChanges });`, context);
  return { ...context, ...actions, state };
}

test("saving acknowledges the submitted version without overwriting newer edits", async () => {
  let resolve;
  let calls = 0;
  const app = setup(() => { calls++; return new Promise((done) => { resolve = done; }); });
  const first = app.saveExistingProfile();
  app.editorRef.current = { ...app.editorRef.current, employment: { company: "KF" } };
  const second = app.saveExistingProfile();
  assert.equal(calls, 1);
  resolve({ data: {} });
  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(app.editorRef.current.employment.company, "KF");
  assert.equal(JSON.parse(app.editorSnapshotRef.current).employment.company, "ABC");
});

test("closing waits for the in-flight save then saves remaining edits", async () => {
  let resolve;
  const submitted = [];
  const app = setup((url, options) => {
    submitted.push(JSON.parse(options.body).employment.company);
    if (submitted.length === 1) return new Promise((done) => { resolve = done; });
    return Promise.resolve({ data: {} });
  });
  const first = app.saveExistingProfile();
  app.editorRef.current = { ...app.editorRef.current, employment: { company: "KF" } };
  const close = app.flushProfileChanges();
  resolve({ data: {} });
  await first;
  assert.equal(await close, true);
  assert.deepEqual(submitted, ["ABC", "KF"]);
  assert.equal(app.editorSnapshotRef.current, JSON.stringify(app.editorRef.current));
});

test("failure preserves unsaved input and blocks closing; manual retry can succeed", async () => {
  let fail = true;
  const app = setup(async () => { if (fail) throw new Error("Offline"); return { data: {} }; });
  assert.equal(await app.flushProfileChanges(), false);
  assert.equal(app.state.error, "Offline");
  assert.equal(app.editorRef.current.employment.company, "ABC");
  assert.equal(JSON.parse(app.editorSnapshotRef.current).employment.company, "VN");
  assert.equal(app.state.saving, false);
  fail = false;
  assert.equal(await app.flushProfileChanges(), true);
  assert.equal(app.state.error, "");
  assert.equal(app.failedProfileSnapshotRef.current, null);
});

test("opening an unchanged profile does not write data", async () => {
  const app = setup(() => { throw new Error("Unexpected request"); });
  app.editorSnapshotRef.current = JSON.stringify(app.editorRef.current);
  assert.equal(await app.flushProfileChanges(), true);
});
