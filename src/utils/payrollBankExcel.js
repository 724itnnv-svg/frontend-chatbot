function getDeep(source, path) {
  return path.split(".").reduce((cursor, key) => cursor?.[key], source);
}

function toNumber(value) {
  if (value === "" || value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculatePayrollInstallments(row) {
  const firstInstallmentIncome = [
    "thuNhapTheoNgayCong.luongTheoNgayCong",
    "thuNhapTheoNgayCong.phuCapComThucTe",
    "thuNhapTheoNgayCong.phuCapChuyenCanThucTe",
    "thuNhapTheoNgayCong.phuCapXangXeThucTe",
    "thuNhapTheoNgayCong.phuCapDienThoaiThucTe",
    "thuNhapTheoNgayCong.phuCapNhiemVuThucTe",
    "thuNhapTheoNgayCong.luongLeTet",
    "thuNhapTheoNgayCong.luongPhepNam",
    "thuNhapTheoNgayCong.luongTangCaThuong",
    "thuNhapTheoNgayCong.luongTangCaChuNhat",
    "thuNhapTheoNgayCong.luongTangCaLeTet",
    "thuNhapTheoNgayCong.comTangCa",
    "thuNhapTheoNgayCong.traGiamLuong",
    "thuNhapTheoNgayCong.congKhac",
  ].reduce((total, path) => total + toNumber(getDeep(row, path)), 0);
  const secondInstallmentIncome =
    toNumber(getDeep(row, "thuNhapTheoNgayCong.thuongKPI"))
    + toNumber(getDeep(row, "thuNhapTheoNgayCong.hoaHong"));
  const totalDeduction = toNumber(getDeep(row, "khauTru.tongKhauTru"));
  const personalIncomeTax = toNumber(getDeep(row, "tinhThueTNCN.thueTNCNTamTinh"));

  let firstInstallment = firstInstallmentIncome - totalDeduction;
  let secondInstallment = secondInstallmentIncome - personalIncomeTax;
  if (secondInstallment < 0) {
    firstInstallment += secondInstallment;
    secondInstallment = 0;
  }

  return {
    firstInstallment,
    secondInstallment,
  };
}

export function buildPayrollBankTransferRows(rows, bankAccountsByEmployeeCode, installment) {
  return rows
    .map((row) => {
      const employeeCode = String(row.maNhanVien || row.employeeCode || "").trim().toUpperCase();
      const bankAccount = bankAccountsByEmployeeCode.get(employeeCode) || row.payrollBankAccount || {};
      const installments = calculatePayrollInstallments(row);
      const amount = installment === 2 ? installments.secondInstallment : installments.firstInstallment;
      return {
        employeeCode,
        userName: row.tenNhanVien || "",
        approvedAmount: Math.max(0, Math.round(amount)),
        paymentRecipient: {
          employeeCode,
          employeeName: row.tenNhanVien || "",
          accountHolder: bankAccount.accountHolder || row.tenNhanVien || "",
          accountNumber: String(bankAccount.accountNumber || ""),
          bankCode: bankAccount.bankCode || "",
          bankName: bankAccount.bankName || "",
          bankBranch: bankAccount.branch || bankAccount.bankBranch || "",
        },
      };
    })
    .filter((row) => row.approvedAmount > 0);
}
