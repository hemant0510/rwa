"use client";

import Link from "next/link";

import { Building2, Calendar, CreditCard, ScrollText, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";

interface SocietyResult {
  id: string;
  name: string;
  societyCode: string;
  status: string;
  city: string | null;
}

interface ResidentResult {
  id: string;
  name: string;
  email: string;
  status: string;
  societyId: string | null;
  society: { name: string } | null;
}

interface PaymentResult {
  id: string;
  amount: number | string;
  receiptNo: string;
  referenceNo: string | null;
  paymentDate: string;
  societyId: string;
  user: { name: string };
  society: { name: string };
}

interface EventResult {
  id: string;
  title: string;
  status: string;
  societyId: string;
  society: { name: string };
}

interface PetitionResult {
  id: string;
  title: string;
  status: string;
  societyId: string;
  society: { name: string };
}

export interface SearchResultsData {
  societies: SocietyResult[];
  residents: ResidentResult[];
  payments: PaymentResult[];
  events: EventResult[];
  petitions: PetitionResult[];
}

interface SearchResultsProps {
  results: SearchResultsData;
  onSelect: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  TRIAL: "bg-blue-100 text-blue-700",
  SUSPENDED: "bg-red-100 text-red-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  PUBLISHED: "bg-green-100 text-green-700",
  DRAFT: "bg-gray-100 text-gray-700",
  OPEN: "bg-blue-100 text-blue-700",
  CLOSED: "bg-gray-100 text-gray-700",
};

function ResultGroup({
  title,
  icon: Icon,
  children,
  count,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  count: number;
}) {
  if (count === 0) return null;
  return (
    <div>
      <div className="text-muted-foreground flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}

function ResultItem({
  href,
  primary,
  secondary,
  status,
  onSelect,
}: {
  href: string;
  primary: string;
  secondary?: string;
  status?: string;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      className="hover:bg-accent flex items-center justify-between px-3 py-2 text-sm transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{primary}</p>
        {secondary && <p className="text-muted-foreground truncate text-xs">{secondary}</p>}
      </div>
      {status && (
        <Badge
          variant="outline"
          className={`ml-2 shrink-0 border-0 text-xs ${STATUS_COLORS[status] ?? ""}`}
        >
          {status}
        </Badge>
      )}
    </Link>
  );
}

export function SearchResults({ results, onSelect }: SearchResultsProps) {
  const totalCount =
    results.societies.length +
    results.residents.length +
    results.payments.length +
    results.events.length +
    results.petitions.length;

  if (totalCount === 0) {
    return <div className="text-muted-foreground py-6 text-center text-sm">No results found</div>;
  }

  return (
    <div className="divide-y">
      <ResultGroup title="Societies" icon={Building2} count={results.societies.length}>
        {results.societies.map((s) => (
          <ResultItem
            key={s.id}
            href={`/sa/societies/${s.id}`}
            primary={s.name}
            secondary={`${s.societyCode}${s.city ? ` \u2022 ${s.city}` : ""}`}
            status={s.status}
            onSelect={onSelect}
          />
        ))}
      </ResultGroup>

      <ResultGroup title="Residents" icon={Users} count={results.residents.length}>
        {results.residents.map((r) => (
          <ResultItem
            key={r.id}
            href={r.societyId ? `/sa/societies/${r.societyId}` : "/sa/residents"}
            primary={r.name}
            secondary={r.society?.name ?? r.email}
            status={r.status}
            onSelect={onSelect}
          />
        ))}
      </ResultGroup>

      <ResultGroup title="Payments" icon={CreditCard} count={results.payments.length}>
        {results.payments.map((p) => (
          <ResultItem
            key={p.id}
            href={`/sa/societies/${p.societyId}`}
            primary={`\u20B9${Number(p.amount).toLocaleString("en-IN")} \u2022 ${p.receiptNo}`}
            secondary={`${p.user.name} \u2022 ${p.society.name} \u2022 ${new Date(p.paymentDate).toLocaleDateString("en-IN")}`}
            onSelect={onSelect}
          />
        ))}
      </ResultGroup>

      <ResultGroup title="Events" icon={Calendar} count={results.events.length}>
        {results.events.map((e) => (
          <ResultItem
            key={e.id}
            href={`/sa/societies/${e.societyId}`}
            primary={e.title}
            secondary={e.society.name}
            status={e.status}
            onSelect={onSelect}
          />
        ))}
      </ResultGroup>

      <ResultGroup title="Petitions" icon={ScrollText} count={results.petitions.length}>
        {results.petitions.map((p) => (
          <ResultItem
            key={p.id}
            href={`/sa/societies/${p.societyId}`}
            primary={p.title}
            secondary={p.society.name}
            status={p.status}
            onSelect={onSelect}
          />
        ))}
      </ResultGroup>
    </div>
  );
}
