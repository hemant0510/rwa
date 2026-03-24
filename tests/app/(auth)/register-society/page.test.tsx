import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockPush, mockRefresh, mockSignIn, mockToast, mockFetch, mockCheckSocietyCode } =
  vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockRefresh: vi.fn(),
    mockSignIn: vi.fn(),
    mockToast: { success: vi.fn(), error: vi.fn() },
    mockFetch: vi.fn(),
    mockCheckSocietyCode: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("sonner", () => ({ toast: mockToast }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword: mockSignIn } }),
}));

vi.mock("@/services/societies", () => ({
  checkSocietyCode: mockCheckSocietyCode,
}));

// Mock Radix UI Select as native <select> so userEvent.selectOptions works in jsdom
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: React.ReactNode;
  }) => (
    <select value={value ?? ""} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children?: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? ""}</span>,
}));

global.fetch = mockFetch as typeof fetch;

// ─── Import component AFTER mocks ─────────────────────────────────────────────

import RegisterSocietyPage from "@/app/(auth)/register-society/page";

// ─── Test data ────────────────────────────────────────────────────────────────

const MOCK_PLANS = [
  {
    id: "plan-1",
    name: "Basic",
    slug: "basic",
    description: "For small societies",
    planType: "FLAT_FEE",
    residentLimit: 150,
    pricePerUnit: null,
    featuresJson: { fee_collection: true, resident_management: true },
    badgeText: null,
    billingOptions: [{ id: "opt-1", billingCycle: "MONTHLY", price: 499 }],
  },
  {
    id: "plan-2",
    name: "Pro",
    slug: "pro",
    description: "For large societies",
    planType: "FLAT_FEE",
    residentLimit: 2000,
    pricePerUnit: null,
    featuresJson: { fee_collection: true, whatsapp: true },
    badgeText: "Most Popular",
    billingOptions: [{ id: "opt-2", billingCycle: "MONTHLY", price: 1999 }],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

function renderPage() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <RegisterSocietyPage />
    </QueryClientProvider>,
  );
}

/** Fill all required fields in step 0 (Society Info) */
async function fillStep0(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/society name/i), "Eden Estate RWA");
  await user.type(screen.getByLabelText(/society code/i), "EDEN");
  await user.type(screen.getByLabelText(/city/i), "Gurugram");
  await user.type(screen.getByLabelText(/pincode/i), "122001");
  // The mocked Select renders as a native <select>. Two selects on step 0:
  // [0] = Society Type (defaults to INDEPENDENT_SECTOR, already valid), [1] = State
  const selects = screen.getAllByRole("combobox");
  await user.selectOptions(selects[1], "HR"); // pick Haryana for state
  // Accept terms
  await user.click(screen.getByRole("checkbox"));
}

/** Navigate to step 2 (Choose Plan) */
async function goToStep2(user: ReturnType<typeof userEvent.setup>) {
  await fillStep0(user);
  await waitFor(() => expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled());
  await user.click(screen.getByRole("button", { name: /next/i }));
  await waitFor(() => expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument());
}

