/**
 * Component tests for the verified citation display
 * (`src/components/chat/citation-list.tsx`).
 *
 * The renderer must show ONLY validated citation metadata: filename,
 * page number when available, bounded list, and it must refuse malformed
 * payloads instead of rendering guessed sources.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CitationList } from "../src/components/chat/citation-list";

afterEach(() => {
  cleanup();
});

const VALID = {
  attachment_id: "att-1",
  filename: "quarterly-report.pdf",
  label: "page 7",
  page: 7,
  chunk_index: 6,
  mime_type: "application/pdf",
};

describe("CitationList", () => {
  it("renders nothing when citations are absent", () => {
    const { container } = render(<CitationList citations={undefined} />);
    expect(container.querySelector('[data-testid="citation-list"]')).toBeNull();
  });

  it("renders nothing for malformed payloads", () => {
    const { container } = render(<CitationList citations={"garbage"} />);
    expect(container.querySelector('[data-testid="citation-list"]')).toBeNull();
  });

  it("drops malformed entries instead of rendering them", () => {
    render(
      <CitationList
        citations={[null, { attachment_id: "" }, { ...VALID }]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(screen.getByText("quarterly-report.pdf")).toBeTruthy();
  });

  it("shows the filename and page number for a PDF citation", () => {
    render(<CitationList citations={[VALID]} />);
    expect(screen.getByText("quarterly-report.pdf")).toBeTruthy();
    expect(screen.getByText("p. 7")).toBeTruthy();
  });

  it("omits the page marker for non-paginated sources", () => {
    render(
      <CitationList
        citations={[{ ...VALID, filename: "notes.txt", page: null, mime_type: "text/plain" }]}
      />,
    );
    expect(screen.getByText("notes.txt")).toBeTruthy();
    expect(screen.queryByText(/p\. \d+/)).toBeNull();
  });

  it("renders multiple citations", () => {
    render(
      <CitationList
        citations={[
          VALID,
          { ...VALID, attachment_id: "att-2", filename: "budget.pdf", label: "page 2", page: 2 },
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("caps the rendered list", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      ...VALID,
      attachment_id: `att-${i}`,
      label: `page ${i + 1}`,
    }));
    render(<CitationList citations={many} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
  });

  it("exposes an accessible label for the group", () => {
    render(<CitationList citations={[VALID]} />);
    expect(screen.getByLabelText("Sources")).toBeTruthy();
  });

  it("truncates very long filenames from the middle", () => {
    render(
      <CitationList
        citations={[
          { ...VALID, filename: "a-very-long-document-name-that-should-be-truncated-safely.pdf" },
        ]}
      />,
    );
    const shown = screen.getByText(/…/).textContent ?? "";
    expect(shown.length).toBeLessThanOrEqual(35);
    expect(shown.startsWith("a-very-long")).toBe(true);
    expect(shown.endsWith(".pdf")).toBe(true);
  });
});
