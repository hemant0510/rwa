"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SocietyTabsProps {
  children: React.ReactNode;
  defaultTab?: string;
}

const TAB_ITEMS = [
  { value: "overview", label: "Overview" },
  { value: "residents", label: "Residents" },
  { value: "fees", label: "Fees" },
  { value: "expenses", label: "Expenses" },
  { value: "events", label: "Events" },
  { value: "petitions", label: "Petitions" },
  { value: "reports", label: "Reports" },
  { value: "broadcasts", label: "Broadcasts" },
  { value: "governing-body", label: "Governing Body" },
  { value: "migrations", label: "Migrations" },
  { value: "settings", label: "Settings" },
];

export function SocietyTabs({ children, defaultTab = "overview" }: SocietyTabsProps) {
  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="flex flex-wrap">
        {TAB_ITEMS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}

export { TabsContent, TAB_ITEMS };
