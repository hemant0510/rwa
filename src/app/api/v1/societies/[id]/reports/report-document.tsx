import React from "react";

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export const reportStyles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { marginBottom: 24 },
  societyName: { fontSize: 16, fontWeight: "bold", color: "#18181b" },
  reportTitle: { fontSize: 12, color: "#52525b", marginTop: 4 },
  meta: { fontSize: 9, color: "#71717a", marginTop: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e4e4e7", marginVertical: 10 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f4f4f5",
    padding: "5 8",
    borderRadius: 3,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    padding: "4 8",
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  tableRowAlt: {
    flexDirection: "row",
    padding: "4 8",
    backgroundColor: "#fafafa",
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  th: { fontSize: 9, fontWeight: "bold", color: "#52525b" },
  td: { fontSize: 9, color: "#1a1a1a" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#a1a1aa",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  summaryLabel: { color: "#71717a", fontSize: 10 },
  summaryValue: { fontWeight: "bold", fontSize: 10 },
});

interface ReportHeaderProps {
  societyName: string;
  title: string;
  sessionYear?: string;
  generatedAt: string;
}

export function ReportHeader({ societyName, title, sessionYear, generatedAt }: ReportHeaderProps) {
  return (
    <View style={reportStyles.header}>
      <Text style={reportStyles.societyName}>{societyName}</Text>
      <Text style={reportStyles.reportTitle}>{title}</Text>
      {sessionYear && <Text style={reportStyles.meta}>Session: {sessionYear}</Text>}
      <Text style={reportStyles.meta}>Generated: {generatedAt}</Text>
      <View style={reportStyles.divider} />
    </View>
  );
}

export function ReportFooter({ page, total }: { page: number; total?: number }) {
  return (
    <View style={reportStyles.footer} fixed>
      <Text>RWA Connect — Confidential</Text>
      <Text>{total ? `Page ${page} of ${total}` : `Page ${page}`}</Text>
    </View>
  );
}

interface TableColumn {
  header: string;
  flex?: number;
  align?: "left" | "right" | "center";
}

interface ReportTableProps {
  columns: TableColumn[];
  rows: (string | number)[][];
}

export function ReportTable({ columns, rows }: ReportTableProps) {
  return (
    <View>
      <View style={reportStyles.tableHeader}>
        {columns.map((col, i) => (
          <Text
            key={i}
            style={[reportStyles.th, { flex: col.flex ?? 1, textAlign: col.align ?? "left" }]}
          >
            {col.header}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={ri % 2 === 0 ? reportStyles.tableRow : reportStyles.tableRowAlt}>
          {row.map((cell, ci) => (
            <Text
              key={ci}
              style={[
                reportStyles.td,
                {
                  flex: columns[ci]?.flex ?? 1,
                  textAlign: columns[ci]?.align ?? "left",
                },
              ]}
            >
              {String(cell ?? "")}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Specific Report Documents ────────────────────────────────────────────────

interface PaidListDocProps {
  societyName: string;
  sessionYear: string;
  generatedAt: string;
  rows: { name: string; rwaid: string; unit: string; amount: number; paidAt: string }[];
}

export function PaidListDocument({
  societyName,
  sessionYear,
  generatedAt,
  rows,
}: PaidListDocProps) {
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <Document>
      <Page size="A4" style={reportStyles.page}>
        <ReportHeader
          societyName={societyName}
          title="Fee Collection Report — Paid"
          sessionYear={sessionYear}
          generatedAt={generatedAt}
        />
        <ReportTable
          columns={[
            { header: "Name", flex: 2 },
            { header: "RWAID", flex: 2 },
            { header: "Unit", flex: 1.5 },
            { header: "Amount", flex: 1, align: "right" },
            { header: "Paid On", flex: 1.5 },
          ]}
          rows={rows.map((r) => [r.name, r.rwaid, r.unit, fmt(r.amount), r.paidAt])}
        />
        <View style={[reportStyles.divider, { marginTop: 10 }]} />
        <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingRight: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: "bold" }}>
            Total Collected: ₹{fmt(total)} ({rows.length} residents)
          </Text>
        </View>
        <ReportFooter page={1} />
      </Page>
    </Document>
  );
}

interface PendingListDocProps {
  societyName: string;
  sessionYear: string;
  generatedAt: string;
  rows: { name: string; rwaid: string; unit: string; amountDue: number; dueDate?: string }[];
}

export function PendingListDocument({
  societyName,
  sessionYear,
  generatedAt,
  rows,
}: PendingListDocProps) {
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const total = rows.reduce((s, r) => s + r.amountDue, 0);

  return (
    <Document>
      <Page size="A4" style={reportStyles.page}>
        <ReportHeader
          societyName={societyName}
          title="Outstanding Dues Report — Pending"
          sessionYear={sessionYear}
          generatedAt={generatedAt}
        />
        <ReportTable
          columns={[
            { header: "Name", flex: 2 },
            { header: "RWAID", flex: 2 },
            { header: "Unit", flex: 1.5 },
            { header: "Amount Due", flex: 1, align: "right" },
          ]}
          rows={rows.map((r) => [r.name, r.rwaid, r.unit, fmt(r.amountDue)])}
        />
        <View style={[reportStyles.divider, { marginTop: 10 }]} />
        <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingRight: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: "bold" }}>
            Total Outstanding: ₹{fmt(total)} ({rows.length} residents)
          </Text>
        </View>
        <ReportFooter page={1} />
      </Page>
    </Document>
  );
}

interface DirectoryDocProps {
  societyName: string;
  generatedAt: string;
  rows: {
    name: string;
    rwaid: string;
    unit: string;
    mobile: string;
    email: string;
    type: string;
  }[];
}

export function DirectoryDocument({ societyName, generatedAt, rows }: DirectoryDocProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={reportStyles.page}>
        <ReportHeader
          societyName={societyName}
          title="Resident Directory"
          generatedAt={generatedAt}
        />
        <ReportTable
          columns={[
            { header: "Name", flex: 2 },
            { header: "RWAID", flex: 1.5 },
            { header: "Unit", flex: 1 },
            { header: "Mobile", flex: 1.5 },
            { header: "Email", flex: 2 },
            { header: "Type", flex: 1 },
          ]}
          rows={rows.map((r) => [r.name, r.rwaid, r.unit, r.mobile, r.email, r.type])}
        />
        <ReportFooter page={1} />
      </Page>
    </Document>
  );
}

interface ExpenseSummaryDocProps {
  societyName: string;
  sessionYear: string;
  generatedAt: string;
  rows: { date: string; category: string; description: string; amount: number }[];
  totalExpenses: number;
}

export function ExpenseSummaryDocument({
  societyName,
  sessionYear,
  generatedAt,
  rows,
  totalExpenses,
}: ExpenseSummaryDocProps) {
  const fmt = (n: number) => n.toLocaleString("en-IN");

  return (
    <Document>
      <Page size="A4" style={reportStyles.page}>
        <ReportHeader
          societyName={societyName}
          title="Expense Ledger"
          sessionYear={sessionYear}
          generatedAt={generatedAt}
        />
        <ReportTable
          columns={[
            { header: "Date", flex: 1.2 },
            { header: "Category", flex: 1.5 },
            { header: "Description", flex: 3 },
            { header: "Amount", flex: 1, align: "right" },
          ]}
          rows={rows.map((r) => [r.date, r.category, r.description, fmt(r.amount)])}
        />
        <View style={[reportStyles.divider, { marginTop: 10 }]} />
        <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingRight: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: "bold" }}>
            Total Expenses: ₹{fmt(totalExpenses)}
          </Text>
        </View>
        <ReportFooter page={1} />
      </Page>
    </Document>
  );
}

interface PetitionReportDocProps {
  societyName: string;
  generatedAt: string;
  petition: {
    title: string;
    description: string | null;
    type: string;
    targetAuthority: string | null;
    submittedAt: Date | null;
  };
  signatories: { name: string; unit: string; method: string; signedAt: Date }[];
}

export function PetitionReportDocument({
  societyName,
  generatedAt,
  petition,
  signatories,
}: PetitionReportDocProps) {
  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <Document>
      <Page size="A4" style={reportStyles.page}>
        <ReportHeader
          societyName={societyName}
          title={`Petition Report — ${petition.title}`}
          generatedAt={generatedAt}
        />
        <View style={{ marginBottom: 10 }}>
          <View style={reportStyles.summaryRow}>
            <Text style={reportStyles.summaryLabel}>Type</Text>
            <Text style={reportStyles.summaryValue}>
              {petition.type.charAt(0) + petition.type.slice(1).toLowerCase()}
            </Text>
          </View>
          {petition.targetAuthority ? (
            <View style={reportStyles.summaryRow}>
              <Text style={reportStyles.summaryLabel}>Target Authority</Text>
              <Text style={reportStyles.summaryValue}>{petition.targetAuthority}</Text>
            </View>
          ) : null}
          {petition.submittedAt ? (
            <View style={reportStyles.summaryRow}>
              <Text style={reportStyles.summaryLabel}>Submitted On</Text>
              <Text style={reportStyles.summaryValue}>{fmtDate(petition.submittedAt)}</Text>
            </View>
          ) : null}
          <View style={reportStyles.summaryRow}>
            <Text style={reportStyles.summaryLabel}>Total Signatures</Text>
            <Text style={reportStyles.summaryValue}>{signatories.length}</Text>
          </View>
        </View>
        {petition.description ? (
          <View style={{ marginBottom: 10 }}>
            <Text style={[reportStyles.th, { marginBottom: 4 }]}>Description</Text>
            <Text style={[reportStyles.td, { lineHeight: 1.5 }]}>{petition.description}</Text>
            <View style={reportStyles.divider} />
          </View>
        ) : null}
        <ReportTable
          columns={[
            { header: "Name", flex: 2 },
            { header: "Unit", flex: 1 },
            { header: "Method", flex: 1 },
            { header: "Date Signed", flex: 1.5 },
          ]}
          rows={signatories.map((s) => [
            s.name,
            s.unit,
            s.method.charAt(0) + s.method.slice(1).toLowerCase(),
            fmtDate(s.signedAt),
          ])}
        />
        <ReportFooter page={1} />
      </Page>
    </Document>
  );
}

