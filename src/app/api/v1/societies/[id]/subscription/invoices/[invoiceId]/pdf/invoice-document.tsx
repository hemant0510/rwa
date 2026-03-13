import React from "react";

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  title: { fontSize: 22, fontWeight: "bold", color: "#18181b" },
  subtitle: { fontSize: 10, color: "#71717a", marginTop: 4 },
  badge: {
    fontSize: 10,
    padding: "4 10",
    borderRadius: 4,
    backgroundColor: "#f4f4f5",
    color: "#52525b",
    alignSelf: "flex-start",
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#18181b",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    paddingBottom: 4,
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#71717a", width: 140 },
  value: { flex: 1, textAlign: "right" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f4f4f5",
    padding: "6 8",
    borderRadius: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    padding: "4 8",
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  tableCell: { flex: 1 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e4e4e7", marginVertical: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", padding: "8 0" },
  totalLabel: { fontSize: 12, fontWeight: "bold" },
  totalValue: { fontSize: 12, fontWeight: "bold" },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    color: "#a1a1aa",
    fontSize: 8,
  },
});

interface InvoiceData {
  invoiceNo: string;
  status: string;
  planName: string;
  billingCycle: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  paidAmount: number;
  society: {
    name: string;
    code: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  payments: Array<{
    amount: number;
    mode: string;
    date: string;
    referenceNo: string;
  }>;
  createdAt: string;
}

function formatINR(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function InvoicePDFDocument(data: InvoiceData) {
  const outstanding = Math.max(0, data.finalAmount - data.paidAmount);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.subtitle}>{data.invoiceNo}</Text>
            <Text style={styles.subtitle}>Date: {data.createdAt}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.badge}>{data.status}</Text>
            <Text style={[styles.subtitle, { marginTop: 8 }]}>Due: {data.dueDate}</Text>
          </View>
        </View>

        {/* Bill To */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={{ fontWeight: "bold", marginBottom: 2 }}>{data.society.name}</Text>
          {data.society.code ? (
            <Text style={{ color: "#71717a", marginBottom: 2 }}>Code: {data.society.code}</Text>
          ) : null}
          {data.society.address ? (
            <Text style={{ color: "#52525b" }}>{data.society.address}</Text>
          ) : null}
          <Text style={{ color: "#52525b" }}>
            {[data.society.city, data.society.state, data.society.pincode]
              .filter(Boolean)
              .join(", ")}
          </Text>
        </View>

        {/* Plan Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Plan</Text>
            <Text style={styles.value}>{data.planName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Billing Cycle</Text>
            <Text style={styles.value}>{data.billingCycle}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Period</Text>
            <Text style={styles.value}>
              {data.periodStart} to {data.periodEnd}
            </Text>
          </View>
        </View>

        {/* Amount Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amount</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Base Amount</Text>
            <Text style={styles.value}>{formatINR(data.baseAmount)}</Text>
          </View>
          {data.discountAmount > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Discount</Text>
              <Text style={[styles.value, { color: "#16a34a" }]}>
                -{formatINR(data.discountAmount)}
              </Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Due</Text>
            <Text style={styles.totalValue}>{formatINR(data.finalAmount)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Paid</Text>
            <Text style={[styles.value, { color: "#16a34a" }]}>{formatINR(data.paidAmount)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { fontWeight: "bold" }]}>Outstanding</Text>
            <Text
              style={[
                styles.value,
                { fontWeight: "bold", color: outstanding > 0 ? "#dc2626" : "#16a34a" },
              ]}
            >
              {formatINR(outstanding)}
            </Text>
          </View>
        </View>

        {/* Payment History */}
        {data.payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment History</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, { fontWeight: "bold" }]}>Date</Text>
              <Text style={[styles.tableCell, { fontWeight: "bold" }]}>Amount</Text>
              <Text style={[styles.tableCell, { fontWeight: "bold" }]}>Mode</Text>
              <Text style={[styles.tableCell, { fontWeight: "bold" }]}>Reference</Text>
            </View>
            {data.payments.map((p, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.tableCell}>{p.date}</Text>
                <Text style={styles.tableCell}>{formatINR(p.amount)}</Text>
                <Text style={styles.tableCell}>{p.mode.replace("_", " ")}</Text>
                <Text style={styles.tableCell}>{p.referenceNo}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          This is a system-generated invoice. For queries, contact your platform administrator.
        </Text>
      </Page>
    </Document>
  );
}
