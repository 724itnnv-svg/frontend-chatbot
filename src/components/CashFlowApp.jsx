import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  createCashFlow,
  getAccessToken,
  getPartnerDelivery,
  getAccessPrivateToken,
  getBankAccount,
  getOrderDelivery,
} from "../services/cashflowService/kiotService";
import {
  parseExcelFile,
  exportExcelFile,
} from "../services/cashflowService/excelService";
import {
  buildCashflowPayloadEntries,
  buildCashflowPayloads,
  hasCashflowInvoiceId,
} from "../services/cashflowService/payloadService";

import ControlsPanel from "./cashflow-components/ControlsPanel";
import StatsGrid from "./cashflow-components/StatsGrid";
import ExcelTable from "./cashflow-components/ExcelTable";
import SelectedRowsPanel from "./cashflow-components/SelectedRowsPanel";
import ToastContainer from "./cashflow-components/ToastContainer";

const RETAILERS = [
  { value: "nnvtv", label: "nnvtv" },
  { value: "kingfarm", label: "kingfarm" },
  { value: "vietnhattv", label: "vietnhattv" },
  { value: "abctv", label: "abctv" },
];
const PRIVATE_TOKEN_COOKIE_PREFIX = "kiot_private_token_";
const SEND_REQUEST_DELAY_MS = 350;
const ORDER_DELIVERY_BATCH_SIZE = 10;
const ORDER_DELIVERY_ROW_DELAY_MS = 350;
const ORDER_DELIVERY_BATCH_PAUSE_MS = 1400;