/** Navigate to step 3 (Admin Account) */
async function goToStep3(user: ReturnType<typeof userEvent.setup>) {
  await goToStep2(user);
  await user.click(screen.getByRole("button", { name: /next/i }));
  await waitFor(() => expect(screen.getByText(/step 3 of 3/i)).toBeInTheDocument());
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RegisterSocietyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(MOCK_PLANS) });
    mockCheckSocietyCode.mockResolvedValue({ available: true });
  });

  // ── Step 0: Rendering ──────────────────────────────────────────────────────

  it("renders the page heading", () => {
    renderPage();
    expect(screen.getByText("Register Your Society")).toBeInTheDocument();
  });

  it("starts at step 1 (Society Info)", () => {
    renderPage();
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/society name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/society code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pincode/i)).toBeInTheDocument();
  });

  it("renders step indicator with 3 steps", () => {
    renderPage();
    expect(screen.getByText("Society Info")).toBeInTheDocument();
    expect(screen.getByText("Choose Plan")).toBeInTheDocument();
    expect(screen.getByText("Admin Account")).toBeInTheDocument();
  });

  it("renders branding panel content", () => {
    renderPage();
    expect(screen.getByText(/manage your society smarter/i)).toBeInTheDocument();
    // "14-day free trial" appears in both branding badge and mobile header — use getAllByText
    expect(screen.getAllByText(/14-day free trial/i).length).toBeGreaterThan(0);
  });

  it("renders optional govt registration fields", () => {
    renderPage();
    expect(screen.getByLabelText(/official reg\. number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of registration/i)).toBeInTheDocument();
  });

  it("renders T&C checkbox and links", () => {
    renderPage();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /terms of service/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /privacy policy/i })).toBeInTheDocument();
  });

  it('renders "Sign in" link at bottom', () => {
    renderPage();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });

  it("Back button is disabled on step 1", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
  });

  // ── Society code availability ──────────────────────────────────────────────

  it("shows minimum-chars warning when code is 1-3 characters", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/society code/i), "ED");
    expect(screen.getByText(/minimum 4 characters required/i)).toBeInTheDocument();
  });

  it("hides minimum-chars warning when code reaches 4 characters", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/society code/i), "EDEN");
    expect(screen.queryByText(/minimum 4 characters required/i)).not.toBeInTheDocument();
  });

  it("shows code-available message when code check returns available", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/society code/i), "EDEN");
    await waitFor(() => expect(screen.getByText(/✓ code is available/i)).toBeInTheDocument());
  });

  it("shows code-taken message when code check returns unavailable", async () => {
    mockCheckSocietyCode.mockResolvedValue({ available: false });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/society code/i), "EDEN");
    await waitFor(() => expect(screen.getByText(/✗ code already taken/i)).toBeInTheDocument());
  });

  // ── Step 0 — Next button gating ───────────────────────────────────────────

  it("Next button is disabled when form is empty", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("Next button is disabled when consent checkbox is not ticked", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/society name/i), "Eden Estate RWA");
    await user.type(screen.getByLabelText(/society code/i), "EDEN");
    await user.type(screen.getByLabelText(/city/i), "Gurugram");
    await user.type(screen.getByLabelText(/pincode/i), "122001");
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[1], "HR");
    // Do NOT tick consent
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("Next button becomes enabled after filling all required fields + consent", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillStep0(user);
    await waitFor(() => expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled());
  });

  // ── Step 0 consent checkbox ────────────────────────────────────────────────

  it("T&C checkbox toggles consent state", async () => {
    const user = userEvent.setup();
    renderPage();
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  it("advances to step 2 (Choose Plan) on Next click", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);
    expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/choose a plan now/i)).toBeInTheDocument();
  });

  it("Back button on step 2 returns to step 1", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
  });

  it("Next on step 2 advances to step 3 (Admin Account)", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep3(user);
    expect(screen.getByText(/step 3 of 3/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
  });

  it("Back button on step 3 returns to step 2", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep3(user);
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
  });

  // ── Step 2: Choose Plan ────────────────────────────────────────────────────

  it("displays plan cards when plans are loaded", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);
    await waitFor(() => {
      expect(screen.getByText("Basic")).toBeInTheDocument();
      expect(screen.getByText("Pro")).toBeInTheDocument();
    });
  });

  it("shows 'No plans available' when API returns empty array", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);
    await waitFor(() => expect(screen.getByText(/no plans available/i)).toBeInTheDocument());
  });

  it("shows 'No plans available' when plans fetch fails", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);
    await waitFor(() => expect(screen.getByText(/no plans available/i)).toBeInTheDocument());
  });

  it("can select a plan — plan summary shows in step 3", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);
    await waitFor(() => screen.getByText("Basic"));
    await user.click(screen.getByText("Basic").closest("button")!);
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByText(/step 3 of 3/i));
    expect(screen.getByText(/plan selected:/i)).toBeInTheDocument();
  });

  it("deselects a plan when clicking the same card twice", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);
    await waitFor(() => screen.getByText("Basic"));
    const basicBtn = screen.getByText("Basic").closest("button")!;
    await user.click(basicBtn);
    await user.click(basicBtn); // deselect
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByText(/step 3 of 3/i));
    expect(screen.queryByText(/plan selected:/i)).not.toBeInTheDocument();
  });

  it('"Skip for now" clears selected plan and jumps to step 3', async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);
    await waitFor(() => screen.getByText("Basic"));
    await user.click(screen.getByText("Basic").closest("button")!); // select
    await user.click(screen.getByRole("button", { name: /skip for now/i }));
    await waitFor(() => screen.getByText(/step 3 of 3/i));
    expect(screen.queryByText(/plan selected:/i)).not.toBeInTheDocument();
  });

  it("shows plan badge text when present", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);
    await waitFor(() => expect(screen.getByText("Most Popular")).toBeInTheDocument());
  });

  it("shows resident limit for plans that have one", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);
    await waitFor(() => expect(screen.getByText(/up to 150 residents/i)).toBeInTheDocument());
  });

  it("shows 'Unlimited residents' when residentLimit is null", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { ...MOCK_PLANS[0], id: "p-x", name: "Unlimited Plan", residentLimit: null },
        ]),
    });
    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);
    await waitFor(() => expect(screen.getByText(/unlimited residents/i)).toBeInTheDocument());
  });

  it("shows price per unit when plan has pricePerUnit and no monthly billing option", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            ...MOCK_PLANS[0],
            id: "p-flex",
            name: "Flex",
            billingOptions: [],
            pricePerUnit: 3,
          },
        ]),
    });
    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);
    await waitFor(() => expect(screen.getByText(/\/unit\/mo/i)).toBeInTheDocument());
  });

  it("shows feature labels on plan cards", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);
    // "Resident Management" appears only on plan-1; safer than "Fee Collection" which is on both
    await waitFor(() => expect(screen.getByText("Resident Management")).toBeInTheDocument());
  });

  it("shows +N more when plan has more than 4 features", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            ...MOCK_PLANS[0],
            id: "p-big",
            name: "Enterprise",
            featuresJson: {
              fee_collection: true,
              resident_management: true,
              expense_tracking: true,
              basic_reports: true,
              advanced_reports: true,
              multi_admin: true,
            },
          },
        ]),
    });
    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);
    await waitFor(() => expect(screen.getByText(/\+2 more/i)).toBeInTheDocument());
  });

  // ── Step 3: Admin Account ──────────────────────────────────────────────────

  it("renders all admin account fields on step 3", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep3(user);
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mobile.*optional/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it("shows Register Society submit button on step 3", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep3(user);
    expect(screen.getByRole("button", { name: /register society/i })).toBeInTheDocument();
  });

  it("shows selected plan summary when a plan was chosen", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);
    await waitFor(() => screen.getByText("Basic"));
    await user.click(screen.getByText("Basic").closest("button")!);
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByText(/step 3 of 3/i));
    expect(screen.getByText(/plan selected:/i)).toBeInTheDocument();
  });

  it('"Change" clears the selected plan on step 3', async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep2(user);
    await waitFor(() => screen.getByText("Basic"));
    await user.click(screen.getByText("Basic").closest("button")!);
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByRole("button", { name: /change/i }));
    await user.click(screen.getByRole("button", { name: /change/i }));
    expect(screen.queryByText(/plan selected:/i)).not.toBeInTheDocument();
  });

  it("submit button is disabled when admin fields are empty", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep3(user);
    expect(screen.getByRole("button", { name: /register society/i })).toBeDisabled();
  });

  it("submit button is enabled when all admin fields are valid", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep3(user);
    await user.type(screen.getByLabelText(/full name/i), "Hemant Bhagat");
    await user.type(screen.getByLabelText(/^email/i), "hemant@example.com");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /register society/i })).not.toBeDisabled(),
    );
  });

  // ── Form submission ────────────────────────────────────────────────────────

  async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
    await goToStep3(user);
    await user.type(screen.getByLabelText(/full name/i), "Hemant Bhagat");
    await user.type(screen.getByLabelText(/^email/i), "hemant@example.com");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /register society/i })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole("button", { name: /register society/i }));
  }

  it("on success without verification: signs in and redirects to /admin/dashboard", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    // Plans fetch fires on mount — set Once mocks BEFORE renderPage so ordering is correct:
    // 1st Once → plans (mount-time fetch)
    // 2nd Once → registration POST (submit-time fetch)
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(MOCK_PLANS) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ requiresVerification: false, society: { id: "s1" } }),
      });
    const user = userEvent.setup();
    renderPage();

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "hemant@example.com",
        password: "password123",
      }),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/admin/dashboard"));
  });

  it("on success with verification required: redirects to /check-email", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(MOCK_PLANS) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ requiresVerification: true }),
      });
    const user = userEvent.setup();
    renderPage();

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/check-email")),
    );
    expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining("verify your email"));
  });

  it("shows error toast when registration API returns an error", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(MOCK_PLANS) })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: { message: "Society code already exists" } }),
      });
    const user = userEvent.setup();
    renderPage();

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Society code already exists"),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects to /login when sign-in fails after successful registration", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "Invalid credentials" } });
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(MOCK_PLANS) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ requiresVerification: false, society: { id: "s1" } }),
      });
    const user = userEvent.setup();
    renderPage();

    await fillAndSubmit(user);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining("sign-in failed"));
  });

  it("shows generic error toast when fetch throws a network error", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(MOCK_PLANS) })
      .mockRejectedValueOnce(new Error("Network error"));
    const user = userEvent.setup();
    renderPage();

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining("Registration failed")),
    );
  });

  // ── Validation error handler ───────────────────────────────────────────────

  it("shows error toast when form is submitted with validation errors on step 3", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToStep3(user);

    // Type admin name and email but use mismatched passwords
    await user.type(screen.getByLabelText(/full name/i), "H");
    await user.type(screen.getByLabelText(/^email/i), "hemant@example.com");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "different123");

    // The submit button is disabled (canProceed checks password match)
    // So dispatch form submit event directly to trigger the error handler
    const form = screen.getByRole("button", { name: /register society/i }).closest("form")!;
    form.dispatchEvent(new Event("submit", { bubbles: true }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
  });
});
