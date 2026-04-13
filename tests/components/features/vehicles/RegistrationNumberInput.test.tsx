import { useState } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RegistrationNumberInput } from "@/components/features/vehicles/RegistrationNumberInput";

function ControlledHarness({
  initial = "",
  onChange,
  onBlurValue,
}: {
  initial?: string;
  onChange?: (v: string) => void;
  onBlurValue?: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <RegistrationNumberInput
      aria-label="reg"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
      onBlurValue={onBlurValue}
    />
  );
}

describe("RegistrationNumberInput", () => {
  it("uppercases letters as user types", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledHarness onChange={onChange} />);
    const input = screen.getByLabelText("reg") as HTMLInputElement;
    await user.type(input, "dl3cab1234");
    expect(input.value).toBe("DL3CAB1234");
    expect(onChange).toHaveBeenLastCalledWith("DL3CAB1234");
  });

  it("normalises away spaces and hyphens on blur", async () => {
    const onBlurValue = vi.fn();
    render(<ControlledHarness initial="DL 3C-AB 1234" onBlurValue={onBlurValue} />);
    const input = screen.getByLabelText("reg") as HTMLInputElement;
    fireEvent.blur(input);
    expect(input.value).toBe("DL3CAB1234");
    expect(onBlurValue).toHaveBeenCalledWith("DL3CAB1234");
  });

  it("does not re-emit onChange on blur when already normalised", () => {
    const onChange = vi.fn();
    const onBlurValue = vi.fn();
    render(
      <RegistrationNumberInput
        aria-label="reg"
        value="DL3CAB1234"
        onChange={onChange}
        onBlurValue={onBlurValue}
      />,
    );
    fireEvent.blur(screen.getByLabelText("reg"));
    expect(onChange).not.toHaveBeenCalled();
    expect(onBlurValue).toHaveBeenCalledWith("DL3CAB1234");
  });

  it("invokes a passed onBlur prop in addition to onBlurValue", () => {
    const onBlur = vi.fn();
    render(
      <RegistrationNumberInput
        aria-label="reg"
        value="DL3CAB1234"
        onChange={vi.fn()}
        onBlur={onBlur}
      />,
    );
    fireEvent.blur(screen.getByLabelText("reg"));
    expect(onBlur).toHaveBeenCalled();
  });

  it("uses default placeholder when none provided", () => {
    render(<RegistrationNumberInput aria-label="reg" value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText("reg")).toHaveAttribute("placeholder", "DL 3C AB 1234");
  });

  it("respects an explicit placeholder", () => {
    render(
      <RegistrationNumberInput aria-label="reg" value="" onChange={vi.fn()} placeholder="Custom" />,
    );
    expect(screen.getByLabelText("reg")).toHaveAttribute("placeholder", "Custom");
  });

  it("handles paste (uppercases pasted content)", async () => {
    const user = userEvent.setup();
    render(<ControlledHarness />);
    const input = screen.getByLabelText("reg") as HTMLInputElement;
    await user.click(input);
    await user.paste("dl 3c ab 1234");
    expect(input.value).toBe("DL 3C AB 1234");
    fireEvent.blur(input);
    expect(input.value).toBe("DL3CAB1234");
  });
});
