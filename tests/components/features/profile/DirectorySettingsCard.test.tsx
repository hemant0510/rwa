import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DirectorySettingsCard } from "@/components/features/profile/DirectorySettingsCard";

describe("DirectorySettingsCard", () => {
  it("renders both toggles with initial state (both-off)", () => {
    render(
      <DirectorySettingsCard
        showInDirectory={false}
        showPhoneInDirectory={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/show me in the directory/i)).not.toBeChecked();
    expect(screen.getByLabelText(/show my phone number/i)).not.toBeChecked();
    expect(screen.getByLabelText(/show my phone number/i)).toBeDisabled();
  });

  it("directory-only-on enables phone toggle", () => {
    render(
      <DirectorySettingsCard showInDirectory showPhoneInDirectory={false} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText(/show me in the directory/i)).toBeChecked();
    expect(screen.getByLabelText(/show my phone number/i)).not.toBeChecked();
    expect(screen.getByLabelText(/show my phone number/i)).not.toBeDisabled();
  });

  it("both-on state renders checked and not disabled", () => {
    render(<DirectorySettingsCard showInDirectory showPhoneInDirectory onChange={vi.fn()} />);
    expect(screen.getByLabelText(/show me in the directory/i)).toBeChecked();
    expect(screen.getByLabelText(/show my phone number/i)).toBeChecked();
  });

  it("cascade: toggling directory OFF forces phone OFF and disables it", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DirectorySettingsCard showInDirectory showPhoneInDirectory onChange={onChange} />);
    await user.click(screen.getByLabelText(/show me in the directory/i));
    expect(onChange).toHaveBeenCalledWith({
      showInDirectory: false,
      showPhoneInDirectory: false,
    });
    expect(screen.getByLabelText(/show my phone number/i)).not.toBeChecked();
    expect(screen.getByLabelText(/show my phone number/i)).toBeDisabled();
  });

  it("turning phone ON when directory is ON emits updated state", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DirectorySettingsCard showInDirectory showPhoneInDirectory={false} onChange={onChange} />,
    );
    await user.click(screen.getByLabelText(/show my phone number/i));
    expect(onChange).toHaveBeenCalledWith({
      showInDirectory: true,
      showPhoneInDirectory: true,
    });
  });

  it("disables both toggles when pending", () => {
    render(
      <DirectorySettingsCard showInDirectory showPhoneInDirectory onChange={vi.fn()} pending />,
    );
    expect(screen.getByLabelText(/show me in the directory/i)).toBeDisabled();
    expect(screen.getByLabelText(/show my phone number/i)).toBeDisabled();
  });

  it("turning directory back ON retains phone=OFF (cascade doesn't restore prior ON)", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DirectorySettingsCard
        showInDirectory={false}
        showPhoneInDirectory={false}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByLabelText(/show me in the directory/i));
    expect(onChange).toHaveBeenLastCalledWith({
      showInDirectory: true,
      showPhoneInDirectory: false,
    });
  });
});
