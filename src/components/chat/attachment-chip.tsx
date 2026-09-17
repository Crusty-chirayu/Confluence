"use client";

import * as React from "react";
import { AlertTriangle, Download, FileText, Loader2, ShieldCheck } from "lucide-react";
import { attachmentUrl } from "@/lib/data/api";
import { attachmentLabel, isImageMime } from "@/lib/attachments";
import {
  getAttachmentStatus,
  isTerminalStatus,
  type AttachmentStatusInfo,
} from "@/lib/attachment-status";
import type { MessageAttachment } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Statuses derived from file type never need polling — skip the RPC entirely. */
const NON_PROCESSABLE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "video/mp4",
  "video/webm",
]);

/** Max RPC checks per attachment; bounded so the UI never polls forever. */
const MAX_POLLS = 8;
const POLL_INTERVAL_MS = 3000;

/**
 * Renders a single message attachment. Resolves the member-scoped signed URL
 * (or the demo object URL) lazily, shows an image thumbnail for images, and a
 * file chip with the name + size for everything else. Opens the attachment in
 * a new tab (target="_blank" + rel="noopener").
 */
export function AttachmentChip({ attachment }: { attachment: MessageAttachment }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [status, setStatus] = React.useState<AttachmentStatusInfo | null>(null);
  const pollAborted = React.useRef(false);

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

  // Processing status: fetch once, poll only while non-terminal, stop on unmount.
  React.useEffect(() => {
    if (NON_PROCESSABLE_MIME.has(attachment.mime_type)) return;
    pollAborted.current = false;
    let alive = true;
    let attempt = 0;

    const check = async () => {
      if (!alive || pollAborted.current) return;
      const map = await getAttachmentStatus([attachment.id]);
      if (!alive || pollAborted.current) return;
      const next = map.get(attachment.id) ?? null;
      setStatus(next);
      if (next && !isTerminalStatus(next.status) && attempt < MAX_POLLS - 1) {
        attempt += 1;
        window.setTimeout(check, POLL_INTERVAL_MS);
      }
    };
    void check();

    return () => {
      alive = false;
      pollAborted.current = true;
    };
  }, [attachment.id, attachment.mime_type]);

  const isImage = isImageMime(attachment.mime_type);
  const filename = attachment.storage_path.split("/").pop() ?? "file";

  const statusBadge = (info: AttachmentStatusInfo | null) => {
    if (!info || isImage) return null;
    switch (info.status) {
      case "processing":
        return (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[--fg-muted]" role="status">
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
            <span className="sr-only">Processing</span>
          </span>
        );
      case "queued":
        return (
          <span className="shrink-0 text-[11px] text-[--fg-subtle]" role="status">
            queued
          </span>
        );
      case "ready":
        return (
          <span
            className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[--fg-subtle]"
            title={`Ready — ${info.chunk_count} section${info.chunk_count === 1 ? "" : "s"} available to the assistant`}
          >
            <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden />
            <span className="sr-only">Ready for the assistant</span>
          </span>
        );
      case "failed":
        return (
          <span
            className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[--warning]"
            title="The assistant could not read this file."
          >
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
            <span className="sr-only">Processing failed</span>
          </span>
        );
      case "unsupported":
        return (
          <span className="shrink-0 text-[11px] text-[--fg-subtle]" role="status">
            not analyzed
          </span>
        );
    }
  };

  if (failed) {
    return (
      <span className="inline-flex max-w-full items-center gap-2 rounded-[--r-md] border border-[--border]/70 bg-[--surface]/60 px-2.5 py-1.5 text-[12px] text-[--fg-muted] backdrop-blur-sm transition-opacity duration-[--d-micro]">
        <FileText className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {attachmentLabel(filename, attachment.size_bytes)}
        </span>
        <span className="shrink-0 text-[11px] text-[--fg-subtle]">unavailable</span>
      </span>
    );
  }

  if (isImage && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block w-fit overflow-hidden rounded-[--r-md] border border-[--border]/70 bg-[--surface]/60 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset] backdrop-blur-sm transition-colors duration-[--d-micro] hover:border-[--border-strong] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]/50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={filename}
          loading="lazy"
          className="max-h-48 max-w-[16rem] object-cover transition-transform duration-300 group-hover:scale-[1.015]"
        />
        <span className="flex items-center gap-1.5 border-t border-[--border]/60 px-2 py-1 text-[11px] text-[--fg-muted] transition-colors duration-[--d-micro] group-hover:text-[--fg]">
          <Download className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {attachmentLabel(filename, attachment.size_bytes)}
          </span>
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
        "inline-flex max-w-full items-center gap-2 rounded-[--r-md] border border-[--border]/70 bg-[--surface]/60 px-2.5 py-1.5 text-[12px] backdrop-blur-sm transition-all duration-[--d-micro]",
        "hover:border-[--border-strong] hover:bg-[--bg-hover] active:scale-[0.985]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]/50",
        !url && "cursor-default opacity-70",
      )}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-[--fg-muted]" />
      <span className="truncate">{filename}</span>
      <span className="shrink-0 text-[11px] text-[--fg-subtle]">
        {attachmentLabel("", attachment.size_bytes)}
      </span>
      {statusBadge(status)}
      <Download className="h-3 w-3 shrink-0 text-[--fg-subtle]" />
    </a>
  );
}