/**
 * Dialog focus lifecycle — the regression suite for the "one character then the
 * field loses focus" bug, plus the nested-dialog rules that share its machinery.
 *
 * The bug (fixed in src/components/ui/modal.tsx):
 *
 *   Every caller passes `onClose` as an inline arrow, so its identity changes on
 *   each parent render. The focus effect was keyed on `[open, onClose]`, which
 *   meant a keystroke in a controlled field re-ran it: the teardown handed focus
 *   back to the trigger and the re-mount re-focused the panel. Focus was pulled
 *   out of the field after exactly one character, and the body scroll-lock was
 *   rebuilt on every keystroke.
 *
 * These tests fail against the old effect and pass against the current one.
 *
 *   npx vitest run tests/dialog-focus-regression.test.tsx
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

import { ConfirmDialog, Modal } from "../src/components/ui/modal";
import { NewConversationModal } from "../src/components/layout/new-conversation-modal";
import { Button } from "../src/components/ui/button";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/app",
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

/** Flush the requestAnimationFrame the dialog uses before it moves focus. */
function flushFrame() {
  return act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

function dialog(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!el) throw new Error("no dialog in the DOM");
  return el;
}

describe("dialog focus lifecycle — the typing regression", () => {
  /**
   * The exact shape the application uses: an inline `onClose`, recreated on
   * every render, with the dialog's own state living inside the modal so that
   * each keystroke re-renders the parent it is passed from.
   */
  function Harness() {
    const [open, setOpen] = React.useState(true);
    return <NewConversationModal open={open} onClose={() => setOpen(false)} />;
  }

  it("keeps focus in Room name for every character of a continuous type", async () => {
    render(<Harness />);
    await flushFrame();

    fireEvent.click(screen.getByRole("button", { name: /Group room/ }));
    const input = screen.getByLabelText("Room name") as HTMLInputElement;
    // Choosing "Group room" reveals the field and focuses it — on the FIRST
    // interaction, with no second click.
    await flushFrame();
    expect(document.activeElement).toBe(input);

    const typed = "Engineering launch room";
    for (const ch of typed) {
      fireEvent.change(input, { target: { value: input.value + ch } });
      await flushFrame();
      expect(document.activeElement, `focus was lost after typing "${ch}"`).toBe(input);
    }
    // …and not a single character was dropped.
    expect(input.value).toBe(typed);
  });

  it("keeps focus in Topic for every character of a continuous type", async () => {
    render(<Harness />);
    await flushFrame();
    fireEvent.click(screen.getByRole("button", { name: /Group room/ }));

    const topic = screen.getByLabelText(/Topic/) as HTMLTextAreaElement;
    topic.focus();
    const typed = "Ship v3 and the migration";
    for (const ch of typed) {
      fireEvent.change(topic, { target: { value: topic.value + ch } });
      await flushFrame();
      expect(document.activeElement, `focus was lost after typing "${ch}"`).toBe(topic);
    }
    expect(topic.value).toBe(typed);
  });

  it("selects an AI participation mode on the first click and keeps it", async () => {
    render(<Harness />);
    await flushFrame();
    fireEvent.click(screen.getByRole("button", { name: /Group room/ }));

    const off = screen.getByRole("radio", { name: /Off/ }) as HTMLInputElement;
    fireEvent.click(off);
    await flushFrame();
    expect(off.checked).toBe(true);

    const auto = screen.getByRole("radio", { name: /Auto/ }) as HTMLInputElement;
    fireEvent.click(auto);
    await flushFrame();
    expect(auto.checked).toBe(true);
    expect(off.checked).toBe(false);
  });

  it("does not re-run its focus work when the parent re-renders mid-typing", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "open";
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <Modal open onClose={() => {}} title="Room settings">
        <input defaultValue="" />
      </Modal>,
    );
    await flushFrame();

    const input = dialog().querySelector("input")!;
    input.focus();
    expect(document.activeElement).toBe(input);

    // A parent re-render with a brand-new onClose identity — exactly what a
    // keystroke in a controlled field looks like from the dialog's seat.
    rerender(
      <Modal open onClose={() => {}} title="Room settings">
        <input defaultValue="" />
      </Modal>,
    );
    await flushFrame();
    expect(document.activeElement).toBe(input);
  });

  it("still returns focus to the trigger after the user typed", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "open";
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <Modal open onClose={() => {}} title="Room settings">
        <input defaultValue="" />
      </Modal>,
    );
    await flushFrame();
    dialog().querySelector("input")!.focus();

    rerender(
      <Modal open onClose={() => {}} title="Room settings">
        <input defaultValue="" />
      </Modal>,
    );
    await flushFrame();
    expect(document.activeElement).not.toBe(trigger);
    rerender(
      <Modal open={false} onClose={() => {}} title="Room settings">
        <input defaultValue="" />
      </Modal>,
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("locks the page behind the dialog and releases it exactly once", async () => {
    const { rerender } = render(<Modal open onClose={() => {}} title="Notice" />);
    await flushFrame();
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<Modal open={false} onClose={() => {}} title="Notice" />);
    await waitFor(() => expect(document.body.style.overflow).toBe(""));
  });
});

describe("dialog focus lifecycle — stacked dialogs", () => {
  it("Escape closes only the topmost dialog", async () => {
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();

    render(
      <>
        <Modal open onClose={onOuterClose} title="Room settings">
          <p>outer</p>
        </Modal>
        <ConfirmDialog open onClose={onInnerClose} onConfirm={() => {}} title="Delete this room?" />
      </>,
    );
    await flushFrame();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onInnerClose).toHaveBeenCalledTimes(1);
    expect(onOuterClose).not.toHaveBeenCalled();
  });

  it("keeps the scroll lock while an outer dialog is still open", async () => {
    const { rerender } = render(
      <>
        <Modal open onClose={() => {}} title="Room settings">
          <p>outer</p>
        </Modal>
        <ConfirmDialog open onClose={() => {}} onConfirm={() => {}} title="Delete?" />
      </>,
    );
    await flushFrame();
    expect(document.body.style.overflow).toBe("hidden");

    // The inner confirm closes; the outer dialog is still up.
    rerender(
      <>
        <Modal open onClose={() => {}} title="Room settings">
          <p>outer</p>
        </Modal>
        <ConfirmDialog open={false} onClose={() => {}} onConfirm={() => {}} title="Delete?" />
      </>,
    );
    await waitFor(() => expect(document.querySelectorAll('[role="dialog"]').length).toBe(1));
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("wraps Tab inside the topmost dialog only", async () => {
    const behind = document.createElement("button");
    behind.textContent = "behind";
    document.body.appendChild(behind);

    render(
      <>
        <Modal open onClose={() => {}} title="Room settings" footer={<Button>Save</Button>}>
          <input defaultValue="outer field" />
        </Modal>
        <ConfirmDialog open onClose={() => {}} onConfirm={() => {}} title="Delete?" />
      </>,
    );
    await flushFrame();

    const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
    const inner = dialogs[dialogs.length - 1];
    const innerButtons = [...inner.querySelectorAll("button")];
    const last = innerButtons[innerButtons.length - 1];
    last.focus();

    fireEvent.keyDown(document, { key: "Tab" });
    // Focus wrapped to the top of the CONFIRM, not into the settings panel.
    expect(inner.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(behind);
  });
});