interface CollectionSummaryDocProps {
  societyName: string;
  sessionYear: string;
  generatedAt: string;
  totalResidents: number;
  paidCount: number;
  pendingCount: number;
  totalCollected: number;
  totalOutstanding: number;
  totalExpenses: number;
  balance: number;
}

export function CollectionSummaryDocument({
  societyName,
  sessionYear,
  generatedAt,
  totalResidents,
  paidCount,
  pendingCount,
  totalCollected,
  totalOutstanding,
  totalExpenses,
  balance,
}: CollectionSummaryDocProps) {
  const fmt = (n: number) => n.toLocaleString("en-IN");

  const summaryRows = [
    ["Total Residents", String(totalResidents)],
    ["Paid", String(paidCount)],
    ["Pending", String(pendingCount)],
    ["Total Collected (₹)", fmt(totalCollected)],
    ["Total Outstanding (₹)", fmt(totalOutstanding)],
    ["Total Expenses (₹)", fmt(totalExpenses)],
    ["Balance in Hand (₹)", fmt(balance)],
  ];

  return (
    <Document>
      <Page size="A4" style={reportStyles.page}>
        <ReportHeader
          societyName={societyName}
          title="Financial Summary"
          sessionYear={sessionYear}
          generatedAt={generatedAt}
        />
        {summaryRows.map(([label, value], i) => (
          <View key={i} style={reportStyles.summaryRow}>
            <Text style={reportStyles.summaryLabel}>{label}</Text>
            <Text style={reportStyles.summaryValue}>{value}</Text>
          </View>
        ))}
        <ReportFooter page={1} />
      </Page>
    </Document>
  );
}