const cashflowStyles = `
.app-shell {
  min-height: 100vh;
  width: 100%;
  padding: 24px;
  color: #0f172a;
  font-size: 14px;
  text-align: left;
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.16), transparent 34%),
    radial-gradient(circle at top right, rgba(16, 185, 129, 0.12), transparent 28%),
    linear-gradient(180deg, #f8fbff 0%, #f3f8ff 46%, #eef6f4 100%);
}

.app-shell,
.app-shell * {
  box-sizing: border-box;
}

.app-shell button,
.app-shell input,
.app-shell select,
.app-shell textarea {
  font: inherit;
}

.app-shell button {
  cursor: pointer;
}

.app-shell .hero {
  display: grid;
  gap: 20px;
  align-items: stretch;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.9fr);
  margin: 0 auto 20px;
  max-width: 1600px;
}

.app-shell .hero > :first-child,
.app-shell .hero-panel,
.app-shell .card,
.app-shell .stats-grid,
.app-shell .notice {
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.app-shell .hero > :first-child {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 28px;
  padding: 28px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(240, 249, 255, 0.88)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0));
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.08);
}

.app-shell .hero > :first-child::after {
  content: "";
  position: absolute;
  inset: auto -80px -90px auto;
  width: 240px;
  height: 240px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.28), transparent 68%);
  pointer-events: none;
}

.app-shell .hero-panel {
  display: grid;
  gap: 16px;
  align-content: start;
  border: 1px solid rgba(125, 211, 252, 0.28);
  border-radius: 28px;
  padding: 22px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(236, 253, 245, 0.88));
  box-shadow: 0 24px 80px rgba(14, 116, 144, 0.12);
}

.app-shell .eyebrow {
  margin: 0 0 10px;
  color: #0891b2;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}



.app-shell .hero h1 {
  font-size:25px !important;
  font
  width: 540px;
  margin: 0;
  color: #0b0c0f;
  font-size: clamp(1.65rem, 2.5vw, 2.55rem);
  line-height: 1.04;
  font-weight: 900;
  letter-spacing: -0.04em;

}

.app-shell .hero-copy {
  margin: 14px 0 0;
  max-width: 72ch;
  color: #475569;
  font-size: 14px;
  line-height: 1.7;
}

.app-shell .hero-steps {
  display: grid;
  gap: 12px;
  margin: 22px 0 0;
  padding: 0;
  list-style: none;
}

.app-shell .hero-steps li {
  display: grid;
  gap: 4px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 18px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.7);
}

.app-shell .hero-steps strong {
  color: #0f172a;
  font-size: 12px;
  font-weight: 800;
}

.app-shell .hero-steps span {
  color: #64748b;
  font-size: 11px;
  line-height: 1.55;
}

.app-shell .field,
.app-shell .upload {
  display: grid;
  gap: 8px;
}

.app-shell .field span,
.app-shell .upload span {
  color: #475569;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.app-shell .field select,
.app-shell .upload input[type="file"] {
  width: 100%;
}

.app-shell .field select,
.app-shell .upload {
  min-height: 56px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
}

.app-shell .field select {
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: #0f172a;
  outline: none;
}

.app-shell .upload {
  align-content: start;
}

.app-shell .upload input[type="file"] {
  padding: 0;
  color: #334155;
}

.app-shell .upload input[type="file"]::file-selector-button {
  margin-right: 12px;
  border: 0;
  border-radius: 12px;
  padding: 10px 14px;
  background: linear-gradient(135deg, #0ea5e9, #14b8a6);
  color: #fff;
  font-weight: 800;
  transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
}

.app-shell .upload input[type="file"]::file-selector-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(14, 165, 233, 0.24);
}

.app-shell .notice {
  max-width: 1600px;
  margin: 0 auto 16px;
  border: 1px solid rgba(248, 113, 113, 0.28);
  border-radius: 18px;
  padding: 14px 16px;
  background: rgba(254, 242, 242, 0.92);
  color: #b91c1c;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 18px 40px rgba(185, 28, 28, 0.08);
}

.app-shell .notice.error {
  border-color: rgba(248, 113, 113, 0.28);
}

.app-shell .stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  max-width: 1600px;
  margin: 0 auto 18px;
}

.app-shell .stats-shell {
  display: grid;
  gap: 14px;
  max-width: 1600px;
  margin: 0 auto 18px;
}

.app-shell .totals-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.app-shell .totals-grid--compact {
  grid-template-columns: 1fr;
}

.app-shell .hero-panel .totals-grid {
  margin-top: 2px;
}

.app-shell .hero-panel .totals-grid--compact {
  gap: 12px;
}

.app-shell .hero-panel .totals-grid--compact .stat-card {
  min-height: 84px;
  padding: 14px 16px;
}

.app-shell .order-progress {
  display: grid;
  gap: 10px;
  margin-top: 2px;
  border: 1px solid rgba(125, 211, 252, 0.28);
  border-radius: 18px;
  padding: 14px 16px;
  background:
    linear-gradient(180deg, rgba(240, 249, 255, 0.98), rgba(255, 255, 255, 0.96));
  box-shadow: 0 12px 30px rgba(14, 165, 233, 0.08);
}

.app-shell .order-progress__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.app-shell .order-progress__head span {
  display: block;
  color: #64748b;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.app-shell .order-progress__head strong {
  display: block;
  margin-top: 4px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
}

.app-shell .order-progress__head em {
  color: #0f766e;
  font-size: 14px;
  font-style: normal;
  font-weight: 900;
}

.app-shell .order-progress__bar {
  overflow: hidden;
  height: 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
}

.app-shell .order-progress__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0ea5e9, #14b8a6);
  transition: width 180ms ease;
}

.app-shell .order-progress.is-active .order-progress__bar span {
  box-shadow: 0 0 0 1px rgba(14, 165, 233, 0.08);
}

.app-shell .send-progress {
  display: grid;
  gap: 10px;
  margin-top: 12px;
  border: 1px solid rgba(165, 180, 252, 0.28);
  border-radius: 18px;
  padding: 14px 16px;
  background:
    linear-gradient(180deg, rgba(245, 243, 255, 0.98), rgba(255, 255, 255, 0.96));
  box-shadow: 0 12px 30px rgba(99, 102, 241, 0.08);
}

.app-shell .send-progress__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.app-shell .send-progress__head span {
  display: block;
  color: #6b7280;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.app-shell .send-progress__head strong {
  display: block;
  margin-top: 4px;
  color: #111827;
  font-size: 13px;
  font-weight: 900;
}

.app-shell .send-progress__head em {
  color: #7c3aed;
  font-size: 14px;
  font-style: normal;
  font-weight: 900;
}

.app-shell .send-progress__bar {
  overflow: hidden;
  height: 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
}

.app-shell .send-progress__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #8b5cf6, #06b6d4);
  transition: width 180ms ease;
}

.app-shell .send-progress.is-active .send-progress__bar span {
  box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.08);
}

.app-shell .stat-card {
  display: grid;
  gap: 8px;
  min-height: 102px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 22px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
}

.app-shell .stat-card--accent {
  min-height: 110px;
  border-width: 1px;
  border-style: solid;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}

.app-shell .stat-card--money {
  border-color: rgba(16, 185, 129, 0.18);
  background: linear-gradient(180deg, rgba(236, 253, 245, 0.98), rgba(255, 255, 255, 0.96));
}

.app-shell .stat-card--ship {
  border-color: rgba(14, 165, 233, 0.18);
  background: linear-gradient(180deg, rgba(240, 249, 255, 0.98), rgba(255, 255, 255, 0.96));
}

.app-shell .stat-card--grand {
  border-color: rgba(168, 85, 247, 0.16);
  background: linear-gradient(180deg, rgba(250, 245, 255, 0.98), rgba(255, 255, 255, 0.96));
}

.app-shell .hero-panel .totals-grid .stat-card {
  min-height: 90px;
}

.app-shell .stat-card span {
  color: #64748b;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.app-shell .stat-card strong {
  overflow: hidden;
  color: #0f172a;
  font-size: 14px;
  line-height: 1.5;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-shell .content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.75fr) minmax(360px, 0.95fr);
  gap: 18px;
  align-items: start;
  max-width: 1600px;
  margin: 0 auto;
}

.app-shell .card,
.app-shell .selected-row-card,
.app-shell .summary-box,
.app-shell .detail-modal,
.app-shell .toast {
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
}

.app-shell .card {
  border-radius: 26px;
  padding: 22px;
}

.app-shell .table-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: calc(100vh - 120px);
}

.app-shell .json-card {
  position: sticky;
  top: 18px;
}

.app-shell .card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.app-shell .card-head h2 {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: -0.03em;
}

.app-shell .card-head p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.55;
}

.app-shell .table-actions,
.app-shell .payload-actions,
.app-shell .payload-buttons,
.app-shell .selected-rows-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.app-shell .table-actions {
  justify-content: flex-end;
}

.app-shell .ghost-btn,
.app-shell .primary-btn,
.app-shell .ghost-link {
  border: 1px solid transparent;
  border-radius: 14px;
  padding: 11px 14px;
  font-size: 12px;
  font-weight: 800;
  transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, color 160ms ease, border-color 160ms ease;
}

.app-shell .ghost-btn {
  border-color: rgba(148, 163, 184, 0.2);
  background: rgba(248, 250, 252, 0.92);
  color: #334155;
}

.app-shell .ghost-btn:hover:not(:disabled) {
  border-color: rgba(14, 165, 233, 0.24);
  background: rgba(236, 254, 255, 0.95);
  color: #0f766e;
  transform: translateY(-1px);
}

.app-shell .primary-btn {
  background: linear-gradient(135deg, #0ea5e9, #14b8a6);
  color: #fff;
  box-shadow: 0 14px 28px rgba(14, 165, 233, 0.22);
}

.app-shell .primary-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 16px 32px rgba(14, 165, 233, 0.28);
}

.app-shell .ghost-link {
  border-color: rgba(125, 211, 252, 0.2);
  background: rgba(240, 249, 255, 0.94);
  color: #0369a1;
}

.app-shell .ghost-link:hover:not(:disabled),
.app-shell .ghost-link.active {
  border-color: rgba(14, 165, 233, 0.3);
  background: rgba(14, 165, 233, 0.12);
  color: #075985;
}

.app-shell .ghost-link:disabled,
.app-shell .ghost-btn:disabled,
.app-shell .primary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.app-shell .table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 22px;
  background: rgba(248, 250, 252, 0.76);
}

.app-shell .table-wrap table {
  width: 100%;
  min-width: 1000px;
  border-collapse: separate;
  border-spacing: 0;
}

.app-shell .table-wrap thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgba(255, 255, 255, 0.98);
  color: #334155;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.app-shell .table-wrap th,
.app-shell .table-wrap td {
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
  padding: 13px 12px;
  text-align: left;
  vertical-align: top;
}

.app-shell .table-wrap tbody tr:hover {
  background: rgba(240, 249, 255, 0.75);
}

.app-shell .checkbox-col {
  width: 46px;
  text-align: center;
}

.app-shell .checkbox-col input {
  width: 16px;
  height: 16px;
  accent-color: #0891b2;
}

.app-shell .sticky-col {
  position: sticky;
  left: 0;
  z-index: 1;
  background: inherit;
}

.app-shell .sticky-col-0 {
  left: 0;
}

.app-shell .sticky-col-1 {
  left: 46px;
}

.app-shell .draggable-header {
  cursor: grab;
  user-select: none;
}

.app-shell .draggable-header.dragging {
  opacity: 0.6;
  cursor: grabbing;
}

.app-shell .column-handle {
  margin-right: 8px;
  color: #94a3b8;
  font-weight: 900;
  letter-spacing: -0.12em;
}

.app-shell .status-col {
  min-width: 96px;
  text-align: center;
}

.app-shell .status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 78px;
  border-radius: 999px;
  padding: 7px 11px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.app-shell .status-pill--success {
  background: rgba(220, 252, 231, 0.96);
  color: #166534;
}

.app-shell .status-pill--pending {
  background: rgba(254, 243, 199, 0.96);
  color: #92400e;
}

.app-shell .selected-rows-list {
  display: grid;
  gap: 12px;
  max-height: 56vh;
  overflow: auto;
  padding-right: 2px;
}

.app-shell .selected-row-card {
  border-radius: 20px;
  padding: 16px;
}

.app-shell .selected-row-card.active {
  border-color: rgba(14, 165, 233, 0.32);
  box-shadow: 0 18px 40px rgba(14, 165, 233, 0.12);
}

.app-shell .selected-row-card__top,
.app-shell .summary-head,
.app-shell .detail-modal__header,
.app-shell .payload-detail-card__head,
.app-shell .detail-section-card__head,
.app-shell .payload-preview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.app-shell .selected-row-card__top strong,
.app-shell .summary-head h3,
.app-shell .payload-detail-card__head strong,
.app-shell .detail-section-card__head h5,
.app-shell .payload-preview-head strong {
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
}

.app-shell .selected-row-card__top p,
.app-shell .detail-modal__subtitle,
.app-shell .summary-subtitle {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 11px;
  line-height: 1.6;
}

.app-shell .selected-row-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  color: #475569;
  font-size: 10px;
}

.app-shell .selected-row-meta span,
.app-shell .selected-rows-footer span {
  border-radius: 999px;
  padding: 7px 10px;
  background: rgba(248, 250, 252, 0.96);
  color: #475569;
}

.app-shell .summary-box {
  margin-top: 16px;
  border-radius: 24px;
  padding: 18px;
}

.app-shell .summary-box-topline + .summary-box-topline {
  margin-top: 14px;
}

.app-shell .payload-preview-shell {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.app-shell .missing-invoice-list {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.app-shell .payload-preview {
  overflow: auto;
  max-height: 320px;
  margin: 0;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 18px;
  padding: 14px;
  background: #0f172a;
  color: #dbeafe;
  font-size: 11px;
  line-height: 1.6;
}

.app-shell .detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.app-shell .detail-grid--compact {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.app-shell .detail-card {
  display: grid;
  gap: 6px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 16px;
  padding: 12px 14px;
  background: rgba(248, 250, 252, 0.9);
}

.app-shell .detail-card span {
  color: #64748b;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.app-shell .detail-card strong {
  color: #0f172a;
  font-size: 12px;
  line-height: 1.55;
  font-weight: 800;
  word-break: break-word;
}

.app-shell .chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 7px 10px;
  font-size: 11px;
  font-weight: 800;
}

.app-shell .chip.muted {
  background: rgba(241, 245, 249, 0.96);
  color: #475569;
}

.app-shell .detail-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(15, 23, 42, 0.52);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.app-shell .detail-modal {
  width: min(1320px, calc(100vw - 36px));
  max-height: min(82vh, 860px);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-radius: 28px;
  padding: 22px;
}





.app-shell .detail-modal__sections {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.95fr);
  gap: 14px;
  align-items: start;
}

.app-shell .detail-modal__header {
  margin-bottom: 16px;
}

.app-shell .detail-modal__actions {
  display: flex;
  gap: 10px;
}

.app-shell .detail-modal__summary {
  margin-bottom: 14px;
}

.app-shell .detail-section-card,
.app-shell .payload-detail-card {
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 20px;
  padding: 16px;
  background: rgba(248, 250, 252, 0.88);
}

.app-shell .detail-section-card + .payload-detail-card {
  margin-top: 14px;
}

.detail-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 18px;
  background:
    radial-gradient(circle at top, rgba(56, 189, 248, 0.22), transparent 34%),
    radial-gradient(circle at bottom right, rgba(16, 185, 129, 0.16), transparent 28%),
    rgba(15, 23, 42, 0.58);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.detail-modal {
  width: min(1320px, calc(100vw - 36px));
  max-height: min(82vh, 860px);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  position: relative;
  isolation: isolate;
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 30px;
  padding: 24px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 251, 255, 0.92)),
    linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(20, 184, 166, 0.06));
  box-shadow:
    0 40px 120px rgba(15, 23, 42, 0.32),
    0 12px 28px rgba(14, 165, 233, 0.12);
}

.detail-modal::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.16), transparent 26%),
    radial-gradient(circle at top right, rgba(20, 184, 166, 0.12), transparent 22%);
  pointer-events: none;
  z-index: -1;
}

.detail-modal__sections {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
  gap: 16px;
  align-items: start;
}

.detail-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 2px;
}

.detail-modal__actions {
  display: flex;
  gap: 10px;
}

.detail-modal__header h4 {
  margin: 4px 0 0;
  color: #0f172a;
  font-size: clamp(1.35rem, 2vw, 1.85rem);
  line-height: 1.08;
  font-weight: 900;
  letter-spacing: -0.04em;
}

.detail-modal__subtitle {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.invoice-detail__eyebrow {
  margin: 0;
  color: #0f766e;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.detail-modal__summary {
  margin-bottom: 2px;
  padding: 12px 14px;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.7);
}

.detail-section-card,
.payload-detail-card {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 24px;
  padding: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.94));
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}

.detail-section-card + .payload-detail-card {
  margin-top: 14px;
}

.detail-section-card__head,
.payload-detail-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.detail-section-card__head h5,
.payload-detail-card__head strong {
  margin: 0;
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.detail-grid,
.detail-grid--compact {
  display: grid;
  gap: 12px;
}

.detail-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.detail-grid--compact {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.detail-card {
  display: grid;
  gap: 6px;
  min-height: 90px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 18px;
  padding: 14px 15px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(255, 255, 255, 0.98));
}

.detail-card span {
  color: #64748b;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.detail-card strong {
  color: #0f172a;
  font-size: 13px;
  line-height: 1.55;
  font-weight: 800;
  word-break: break-word;
}

.chip.muted {
  background: rgba(240, 249, 255, 0.98);
  color: #0369a1;
  border: 1px solid rgba(125, 211, 252, 0.3);
  box-shadow: 0 8px 20px rgba(14, 165, 233, 0.08);
}

.ghost-link {
  text-decoration: none;
}

.app-shell .toast-container {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 90;
  display: grid;
  gap: 10px;
  width: min(360px, calc(100vw - 32px));
}

.app-shell .toast {
  border-radius: 18px;
  padding: 14px 14px 12px;
}

.app-shell .toast--success {
  border-color: rgba(16, 185, 129, 0.22);
  background: rgba(236, 253, 245, 0.98);
}

.app-shell .toast--warning {
  border-color: rgba(245, 158, 11, 0.22);
  background: rgba(255, 251, 235, 0.98);
}

.app-shell .toast--error {
  border-color: rgba(239, 68, 68, 0.22);
  background: rgba(254, 242, 242, 0.98);
}

.app-shell .toast__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}

.app-shell .toast__header strong {
  color: #0f172a;
  font-size: 12px;
  font-weight: 900;
}

.app-shell .toast__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: #64748b;
  font-size: 18px;
  line-height: 1;
}

.app-shell .toast__message {
  color: #475569;
  font-size: 12px;
  line-height: 1.55;
}

@media (max-width: 1200px) {
  .app-shell .hero,
  .app-shell .content-grid {
    grid-template-columns: 1fr;
  }

  .app-shell .json-card {
    position: static;
  }
}

@media (max-width: 900px) {
  .app-shell {
    padding: 14px;
  }

  .app-shell .hero > :first-child,
  .app-shell .hero-panel,
  .app-shell .card,
  .app-shell .summary-box,
  .app-shell .detail-modal {
    border-radius: 22px;
    padding: 18px;
  }

  .app-shell .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .app-shell .totals-grid {
    grid-template-columns: 1fr;
  }

  .app-shell .detail-grid,
  .app-shell .detail-grid--compact {
    grid-template-columns: 1fr;
  }

  .app-shell .detail-modal__sections {
    grid-template-columns: 1fr;
  }

  .detail-modal {
    width: min(100%, calc(100vw - 28px));
    max-height: 88vh;
    padding: 18px;
  }

  .detail-modal__sections {
    grid-template-columns: 1fr;
  }

  .app-shell .card-head,
  .app-shell .selected-row-card__top,
  .app-shell .summary-head,
  .app-shell .detail-modal__header,
  .app-shell .payload-detail-card__head,
  .app-shell .detail-section-card__head,
  .app-shell .payload-preview-head {
    flex-direction: column;
  }

  .app-shell .table-card {
    max-height: calc(100vh - 280px);
  }

  .app-shell .table-actions {
    justify-content: stretch;
  }

  .app-shell .table-actions > *,
  .app-shell .payload-actions > *,
  .app-shell .payload-buttons > *,
  .app-shell .detail-modal__actions > * {
    flex: 1 1 auto;
  }
}

@media (max-width: 640px) {
  .app-shell .hero h1 {
    max-width: none;
  }

  .app-shell .detail-modal {
    width: min(100%, calc(100vw - 28px));
    max-height: 88vh;
  }

  .app-shell .stats-grid {
    grid-template-columns: 1fr;
  }

  .app-shell .totals-grid {
    grid-template-columns: 1fr;
  }

  .app-shell .toast-container {
    left: 14px;
    right: 14px;
    width: auto;
  }
}
`;

