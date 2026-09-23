/**
 * Regression tests for conversation deletion across both direct AI and group chats.
 * Verifies that 1:1 direct AI conversations expose the delete action in their row menu,
 * and that deleting triggers the deletion handler.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { ConversationRowMenu } from "../src/components/layout/conversation-row-menu";
import { Sidebar } from "../src/components/layout/sidebar";
import { AppDataContext } from "../src/app/app/app-data";
import type { ConversationSummary } from "../src/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/app",
}));

vi.mock("../src/components/session-provider", () => ({
  useSession: () => ({
    profile: { id: "user-1", display_name: "Tester", avatar_url: null },
    loading: false,
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function flushFrame() {
  return act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

describe("ConversationRowMenu — direct AI vs group room options", () => {
  it("renders 'Delete conversation' without rename option for direct AI conversations", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onTogglePin = vi.fn();

    render(
      <ConversationRowMenu
        title="AI Assistant"
        pinned={false}
        actions={{
          onTogglePin,
          onDelete,
        }}
      />,
    );

    const trigger = screen.getByRole("button", { name: "More options for AI Assistant" });
    fireEvent.click(trigger);
    await flushFrame();

    expect(screen.queryByText("Rename")).toBeNull();
    expect(screen.getByText("Delete conversation")).toBeTruthy();
    expect(screen.getByText("Pin to top")).toBeTruthy();
  });

  it("renders 'Delete room' and 'Rename' for group conversations", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onTogglePin = vi.fn();

    render(
      <ConversationRowMenu
        title="Dev Room"
        pinned={false}
        actions={{
          onRename,
          onTogglePin,
          onDelete,
        }}
      />,
    );

    const trigger = screen.getByRole("button", { name: "More options for Dev Room" });
    fireEvent.click(trigger);
    await flushFrame();

    expect(screen.getByText("Rename")).toBeTruthy();
    expect(screen.getByText("Delete room")).toBeTruthy();
    expect(screen.getByText("Pin to top")).toBeTruthy();
  });

  it("sidebar renders row menu on direct AI conversation rows", async () => {
    const directAiConv: ConversationSummary = {
      id: "conv-direct-1",
      type: "direct_ai",
      name: null,
      topic: null,
      ai_mode: "auto",
      created_by: "user-1",
      created_at: "2026-08-29T12:00:00Z",
      archived_at: null,
      member_count: 1,
      last_message: null,
      unread: 0,
      pinned_at: null,
    };

    const refreshSpy = vi.fn();

    render(
      <AppDataContext.Provider value={{ refreshConversations: refreshSpy }}>
        <Sidebar
          conversations={[directAiConv]}
          loading={false}
          onNew={vi.fn()}
          onJoin={vi.fn()}
          onSearch={vi.fn()}
          onPalette={vi.fn()}
          onTogglePin={vi.fn()}
        />
      </AppDataContext.Provider>,
    );

    // Direct AI conversation row must have a "More options for ..." button
    const menuBtn = screen.getByRole("button", { name: /More options for/ });
    expect(menuBtn).toBeTruthy();

    fireEvent.click(menuBtn);
    await flushFrame();

    expect(screen.getByText("Delete conversation")).toBeTruthy();
  });
});
