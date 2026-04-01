import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { BroadcastsTab } from "@/components/features/sa-society/BroadcastsTab";
import { EventsTab } from "@/components/features/sa-society/EventsTab";
import { ExpensesTab } from "@/components/features/sa-society/ExpensesTab";
import { FeesTab } from "@/components/features/sa-society/FeesTab";
import { GoverningBodyTab } from "@/components/features/sa-society/GoverningBodyTab";
import { MigrationsTab } from "@/components/features/sa-society/MigrationsTab";
import { OverviewTab } from "@/components/features/sa-society/OverviewTab";
import { PetitionsTab } from "@/components/features/sa-society/PetitionsTab";
import { ReportsTab } from "@/components/features/sa-society/ReportsTab";
import { ResidentsTab } from "@/components/features/sa-society/ResidentsTab";
import { SettingsTab } from "@/components/features/sa-society/SettingsTab";
import { SocietyTabs, TAB_ITEMS } from "@/components/features/sa-society/SocietyTabs";

describe("SocietyTabs", () => {
  it("renders all 11 tab triggers", () => {
    render(
      <SocietyTabs>
        <div>content</div>
      </SocietyTabs>,
    );
    expect(TAB_ITEMS).toHaveLength(11);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Residents")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(
      <SocietyTabs>
        <div>Tab Content</div>
      </SocietyTabs>,
    );
    expect(screen.getByText("Tab Content")).toBeInTheDocument();
  });
});

describe("OverviewTab", () => {
  const society = {
    name: "Eden Estate",
    status: "ACTIVE",
    societyCode: "EDEN01",
    city: "Gurgaon",
    state: "Haryana",
    type: "APARTMENT_COMPLEX",
    totalResidents: 120,
    totalUnits: 80,
    createdAt: "2025-01-01T00:00:00Z",
  };

  it("renders society info", () => {
    render(<OverviewTab society={society} />);
    expect(screen.getByText("Eden Estate")).toBeInTheDocument();
    expect(screen.getByText("EDEN01")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText(/Gurgaon/)).toBeInTheDocument();
  });

  it("renders quick stats", () => {
    render(<OverviewTab society={society} />);
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
  });

  it("handles missing optional fields", () => {
    render(
      <OverviewTab
        society={{
          name: "Test",
          status: "TRIAL",
          societyCode: "T01",
          createdAt: "2025-01-01T00:00:00Z",
        }}
      />,
    );
    expect(screen.getByText("Test")).toBeInTheDocument();
    // Both totalResidents and totalUnits default to 0
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });
});