const normalizeText = (value) => String(value ?? "").trim();

const getPrivateTokenCookieName = (retailer) =>
  `${PRIVATE_TOKEN_COOKIE_PREFIX}${retailer}`;

const setCookie = (name, value, maxAgeSeconds = 60 * 60 * 24 * 30) => {
  if (typeof document === "undefined") return;

  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value,
  )}; path=/; max-age=${maxAgeSeconds}`;
};

const getVisibleHeaders = (headers, rows) =>
  headers.filter((header) =>
    rows.some((row) => normalizeText(row?.[header]) !== ""),
  );

const filterRowsByRetailer = (rows) => {
  // T?m t?t l?c theo retailer ?? gi? to?n b? d?ng Excel.
  return rows;
};

const filterSelectableRows = (rows) => rows.filter((row) => !row.__sentToKiot);

const parseMoneyValue = (value) => {
  const text = normalizeText(value).replace(/,/g, "");
  if (!text) return 0;

  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
};

const sumMoneyColumn = (rows, header) =>
  rows.reduce((total, row) => total + parseMoneyValue(row?.[header]), 0);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getOrderDeliveryCode = (row) =>
  normalizeText(row["Mã vận đơn"] || row["Mã Vận Đơn"] || row["mã vận đơn"]);

const stripOrderDeliveryData = (row) => {
  const {
    __orderDelivery,
    __orderDeliveryLoaded,
    __orderDeliveryMissingInvoice,
    ...rest
  } = row || {};
  return rest;
};

const mergeOrderDeliveryIntoRow = (row, orderDelivery) => ({
  ...row,
  "Mã HD Kiot":
    normalizeText(orderDelivery.invoiceId || orderDelivery.invoiceIdCode) ||
    row["Mã HD Kiot"] ||
    "",
  "Đối tác chuyển tiền":
    orderDelivery.partnerDeliveryName || row["Đối tác chuyển tiền"] || "",
  "Nhân viên":
    orderDelivery.employeeName ||
    orderDelivery.givenName ||
    row["Nhân viên"] ||
    "",
  "Tiền hàng": row["Tiền thu hộ(VNĐ)"] ?? orderDelivery.invoiceTotal ?? "",
  "Phí ship NVC thu": row["Tiền cước (VNĐ)"] ?? orderDelivery.totalPrice ?? "",
  "Số điện thoại": orderDelivery.phoneNumber || row["Số điện thoại"] || "",
  PartnerName: orderDelivery.partnerDeliveryName || row.PartnerName || "",
  PartnerCode: orderDelivery.partnerDeliveryCode || row.PartnerCode || "",
  __orderDelivery: orderDelivery,
  __orderDeliveryLoaded: true,
  __orderDeliveryMissingInvoice: !normalizeText(
    orderDelivery.invoiceId || orderDelivery.invoiceIdCode,
  ),
});

export default function CashFlowApp() {
  const [retailer, setRetailer] = useState("kingfarm");
  const [partnerDeliveries, setPartnerDeliveries] = useState([]);
  const [partnerDeliveryError, setPartnerDeliveryError] = useState("");
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankAccountError, setBankAccountError] = useState("");
  const [fileInfo, setFileInfo] = useState(null);
  const [sheetName, setSheetName] = useState("");
  const [sourceWorkbook, setSourceWorkbook] = useState(null);
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceFileBuffer, setSourceFileBuffer] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [excelError, setExcelError] = useState("");
  const [fileName, setFileName] = useState("");
  const [payloadError, setPayloadError] = useState("");
  const [currentAccessToken, setCurrentAccessToken] = useState("");
  const [currentAccessPrivateToken, setCurrentAccessPrivateToken] =
    useState("");
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const [sendingPayloads, setSendingPayloads] = useState(false);
  const [sendPayloadProgress, setSendPayloadProgress] = useState({
    runId: 0,
    active: false,
    total: 0,
    completed: 0,
  });
  const [orderDeliveryLoadProgress, setOrderDeliveryLoadProgress] = useState({
    runId: 0,
    active: false,
    total: 0,
    completed: 0,
  });
  const orderDeliveryInFlightRef = useRef(new Set());
  const orderDeliveryBulkRunIdRef = useRef(0);
  const sendPayloadRunIdRef = useRef(0);
  const sourceExcelRef = useRef({
    workbook: null,
    file: null,
    fileBuffer: null,
    sheetName: "",
  });

  const addToast = ({ type, title, message }) => {
    const id = toastIdRef.current++;
    setToasts((currentToasts) => [
      ...currentToasts,
      { id, type, title, message },
    ]);

    window.setTimeout(() => {
      setToasts((currentToasts) =>
        currentToasts.filter((toast) => toast.id !== id),
      );
    }, 5000);
  };

  const dismissToast = (toastId) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId),
    );
  };

  const [exportingExcel, setExportingExcel] = useState(false);

  const cancelSendPayloadProgress = () => {
    sendPayloadRunIdRef.current += 1;
    setSendPayloadProgress((current) =>
      current.active ? { ...current, active: false } : current,
    );
  };

  const startSendPayloadProgress = (total) => {
    const runId = sendPayloadRunIdRef.current + 1;
    sendPayloadRunIdRef.current = runId;
    setSendPayloadProgress({
      runId,
      active: total > 0,
      total,
      completed: 0,
    });
    return runId;
  };

  const cancelBulkOrderDeliveryLoad = () => {
    orderDeliveryBulkRunIdRef.current += 1;
    setOrderDeliveryLoadProgress((current) =>
      current.active ? { ...current, active: false } : current,
    );
  };

  const startBulkOrderDeliveryLoad = (total) => {
    const runId = orderDeliveryBulkRunIdRef.current + 1;
    orderDeliveryBulkRunIdRef.current = runId;
    setOrderDeliveryLoadProgress({
      runId,
      active: total > 0,
      total,
      completed: 0,
    });
    return runId;
  };

  const loadOrderDeliveryForRow = async (row) => {
    const deliveryCode = getOrderDeliveryCode(row);

    if (!deliveryCode || row.__orderDeliveryLoaded) {
      return;
    }

    if (orderDeliveryInFlightRef.current.has(deliveryCode)) {
      return;
    }

    orderDeliveryInFlightRef.current.add(deliveryCode);

    try {
      let accessPrivateToken = currentAccessPrivateToken;
      let accessToken = currentAccessToken;
      if (!accessPrivateToken) {
        accessPrivateToken = await getAccessPrivateToken(retailer);
        setCurrentAccessPrivateToken(accessPrivateToken);
        setCookie(
          getPrivateTokenCookieName(retailer),
          accessPrivateToken || "",
        );
      }

      const response = await getOrderDelivery(
        retailer,
        accessPrivateToken,
        deliveryCode,
        accessToken,
      );
      const orderDelivery = Array.isArray(response)
        ? response[0]
        : response?.data?.[0] || response?.Data?.[0] || response;

      if (!orderDelivery || typeof orderDelivery !== "object") {
        setAllRows((currentRows) =>
          currentRows.map((item) =>
            getOrderDeliveryCode(item) === deliveryCode
              ? {
                  ...item,
                  __orderDelivery: null,
                  __orderDeliveryLoaded: true,
                  __orderDeliveryMissingInvoice: true,
                }
              : item,
          ),
        );
        return;
      }

      setAllRows((currentRows) =>
        currentRows.map((item) =>
          getOrderDeliveryCode(item) === deliveryCode
            ? mergeOrderDeliveryIntoRow(item, orderDelivery)
            : item,
        ),
      );
    } catch (error) {
      setPayloadError(
        error.message || `Không lấy được dữ liệu mã vận đơn ${deliveryCode}`,
      );
      addToast({
        type: "error",
        title: "Lỗi tải mã vận đơn",
        message:
          error.message || `Không lấy được dữ liệu mã vận đơn ${deliveryCode}`,
      });
    } finally {
      orderDeliveryInFlightRef.current.delete(deliveryCode);
    }
  };

  const loadOrderDeliveryRowsInBatches = async (rows) => {
    const total = rows.length;
    const runId = startBulkOrderDeliveryLoad(total);

    try {
      for (let index = 0; index < rows.length; index += 1) {
        if (orderDeliveryBulkRunIdRef.current !== runId) {
          return;
        }

        const row = rows[index];
        await loadOrderDeliveryForRow(row);

        if (orderDeliveryBulkRunIdRef.current !== runId) {
          return;
        }

        const completed = index + 1;
        setOrderDeliveryLoadProgress((current) =>
          current.runId === runId
            ? {
                ...current,
                active: completed < total,
                total,
                completed,
              }
            : current,
        );

        if (index === rows.length - 1) {
          break;
        }

        await sleep(ORDER_DELIVERY_ROW_DELAY_MS);

        const completedCount = index + 1;
        if (completedCount % ORDER_DELIVERY_BATCH_SIZE === 0) {
          await sleep(ORDER_DELIVERY_BATCH_PAUSE_MS);
        }
      }
    } finally {
      setOrderDeliveryLoadProgress((current) =>
        current.runId === runId
          ? {
              ...current,
              active: false,
              total,
              completed: Math.min(current.completed || 0, total),
            }
          : current,
      );
    }
  };

  useEffect(() => {
    let ignore = false;

    async function loadRetailerData() {
      setPartnerDeliveryError("");
      setBankAccountError("");
      setPartnerDeliveries([]);
      setBankAccounts([]);

      try {
        const accessToken = await getAccessToken(retailer);
        const PrivateToken = await getAccessPrivateToken(retailer);
        const [deliveries, accounts] = await Promise.all([
          getPartnerDelivery(retailer, PrivateToken),
          getBankAccount(retailer, PrivateToken),
        ]);

        if (ignore) return;

        setCurrentAccessToken(accessToken);
        setCurrentAccessPrivateToken(PrivateToken || "");
        setCookie(getPrivateTokenCookieName(retailer), PrivateToken || "");
        setPartnerDeliveries(Array.isArray(deliveries) ? deliveries : []);
        setBankAccounts(Array.isArray(accounts) ? accounts : []);
      } catch (error) {
        if (!ignore) {
          setPartnerDeliveryError(
            error.message || "Không lấy được danh sách partnerDelivery",
          );
          setBankAccountError(
            error.message || "Không lấy được danh sách bank account",
          );
        }
      }
    }

    loadRetailerData();

    return () => {
      ignore = true;
    };
  }, [retailer]);

  const visibleRows = useMemo(
    () => filterRowsByRetailer(allRows, retailer),
    [allRows, retailer],
  );

  const visibleHeaders = useMemo(
    () => getVisibleHeaders(headers, allRows),
    [headers, allRows],
  );

  const selectedRows = useMemo(
    () =>
      allRows.filter(
        (row) => selectedIds.has(row.__rowId) && !row.__sentToKiot,
      ),
    [allRows, selectedIds],
  );

  const selectedCountInView = useMemo(
    () =>
      visibleRows.filter(
        (row) => selectedIds.has(row.__rowId) && !row.__sentToKiot,
      ).length,
    [visibleRows, selectedIds],
  );

  const excelTotals = useMemo(() => {
    const moneyTotal = sumMoneyColumn(allRows, "Tiền thu hộ(VNĐ)");
    const shipTotal = sumMoneyColumn(allRows, "Tiền cước (VNĐ)");

    return {
      moneyTotal,
      shipTotal,
      combinedTotal: moneyTotal - shipTotal,
    };
  }, [allRows]);

  const payloadSourceRows = useMemo(
    () =>
      selectedRows.length > 0
        ? selectedRows
        : filterSelectableRows(visibleRows),
    [selectedRows, visibleRows],
  );

  const payloadReadyRows = useMemo(
    () =>
      payloadSourceRows.filter(
        (row) => hasCashflowInvoiceId(row) && !row.__orderDeliveryMissingInvoice,
      ),
    [payloadSourceRows],
  );

  const missingInvoiceRows = useMemo(
    () =>
      payloadSourceRows.filter(
        (row) => row.__orderDeliveryMissingInvoice === true,
      ),
    [payloadSourceRows],
  );

  useEffect(() => {
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set();

      prev.forEach((rowId) => {
        const row = allRows.find((item) => item.__rowId === rowId);
        if (row && !row.__sentToKiot) {
          next.add(rowId);
        } else {
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [allRows]);

  const getPayloadEntriesForRow = (row) =>
    buildCashflowPayloadEntries(
      [row],
      [],
      partnerDeliveries,
      bankAccounts,
      retailer,
    );

  const generatedPayloads = useMemo(
    () =>
      buildCashflowPayloads(
        payloadReadyRows,
        [],
        partnerDeliveries,
        bankAccounts,
        retailer,
      ),
    [payloadReadyRows, partnerDeliveries, bankAccounts, retailer],
  );

  const handleRetailerChange = (nextRetailer) => {
    cancelBulkOrderDeliveryLoad();
    cancelSendPayloadProgress();
    setRetailer(nextRetailer);
    setSelectedIds(new Set());
    setCurrentAccessToken("");
    setCurrentAccessPrivateToken("");
    setSourceWorkbook(null);
    setSourceFile(null);
    setSourceFileBuffer(null);
    sourceExcelRef.current = {
      workbook: null,
      file: null,
      fileBuffer: null,
      sheetName: "",
    };
    setPartnerDeliveries([]);
    setBankAccounts([]);
    orderDeliveryInFlightRef.current.clear();
    setAllRows((currentRows) => currentRows.map(stripOrderDeliveryData));
  };

  const toggleRow = (rowId) => {
    const row = allRows.find((item) => item.__rowId === rowId);
    if (row?.__sentToKiot) {
      setSelectedIds((prev) => {
        if (!prev.has(rowId)) {
          return prev;
        }

        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
      return;
    }

    const isCurrentlySelected = selectedIds.has(rowId);

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });

    if (!isCurrentlySelected && row && getOrderDeliveryCode(row)) {
      void loadOrderDeliveryForRow(row);
    }
  };

  const handleClearSelection = () => {
    cancelBulkOrderDeliveryLoad();
    setSelectedIds(new Set());
  };

  const handleToggleVisibleSelection = () => {
    const selectableVisibleRows = filterSelectableRows(visibleRows);
    const visibleIds = selectableVisibleRows.map((row) => row.__rowId);
    if (visibleIds.length === 0) {
      return;
    }

    const allVisibleSelected = visibleIds.every((rowId) =>
      selectedIds.has(rowId),
    );

    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (allVisibleSelected) {
        visibleIds.forEach((rowId) => next.delete(rowId));
      } else {
        visibleIds.forEach((rowId) => next.add(rowId));
      }

      return next;
    });

    if (allVisibleSelected) {
      cancelBulkOrderDeliveryLoad();
      return;
    }

    const rowsToLoad = selectableVisibleRows.filter(
      (row) => !row.__orderDeliveryLoaded && getOrderDeliveryCode(row),
    );

    if (rowsToLoad.length === 0) {
      return;
    }

    orderDeliveryBulkRunIdRef.current += 1;
    void loadOrderDeliveryRowsInBatches(rowsToLoad);
  };

  const handleSendPayloads = async () => {
    let payloadEntries = [];
    let payloads = [];
    let runId = 0;

    try {
      setSendingPayloads(true);
      setPayloadError("");

      payloadEntries = buildCashflowPayloadEntries(
        payloadReadyRows,
        [],
        partnerDeliveries,
        bankAccounts,
        retailer,
      );
      payloads = payloadEntries.map((entry) => entry.payload);
      runId = startSendPayloadProgress(payloads.length);

      if (payloads.length === 0) {
        setSendPayloadProgress((current) =>
          current.runId === runId
            ? {
                ...current,
                active: false,
                total: 0,
                completed: 0,
              }
            : current,
        );
        addToast({
          type: missingInvoiceRows.length > 0 ? "warning" : "warning",
          title:
            missingInvoiceRows.length > 0
              ? "Có dòng thiếu mã hóa đơn"
              : "Không có dòng chưa gửi",
          message:
            missingInvoiceRows.length > 0
              ? `Có ${missingInvoiceRows.length} vận đơn thiếu mã hóa đơn. Xem danh sách bên phải để tự tạo KiotViet.`
              : "Các dòng đang chọn đều đã gửi Kiot rồi.",
        });
        return;
      }

      let accessToken = currentAccessToken;
      if (!accessToken) {
        accessToken = await getAccessToken(retailer);
        setCurrentAccessToken(accessToken);
      }

      const results = [];

      for (let index = 0; index < payloadEntries.length; index += 1) {
        const entry = payloadEntries[index];

        try {
          const value = await createCashFlow(
            retailer,
            accessToken,
            entry.payload,
            currentAccessPrivateToken,
          );
          results.push({ status: "fulfilled", value });
        } catch (error) {
          results.push({ status: "rejected", reason: error });
        }

        setSendPayloadProgress((current) =>
          current.runId === runId
            ? {
                ...current,
                active: true,
                total: payloadEntries.length,
                completed: index + 1,
              }
            : current,
        );

        if (index < payloadEntries.length - 1) {
          await sleep(SEND_REQUEST_DELAY_MS);
        }
      }

      const rowResults = new Map();

      payloadEntries.forEach((entry, index) => {
        if (!entry.rowId) return;

        const entryResult = results[index];
        const isFulfilled = entryResult?.status === "fulfilled";
        const existing = rowResults.get(entry.rowId) || {
          rowId: entry.rowId,
          summary: null,
          payloadCount: 0,
          succeeded: 0,
          failed: 0,
          details: [],
        };

        existing.payloadCount += 1;
        if (isFulfilled) {
          existing.succeeded += 1;
          existing.details.push({
            kind: entry.kind,
            label: entry.label,
            status: "success",
            message: "Thành công",
          });
        } else {
          existing.failed += 1;
          existing.details.push({
            kind: entry.kind,
            label: entry.label,
            status: "error",
            message: entryResult?.reason?.message || "Lỗi khi gửi payload",
          });
        }

        rowResults.set(entry.rowId, existing);
      });

      const detailRows = [];
      const successRowIds = new Set();

      rowResults.forEach((rowData) => {
        const isRowSuccess = rowData.failed === 0;
        if (isRowSuccess) successRowIds.add(rowData.rowId);
        detailRows.push({
          ...rowData,
          status: isRowSuccess ? "Thành công" : "Thất bại",
          message:
            rowData.failed === 0
              ? `Đã gửi ${rowData.payloadCount}/${rowData.payloadCount} payload`
              : `Đã gửi ${rowData.succeeded}/${rowData.payloadCount} payload, ${rowData.failed} lỗi`,
        });
      });

      if (successRowIds.size > 0) {
        setAllRows((currentRows) =>
          currentRows.map((row) =>
            successRowIds.has(row.__rowId)
              ? { ...row, __sentToKiot: true }
              : row,
          ),
        );
      }

      const successCount = results.filter(
        (item) => item.status === "fulfilled",
      ).length;
      const failedCount = results.length - successCount;
      const summaryText =
        failedCount === 0
          ? `Đã gửi thành công ${successCount}/${payloads.length} payload`
          : `Đã gửi thành công ${successCount}/${payloads.length} payload, ${failedCount} payload lỗi`;

      addToast({
        type: failedCount === 0 ? "success" : "warning",
        title:
          failedCount === 0 ? "Gửi KiotViet thành công" : "Gửi KiotViet có lỗi",
        message: summaryText,
      });

      return {
        successCount,
        failedCount,
        details: detailRows,
      };
    } catch (error) {
      const errorMessage = error.message || "Không gửi được payload";
      setPayloadError(errorMessage);
      addToast({
        type: "error",
        title: "Lỗi gửi dữ liệu",
        message: errorMessage,
      });
    } finally {
      if (runId > 0) {
        setSendPayloadProgress((current) =>
          current.runId === runId
            ? {
                ...current,
                active: false,
                total: payloads.length,
                completed: payloads.length,
              }
            : current,
        );
      }
      setSendingPayloads(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      setPayloadError("");

      if (allRows.length === 0) {
        addToast({
          type: "warning",
          title: "Không có dữ liệu",
          message: "Chưa có dòng nào để xuất Excel.",
        });
        return;
      }

      const baseName = fileName
        ? fileName.replace(/\.(xlsx|xls)$/i, "")
        : "exported";

      await exportExcelFile({
        workbook: sourceExcelRef.current.workbook || sourceWorkbook,
        file: sourceExcelRef.current.file || sourceFile,
        fileBuffer: sourceExcelRef.current.fileBuffer || sourceFileBuffer,
        sheetName: sourceExcelRef.current.sheetName || sheetName,
        rows: allRows,
        fileName: `${baseName}-checked.xlsx`,
      });
    } catch (error) {
      setPayloadError(error.message || "Không xuất được file Excel");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleFileChange = async (file) => {
    if (!file) return;

    cancelBulkOrderDeliveryLoad();
    cancelSendPayloadProgress();
    setExcelError("");
    setSelectedIds(new Set());
    setFileName(file.name);
    const fileBuffer = await file.arrayBuffer();
    setSourceFile(file);
    setSourceFileBuffer(fileBuffer);

    try {
      const result = await parseExcelFile(file);
      setSheetName(result.sheetName);
      setSourceWorkbook(result.workbook);
      sourceExcelRef.current = {
        workbook: result.workbook,
        file,
        fileBuffer,
        sheetName: result.sheetName,
      };
      setHeaders(result.headers);
      setAllRows(result.rows);
      setFileInfo(result.fileInfo);

      const sentCount = result.rows.filter((row) => row.__sentToKiot).length;
      if (sentCount > 0) {
        addToast({
          type: "warning",
          title: "Đã có dòng gửi Kiot",
          message: `Phát hiện ${sentCount} dòng đã gửi Kiot. Những dòng này sẽ không được chọn lại.`,
        });
      }
    } catch (error) {
      setExcelError(error.message || "Không đọc được file Excel");
      setSheetName("");
      setSourceWorkbook(null);
      setSourceFile(null);
      setSourceFileBuffer(null);
      sourceExcelRef.current = {
        workbook: null,
        file: null,
        fileBuffer: null,
        sheetName: "",
      };
      setHeaders([]);
      setAllRows([]);
      setFileInfo(null);
    }
  };

  // Giả sử bro đang lưu data excel trong state này
  // const [rows, setRows] = useState([]);

  const handleUpdateCell = (rowId, header, newValue) => {
    setAllRows((prevRows) =>
      prevRows.map((row) => {
        if (row.__rowId === rowId) {
          // 1. Cập nhật giá trị mới cho BẤT KỲ cột nào bro vừa sửa (Tiền, SĐT, Mã...)
          const updatedRow = { ...row, [header]: newValue };

          // 2. CHỈ reset lại trạng thái API khi sửa đúng cột "Mã vận đơn"
          // Các cột khác (như Tiền) sẽ không bị gọi lại API để tránh mất dữ liệu nhập tay
          // const headerName = header.trim().toLowerCase();
          // if (headerName === "mã vận đơn") {
          updatedRow.__orderDeliveryLoaded = false;
          updatedRow.__orderDelivery = null;
          // }

          return updatedRow;
        }
        return row;
      }),
    );
  };

  // Logic xuất ra file Excel mới (Dùng XLSX library)
  // Nhớ import thư viện xlsx ở đầu file nhé (nếu chưa có)
  // import * as XLSX from "xlsx";

  const handleSaveFile = () => {
    if (allRows.length === 0) {
      alert("Không có dữ liệu để lưu!");
      return;
    }

    try {
      // 1. Làm sạch dữ liệu: Chỉ lấy các cột nằm trong `headers`
      const exportData = allRows.map((row) => {
        const cleanRow = {};
        headers.forEach((header) => {
          cleanRow[header] = row[header];
        });
        return cleanRow;
      });

      // 2. Tạo Worksheet và Workbook mới
      const worksheet = XLSX.utils.json_to_sheet(exportData, {
        header: headers,
      });
      const workbook = XLSX.utils.book_new();

      // Lấy tên sheet cũ, nếu không có thì mặc định là "Sheet1"
      const sheetToSave = sheetName || "Sheet1";
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetToSave);

      // 3. Đặt tên file mới và kích hoạt tải về
      // Tự động thêm chữ "Edited_" đằng trước tên file gốc
      const newFileName = fileName ? `Edited_${fileName}` : "Data_Da_Sua.xlsx";
      XLSX.writeFile(workbook, newFileName);
      const newToast = {
        id: toastIdRef.current++,
        message: "Lưu file thành công!",
        type: "success",
      };
      setToasts((prev) => [...prev, newToast]);
    } catch (error) {
      console.error("Lỗi khi lưu file Excel:", error);
      setExcelError("Không thể lưu file Excel lúc này.");
    }
  };

  return (
    <div className="app-shell">
      <style>{cashflowStyles}</style>
      <header className="hero">
        <div>
          <p className="eyebrow">Excel to Object Picker</p>
          <h1>Tạo sổ quỹ từ file Excel và gửi lên KiotViet</h1>
          <p className="hero-copy">
            Dành cho team vận hành và marketing dùng nhanh mà không cần hiểu kỹ
            cấu trúc dữ liệu. Làm theo 3 bước dưới đây là xong:
          </p>
          <ol className="hero-steps">
            <li>
              <strong>1. Chọn nguồn dữ liệu</strong>
              <span>Chọn công ty, nhân viên và tải file Excel cần xử lý.</span>
            </li>
            <li>
              <strong>2. Chọn dòng cần tạo sổ quỹ</strong>
              <span>
                Tick những dòng cần dùng, hoặc để trống nếu muốn lấy toàn bộ dữ
                liệu đang hiển thị.
              </span>
            </li>
            <li>
              <strong>3. Kiểm tra payload rồi gửi lên KiotViet</strong>
              <span>
                Dòng được tự động tách thành payload dựa trên dữ liệu. Kiểm tra
                chi tiết rồi nhấn "Gửi dữ liệu lên KiotViet".
              </span>
            </li>
          </ol>
        </div>

        <ControlsPanel
          retailer={retailer}
          onRetailerChange={handleRetailerChange}
          onFileChange={handleFileChange}
          retailers={RETAILERS}
          moneyTotal={excelTotals.moneyTotal}
          shipTotal={excelTotals.shipTotal}
          combinedTotal={excelTotals.combinedTotal}
          orderDeliveryProgress={orderDeliveryLoadProgress}
        />
      </header>

      {(excelError || partnerDeliveryError || bankAccountError) && (
        <div className="notice error">
          {excelError || partnerDeliveryError || bankAccountError}
        </div>
      )}

      {payloadError && <div className="notice error">{payloadError}</div>}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <StatsGrid
        fileName={fileInfo?.fileName || fileName || "Chưa chọn file"}
        sheetName={sheetName || "-"}
        rowCount={fileInfo?.rowCount ?? 0}
        selectedCount={selectedRows.length}
      />

      <section className="content-grid">
        <ExcelTable
          headers={visibleHeaders}
          rows={visibleRows}
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onClearSelection={handleClearSelection}
          onToggleVisibleSelection={handleToggleVisibleSelection}
          selectedCountInView={selectedCountInView}
          onUpdateCell={handleUpdateCell}
          onSaveFile={handleSaveFile}
        />

          <SelectedRowsPanel
            selectedRows={selectedRows}
            generatedPayloads={generatedPayloads}
            getPayloadEntriesForRow={getPayloadEntriesForRow}
            onSendPayloads={handleSendPayloads}
            onExportExcel={handleExportExcel}
            isSendingPayloads={sendingPayloads}
            sendPayloadProgress={sendPayloadProgress}
            isExportingExcel={exportingExcel}
            payloadSourceCount={payloadSourceRows.length}
            missingInvoiceRows={missingInvoiceRows}
          />
      </section>
    </div>
  );
}
