const PAYROLL_TIME_ZONE = "Asia/Ho_Chi_Minh";
const CURRENT_MONTH_START_DAY = 6;

export function getDefaultPayrollViewPeriod(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PAYROLL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  let year = Number(values.year);
  let month = Number(values.month);
  const day = Number(values.day);

  if (day < CURRENT_MONTH_START_DAY) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  return `${year}-${String(month).padStart(2, "0")}`;
}

export { CURRENT_MONTH_START_DAY, PAYROLL_TIME_ZONE };
