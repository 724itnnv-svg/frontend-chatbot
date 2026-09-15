// Keep unsaved manual inputs while replacing only fields owned by source systems.
export function mergePayrollLiveRows(current, incoming, dirtyIds, sourcePaths, recalculate) {
  const freshById = new Map(incoming.map((row) => [row.__clientId, row]));
  const currentIds = new Set(current.map((row) => row.__clientId));
  const merged = current.map((row) => {
    const fresh = freshById.get(row.__clientId);
    if (!dirtyIds.has(row.__clientId)) return fresh;
    if (!fresh) return row;
    const draft = structuredClone(row);
    for (const path of sourcePaths) {
      const keys = path.split(".");
      let source = fresh, target = draft;
      for (const key of keys.slice(0, -1)) {
        source = source?.[key];
        target[key] ||= {};
        target = target[key];
      }
      target[keys.at(-1)] = source?.[keys.at(-1)] ?? 0;
    }
    draft.payrollBankAccount = structuredClone(fresh.payrollBankAccount || {});
    draft.khauTru ||= {};
    draft.thuNhapTheoNgayCong ||= {};
    draft.khauTru.tamUngTuPhieu = fresh.khauTru?.tamUngTuPhieu ?? 0;
    draft.thuNhapTheoNgayCong.diemKPI = fresh.thuNhapTheoNgayCong?.diemKPI ?? 0;
    draft.attendanceSyncedAt = fresh.attendanceSyncedAt;
    draft.attendanceThroughDate = fresh.attendanceThroughDate;
    return recalculate(draft);
  }).filter(Boolean);
  return [...merged, ...incoming.filter((row) => !currentIds.has(row.__clientId))];
}
