import {
  mapCarrierToCode,
  mapCarrierToId,
  mapCarrierToName,
  mapCarrierToRetailerId,
} from "../../utils/cashflowMapping";

const normalizeText = (value) => String(value ?? "").trim();

const parseMoney = (value) => {
  const text = normalizeText(value).replace(/,/g, "");
  if (!text) return 0;

  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
};

const normalizePayloadText = (value) =>
  normalizeText(value).replace(/\s+/g, " ");

const findEmployeeId = (employeeName, employeeOptions = []) => {
  const match = employeeOptions.find(
    (item) => item.label === employeeName || item.value === employeeName,
  );

  return match?.id || match?.userId || match?.employeeId || "";
};

const getAccountId = (bankAccounts = []) => {
  if (!Array.isArray(bankAccounts) || bankAccounts.length === 0) {
    return "";
  }

  return bankAccounts[0]?.id || "";
};

const getBankAccountDisplay = (bankAccounts = []) => {
  if (!Array.isArray(bankAccounts) || bankAccounts.length === 0) {
    return "";
  }

  const account = bankAccounts[0];
  const bankCode = normalizeText(account.bankCode);
  const accountNumber = normalizeText(account.account);
  const accountName = normalizeText(account.accountName);

  return [bankCode, accountNumber, accountName].filter(Boolean).join(" - ");
};

const getOrderDelivery = (row = {}) => row.__orderDelivery || {};

const buildSinglePayload = ({
  row,
  value,
  codePrefix,
  retailer,
  isPairedCashflow,
  forcePartnerType,
  employeeOptions,
  partnerDeliveries,
  bankAccounts,
}) => {
  const orderDelivery = getOrderDelivery(row);
  const partnerSource =
    orderDelivery.partnerDeliveryName ||
    row["Đối tác chuyển tiền"] ||
    row["Đối Tác Chuyển Tiền"];
  const employeeName = normalizeText(
    row["Nhân viên"] || orderDelivery.employeeName || orderDelivery.givenName,
  );
  const employeeId =
    normalizeText(orderDelivery.userId) ||
    findEmployeeId(employeeName, employeeOptions);

  const numericValue = parseMoney(value);
  const accountId = getAccountId(bankAccounts);
  const rawPaymentMethod = normalizeText(
    row["Phương thức thanh toán"] ||
      row["PaymentMethod"] ||
      row["Payment method"] ||
      row["Phương thức"] ||
      "Transfer",
  );
  const paymentMethod = /thẻ|card/i.test(rawPaymentMethod)
    ? "Card"
    : "Transfer";
  const description = normalizeText(
    row["GHI CHÚ"] ||
      row["Ghi chú"] ||
      row["Description"] ||
      orderDelivery.description ||
      "",
  );
  const invoiceCode =
    normalizeText(orderDelivery.invoiceId) ||
    normalizeText(row["Mã HD Kiot"]) ||
    normalizeText(row["Mã Vận Đơn"]);
  const partnerName =
    normalizeText(orderDelivery.partnerDeliveryName) ||
    normalizeText(row.PartnerName) ||
    mapCarrierToName(partnerSource, partnerDeliveries);
  const partnerCode =
    normalizeText(orderDelivery.partnerDeliveryCode) ||
    normalizeText(row.PartnerCode) ||
    mapCarrierToCode(partnerSource, partnerDeliveries);
  const cashflowCode = invoiceCode
    ? retailer === "abctv"
      ? `${isPairedCashflow ? codePrefix : ""}${invoiceCode}`
      : `TESTDTYTTTETI${codePrefix}${invoiceCode}`
    : "";

  return {
    Cashflow: {
      UsedForFinancialReporting: false,
      UsedPaymentForInvoiceOrReturn: true,
      PartnerType: forcePartnerType || (numericValue > 0 ? "C" : "D"),
      PaymentMethod: paymentMethod,
      AutoCalcLiability: false,
      ChangeDebtOnly: false,
      PartnerContactNo: normalizeText(
        row["Số điện thoại"] || orderDelivery.phoneNumber,
      ),
      Code: cashflowCode,
      Value: numericValue,
      UserId: employeeId,
      GivenName: employeeName,
      PartnerName: partnerName,
      PartnerCode: partnerCode,
      PartnerId: mapCarrierToId(partnerSource, partnerDeliveries),
      RetailerId: mapCarrierToRetailerId(partnerSource, partnerDeliveries),
      AccountId: Number(accountId),
      invoiceId: orderDelivery.invoiceIdCode,
      InvoiceId: orderDelivery.invoiceIdCode,
      CustomerId: orderDelivery.customerId,
      Description: description,
      outflow: numericValue > 0 ? false : true,
      DeliveryId: orderDelivery.id,
      phoneNumber: normalizeText(
        row["Số điện thoại"] || orderDelivery.phoneNumber,
      ),
      bankAccountInfo: getBankAccountDisplay(bankAccounts),
    },
  };
};

const buildCashflowPayloadEntriesForRow = ({
  row,
  retailer,
  employeeOptions,
  partnerDeliveries,
  bankAccounts,
}) => {
  const orderDelivery = getOrderDelivery(row);
  const moneyValue = parseMoney(row["Tiền hàng"] || orderDelivery.invoiceTotal);
  const shipValue = parseMoney(
    row["Phí ship NVC thu"] || orderDelivery.totalPrice,
  );
  const checkVanDon = normalizeText(row["Mã Vận Đơn"]);
  const shipCodePrefix = checkVanDon.startsWith("CH") ? "PCCH_" : "PCGH_";
  const hasMoneyCashflow = moneyValue !== 0;
  const hasShipCashflow = shipValue !== 0;
  const isPairedCashflow = hasMoneyCashflow && hasShipCashflow;
  const entries = [];

  if (hasMoneyCashflow) {
    entries.push({
      rowId: row.__rowId || "",
      kind: "money",
      label: "Tiền hàng",
      payload: buildSinglePayload({
        row,
        value: moneyValue,
        codePrefix: retailer === "abctv" ? "PT" : "TTGH_",
        retailer,
        isPairedCashflow,
        employeeOptions,
        partnerDeliveries,
        bankAccounts,
      }),
    });
  }

  const bankAccountInfo = getBankAccountDisplay(bankAccounts);

  if (hasShipCashflow) {
    entries.push({
      rowId: row.__rowId || "",
      kind: "ship",
      label: "Phí ship NVC thu",
      bankAccountInfo,
      payload: buildSinglePayload({
        row,
        value: shipValue,
        codePrefix: retailer === "abctv" ? "PC" : shipCodePrefix,
        retailer,
        isPairedCashflow,
        forcePartnerType: "D",
        employeeOptions,
        partnerDeliveries,
        bankAccounts,
      }),
    });
  }

  return entries;
};

export function buildCashflowPayloads(
  rows = [],
  employeeOptions = [],
  partnerDeliveries = [],
  bankAccounts = [],
  retailer = "",
) {
  return buildCashflowPayloadEntries(
    rows,
    employeeOptions,
    partnerDeliveries,
    bankAccounts,
    retailer,
  ).map((entry) => entry.payload);
}

export function buildCashflowPayloadEntries(
  rows = [],
  employeeOptions = [],
  partnerDeliveries = [],
  bankAccounts = [],
  retailer = "",
) {
  const entries = [];

  rows.forEach((row) => {
    entries.push(
      ...buildCashflowPayloadEntriesForRow({
        row,
        retailer,
        employeeOptions,
        partnerDeliveries,
        bankAccounts,
      }),
    );
  });

  return entries;
}

export { parseMoney, normalizePayloadText };
