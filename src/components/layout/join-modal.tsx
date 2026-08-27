"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { consumeInvite } from "@/lib/data/api";

const MESSAGES: Record<string, string> = {
  invite_not_found: "That code doesn't match any invite.",
  invite_expired: "That invite has expired.",
  invite_exhausted: "That invite has reached its use limit.",
};

export function JoinModal({
  open,
  onClose,
  onJoined,
}: {
  open: boolean;
  onClose: () => void;
  onJoined?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const close = () => {
    onClose();
    setTimeout(() => {
      setCode("");
      setError(null);
      setLoading(false);
    }, 260);
  };

  const join = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Paste an invite code or link.");
      return;
    }
    // accept a full URL as well as a bare code
    const parsed = trimmed.includes("/join/")
      ? trimmed.split("/join/").pop()!.split(/[?#]/)[0]
      : trimmed;

    setError(null);
    setLoading(true);
    try {
      const { conversation } = await consumeInvite(parsed);
      onJoined?.();
      close();
      toast.push({ kind: "success", title: `Joined ${conversation.name ?? "the room"}` });
      router.push(`/app/c/${conversation.id}`);
    } catch (e) {
      setLoading(false);
      const key = String((e as Error).message);
      setError(MESSAGES[key] ?? "Couldn't redeem that invite.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Join a room"
      description="Paste the invite code or the full link someone shared with you."
      className="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={join} loading={loading}>
            Join room
          </Button>
        </>
      }
    >
      <Field label="Invite code" error={error} id="invite-code">
        <Input
          id="invite-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
          placeholder="a1b2c3d4e5f6"
          autoFocus
          className="font-mono"
        />
      </Field>
    </Modal>
  );
}
