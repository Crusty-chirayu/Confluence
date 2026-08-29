"use client";

import * as React from "react";
import { Download, FileText } from "lucide-react";
import { attachmentUrl } from "@/lib/data/api";
import { attachmentLabel, isImageMime } from "@/lib/attachments";
import type { MessageAttachment } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Renders a single message attachment. Resolves the member-scoped signed URL
 * (or the demo object URL) lazily, shows an image thumbnail for images, and a
 * file chip with the name + size for everything else. Opens the attachment in
 * a new tab (target="_blank" + rel="noopener").
 */
export function AttachmentChip({ attachment }: { attachment: MessageAttachment }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    void attachmentUrl(attachment.storage_path).then((u) => {
      if (!alive) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [attachment.storage_path]);

  const isImage = isImageMime(attachment.mime_type);

  if (failed) {
    return (
      <span className="inline-flex max-w-full items-center gap-2 rounded-[--r-md] border border-[--border] bg-[--surface] px-2.5 py-1.5 text-[12px] text-[--fg-muted]">
        <FileText className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{attachmentLabel(attachment.storage_path.split("/").pop() ?? "file", attachment.size_bytes)}</span>
        <span className="text-[11px] text-[--fg-subtle]">unavailable</span>
      </span>
    );
  }

  if (isImage && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-[--r-md] border border-[--border] bg-[--surface]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={attachment.storage_path.split("/").pop() ?? "attachment"}
          loading="lazy"
          className="max-h-48 max-w-[16rem] object-cover"
        />
        <span className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-[--fg-muted]">
          <Download className="h-3 w-3" />
          {attachmentLabel(attachment.storage_path.split("/").pop() ?? "file", attachment.size_bytes)}
        </span>
      </a>
    );
  }

  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      onClick={url ? undefined : (e) => e.preventDefault()}
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-[--r-md] border border-[--border] bg-[--surface] px-2.5 py-1.5 text-[12px] transition-colors duration-[--d-micro] hover:border-[--border-strong]",
      )}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-[--fg-muted]" />
      <span className="truncate">{attachment.storage_path.split("/").pop()}</span>
      <span className="shrink-0 text-[11px] text-[--fg-subtle]">{attachmentLabel("", attachment.size_bytes)}</span>
      <Download className="h-3 w-3 shrink-0 text-[--fg-subtle]" />
    </a>
  );
}
