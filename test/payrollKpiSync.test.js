import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Execute the actual component handlers without mounting the full payroll editor.
const source = readFileSync(new URL("../src/components/PayrollManager.jsx", import.meta.url), "utf8");
const handlers = source.slice(source.indexOf("  const fetchPayroll = async"), source.indexOf("  const openPayrollExport ="));
function harness(responses, overrides = {}) {
  const calls = [], loading = [], messages = [], rows = [];
  const context = {
    canViewPayroll: true, canEdit: true, payrollReadOnly: false, period: "2026-08", kpiSyncLoading: false,
    dirtyIds: new Set(), authHeader: { Authorization: "test" }, formulaSettings: {},
    baselineRowsRef: { current: new Map() }, URLSearchParams,
    normalizePayrollRow: (row) => row, payrollRowFingerprint: () => "fingerprint",
    setKpiSyncLoading: (value) => loading.push(value), setMessage: (value) => messages.push(value),
    setLoading() {}, setRows: (value) => rows.push(value), setDirtyIds() {}, setUndoStack() {}, setRedoStack() {}, setSelectedRowIds() {},
    console: { error() {} },
    fetch: async (url, options) => {
      calls.push({ url, options });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      assert.ok(response, "Unexpected extra request");
      return { ok: response.ok !== false, json: async () => response };
    },
    ...overrides,
  };
  const run = vm.runInNewContext(`${handlers}\nsyncApprovedKpi`, context);
  return { run, calls, loading, messages, rows };
}
test("sync sends request, refreshes payroll and always clears spinner on success", async () => {
  const h = harness([{ success: true, message: "Đã đồng bộ", skippedLocked: [{}] }, { success: true, data: [{ __clientId: "1" }] }]);
  await h.run();
  assert.deepEqual(h.loading, [true, false]);
  assert.equal(h.calls[0].url, "/api/payroll/sync-kpi");
  assert.equal(h.calls[0].options.method, "POST");
  assert.equal(JSON.parse(h.calls[0].options.body).period, "2026-08");
  assert.equal(h.calls[1].url, "/api/payroll?period=2026-08");
  assert.match(h.messages.at(-1), /Đã đồng bộ.*1 dòng/);
});
test("network and API errors clear spinner and do not reload payroll", async () => {
  for (const response of [new Error("Mất kết nối"), { ok: false, message: "Kỳ lương đã khóa" }]) {
    const h = harness([response]);
    await h.run();
    assert.deepEqual(h.loading, [true, false]);
    assert.equal(h.calls.length, 1);
    assert.match(h.messages.at(-1), /Mất kết nối|Kỳ lương đã khóa/);
  }
});
test("successful sync followed by failed refresh reports stale display and preserves rows", async () => {
  const h = harness([{ success: true }, new Error("Không tải được bảng lương")]);
  await h.run();
  assert.deepEqual(h.loading, [true, false]);
  assert.equal(h.rows.length, 0);
  assert.match(h.messages.at(-1), /Đồng bộ đã hoàn tất nhưng chưa tải lại được/);
});
test("unsaved edits, locked payroll and ongoing sync prevent duplicate requests", async () => {
  for (const overrides of [{ dirtyIds: new Set(["1"]) }, { payrollReadOnly: true }, { kpiSyncLoading: true }, { canEdit: false }]) {
    const h = harness([], overrides);
    await h.run();
    assert.equal(h.calls.length, 0);
    assert.equal(h.loading.length, 0);
  }
});