describe("ResidentsTab", () => {
  it("shows loading state", () => {
    const { container } = render(<ResidentsTab residents={[]} isLoading={true} />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty message", () => {
    render(<ResidentsTab residents={[]} isLoading={false} />);
    expect(screen.getByText("No residents found")).toBeInTheDocument();
  });

  it("renders residents", () => {
    render(
      <ResidentsTab
        residents={[
          {
            id: "1",
            name: "John",
            email: "john@test.com",
            mobile: "9876543210",
            status: "ACTIVE",
            ownershipType: "OWNER",
          },
        ]}
        isLoading={false}
      />,
    );
    expect(screen.getByText("John")).toBeInTheDocument();
    expect(screen.getByText("OWNER")).toBeInTheDocument();
  });

  it("renders null mobile as dash", () => {
    render(
      <ResidentsTab
        residents={[
          {
            id: "1",
            name: "John",
            email: "j@t.com",
            mobile: null,
            status: "ACTIVE",
            ownershipType: null,
          },
        ]}
        isLoading={false}
      />,
    );
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});

describe("FeesTab", () => {
  it("shows empty message", () => {
    render(<FeesTab fees={[]} isLoading={false} />);
    expect(screen.getByText("No fee records")).toBeInTheDocument();
  });

  it("renders fee items", () => {
    render(
      <FeesTab
        fees={[
          {
            id: "1",
            userName: "John",
            amountDue: 5000,
            amountPaid: 3000,
            status: "PENDING",
            session: "2025-2026",
          },
        ]}
        isLoading={false}
      />,
    );
    expect(screen.getByText("John")).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    const { container } = render(<FeesTab fees={[]} isLoading={true} />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThanOrEqual(1);
  });
});

describe("ExpensesTab", () => {
  it("shows empty message", () => {
    render(<ExpensesTab expenses={[]} isLoading={false} />);
    expect(screen.getByText("No expenses found")).toBeInTheDocument();
  });

  it("renders expenses", () => {
    render(
      <ExpensesTab
        expenses={[
          {
            id: "1",
            title: "Security",
            amount: 10000,
            category: "SECURITY",
            status: "ACTIVE",
            date: "2026-01-15",
          },
        ]}
        isLoading={false}
      />,
    );
    expect(screen.getByText("Security")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    const { container } = render(<ExpensesTab expenses={[]} isLoading={true} />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThanOrEqual(1);
  });
});

describe("EventsTab", () => {
  it("shows empty message", () => {
    render(<EventsTab events={[]} isLoading={false} />);
    expect(screen.getByText("No events found")).toBeInTheDocument();
  });

  it("renders events", () => {
    render(
      <EventsTab
        events={[
          {
            id: "1",
            title: "Holi",
            category: "FESTIVAL",
            status: "PUBLISHED",
            eventDate: "2026-03-14",
            registrationCount: 25,
          },
        ]}
        isLoading={false}
      />,
    );
    expect(screen.getByText("Holi")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    const { container } = render(<EventsTab events={[]} isLoading={true} />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThanOrEqual(1);
  });
});

describe("PetitionsTab", () => {
  it("shows empty message", () => {
    render(<PetitionsTab petitions={[]} isLoading={false} />);
    expect(screen.getByText("No petitions found")).toBeInTheDocument();
  });

  it("renders petitions", () => {
    render(
      <PetitionsTab
        petitions={[
          {
            id: "1",
            title: "Speed breaker",
            type: "COMPLAINT",
            status: "PUBLISHED",
            createdAt: "2026-01-01",
            signatureCount: 15,
          },
        ]}
        isLoading={false}
      />,
    );
    expect(screen.getByText("Speed breaker")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    const { container } = render(<PetitionsTab petitions={[]} isLoading={true} />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThanOrEqual(1);
  });
});

describe("ReportsTab", () => {
  it("renders all 4 report types", () => {
    render(<ReportsTab societyId="soc-1" />);
    expect(screen.getByText("Fee Collection Report")).toBeInTheDocument();
    expect(screen.getByText("Expense Summary")).toBeInTheDocument();
    expect(screen.getByText("Resident Directory")).toBeInTheDocument();
    expect(screen.getByText("Financial Statement")).toBeInTheDocument();
  });

  it("calls onGenerate with report type", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const onGenerate = vi.fn();
    render(<ReportsTab societyId="soc-1" onGenerate={onGenerate} />);
    await user.click(screen.getAllByText("Generate")[0]);
    expect(onGenerate).toHaveBeenCalledWith("fee-collection");
  });
});

describe("BroadcastsTab", () => {
  it("shows empty message", () => {
    render(<BroadcastsTab broadcasts={[]} isLoading={false} />);
    expect(screen.getByText("No broadcasts sent")).toBeInTheDocument();
  });

  it("renders broadcasts", () => {
    render(
      <BroadcastsTab
        broadcasts={[
          {
            id: "1",
            subject: "Notice",
            channel: "WhatsApp",
            sentAt: "2026-01-15",
            recipientCount: 50,
          },
        ]}
        isLoading={false}
      />,
    );
    expect(screen.getByText("Notice")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    const { container } = render(<BroadcastsTab broadcasts={[]} isLoading={true} />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThanOrEqual(1);
  });
});

describe("GoverningBodyTab", () => {
  it("shows empty message", () => {
    render(<GoverningBodyTab members={[]} isLoading={false} />);
    expect(screen.getByText("No governing body members")).toBeInTheDocument();
  });

  it("renders members", () => {
    render(
      <GoverningBodyTab
        members={[
          {
            id: "1",
            userName: "John",
            designation: "President",
            startDate: "2025-01-01",
            endDate: null,
            isActive: true,
          },
        ]}
        isLoading={false}
      />,
    );
    expect(screen.getByText("John")).toBeInTheDocument();
    expect(screen.getByText("President")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders inactive member", () => {
    render(
      <GoverningBodyTab
        members={[
          {
            id: "1",
            userName: "Old",
            designation: "VP",
            startDate: "2024-01-01",
            endDate: "2025-01-01",
            isActive: false,
          },
        ]}
        isLoading={false}
      />,
    );
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    const { container } = render(<GoverningBodyTab members={[]} isLoading={true} />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThanOrEqual(1);
  });
});

describe("MigrationsTab", () => {
  it("shows empty message", () => {
    render(<MigrationsTab migrations={[]} isLoading={false} />);
    expect(screen.getByText("No migration batches")).toBeInTheDocument();
  });

  it("renders migrations", () => {
    render(
      <MigrationsTab
        migrations={[
          {
            id: "1",
            fileName: "residents.csv",
            status: "COMPLETED",
            totalRows: 100,
            successCount: 98,
            errorCount: 2,
            createdAt: "2026-01-01",
          },
        ]}
        isLoading={false}
      />,
    );
    expect(screen.getByText("residents.csv")).toBeInTheDocument();
    expect(screen.getByText("COMPLETED")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    const { container } = render(<MigrationsTab migrations={[]} isLoading={true} />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThanOrEqual(1);
  });
});

describe("SettingsTab", () => {
  it("shows loading skeleton", () => {
    const { container } = render(<SettingsTab settings={undefined} isLoading={true} />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThanOrEqual(1);
  });

  it("shows message when settings undefined", () => {
    render(<SettingsTab settings={undefined} isLoading={false} />);
    expect(screen.getByText("Settings not available")).toBeInTheDocument();
  });

  it("renders settings values", () => {
    render(
      <SettingsTab
        settings={{
          emailVerificationRequired: true,
          joiningFee: 5000,
          annualFee: 12000,
          gracePeriodDays: 30,
          feeSessionStartMonth: 4,
        }}
        isLoading={false}
      />,
    );
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("30 days")).toBeInTheDocument();
    expect(screen.getByText("Apr")).toBeInTheDocument();
  });

  it("renders defaults for missing values", () => {
    render(<SettingsTab settings={{}} isLoading={false} />);
    expect(screen.getByText("No")).toBeInTheDocument();
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});
