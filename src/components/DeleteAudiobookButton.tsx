"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAudiobookAction } from "@/app/library-actions";

export function DeleteAudiobookButton({
  sourceUrl,
  title,
}: {
  sourceUrl: string;
  title: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      setError(null);
      return;
    }
    startTransition(async () => {
      const result = await deleteAudiobookAction(sourceUrl);
      if (!result.ok) {
        setError(result.error ?? "Could not delete.");
        return;
      }
      setConfirming(false);
      setError(null);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div
        className="flex shrink-0 items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"
        >
          {pending ? "Deleting…" : `Delete ${title.length > 12 ? "?" : ""}`}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirming(false);
            setError(null);
          }}
          disabled={pending}
          className="rounded-md border border-border px-2.5 py-1 text-xs text-muted transition hover:bg-surface-elevated hover:text-foreground"
        >
          Cancel
        </button>
        {error ? (
          <span className="text-xs text-red-300" title={error}>
            !
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Delete ${title}`}
      title="Delete from library"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100 focus:opacity-100"
    >
      <TrashIcon />
    </button>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
