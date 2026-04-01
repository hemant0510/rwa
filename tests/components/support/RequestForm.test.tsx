import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { RequestForm } from "@/components/features/support/RequestForm";

describe("RequestForm", () => {
  it("renders the form with all fields", () => {
    render(<RequestForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("Create Support Request")).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByText("Submit Request")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onSubmit with form data", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RequestForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText("Subject"), "Login broken");
    await user.type(
      screen.getByLabelText("Description"),
      "Cannot log in since morning today consistently",
    );
    await user.click(screen.getByText("Submit Request"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Login broken",
        description: "Cannot log in since morning today consistently",
        type: "TECHNICAL_SUPPORT",
        priority: "MEDIUM",
      }),
    );
  });

  it("calls onCancel when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<RequestForm onSubmit={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows loading spinner when isPending", () => {
    const { container } = render(<RequestForm onSubmit={vi.fn()} onCancel={vi.fn()} isPending />);
    const spinner = container.querySelector("[class*='animate-spin']");
    expect(spinner).toBeInTheDocument();
    expect(screen.getByText("Submit Request")).toBeDisabled();
  });

  it("shows error message when error is provided", () => {
    render(<RequestForm onSubmit={vi.fn()} onCancel={vi.fn()} error="Validation failed" />);
    expect(screen.getByText("Validation failed")).toBeInTheDocument();
  });

  it("does not show error when error is null", () => {
    render(<RequestForm onSubmit={vi.fn()} onCancel={vi.fn()} error={null} />);
    expect(screen.queryByText("Validation failed")).not.toBeInTheDocument();
  });

  it("does not show spinner when isPending is false", () => {
    const { container } = render(
      <RequestForm onSubmit={vi.fn()} onCancel={vi.fn()} isPending={false} />,
    );
    const spinner = container.querySelector("[class*='animate-spin']");
    expect(spinner).not.toBeInTheDocument();
  });

  it("renders default type selection", () => {
    render(<RequestForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getAllByText("Technical Support").length).toBeGreaterThanOrEqual(1);
  });

  it("renders default priority selection", () => {
    render(<RequestForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getAllByText("Medium").length).toBeGreaterThanOrEqual(1);
  });
});
