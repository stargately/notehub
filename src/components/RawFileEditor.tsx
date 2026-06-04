import { useEffect, useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import { ConflictModal } from "./ConflictModal";
import { useRawFile } from "../hooks/useRawFile";
import { useFileSync } from "../hooks/useFileSync";
import { languageForPath } from "../lib/file-kind";
import { toAssetUrl } from "../lib/tauri-api";
import type { FileKind } from "../lib/types";

interface RawFileEditorProps {
  filePath: string;
  kind: FileKind;
  darkMode: boolean;
}

/**
 * Renders a non-markdown file opened from the workspace tree: images inline, other text
 * files in an editable Monaco editor, and non-text blobs as an "is binary" placeholder.
 * Fully self-contained per file — it owns its own disk-sync baseline and conflict handling
 * (one RawFileEditor instance per tab, so nothing is shared across files).
 */
export function RawFileEditor({ filePath, kind, darkMode }: RawFileEditorProps) {
  if (kind === "image") return <ImageView filePath={filePath} />;
  return <TextView filePath={filePath} darkMode={darkMode} />;
}

function ImageView({ filePath }: { filePath: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    toAssetUrl(filePath).then((u) => !cancelled && setUrl(u));
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  return (
    <div
      className="flex-1 overflow-auto flex items-center justify-center p-6"
      style={{ background: "var(--nh-bg)" }}
    >
      {url && (
        <img
          src={url}
          alt={filePath.split("/").pop() ?? ""}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      )}
    </div>
  );
}

function TextView({
  filePath,
  darkMode,
}: {
  filePath: string;
  darkMode: boolean;
}) {
  const sync = useFileSync();
  const { content, onChange, loading, error, reload } = useRawFile(filePath, sync);

  // Cmd+R reloads the active raw doc from disk (parity with markdown's Cmd+R). Clean buffers
  // also auto-reload via useRawFile's watcher; this is the explicit manual reload.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault();
        reload();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [reload]);

  if (error?.includes("binary")) {
    return <BinaryPlaceholder filePath={filePath} />;
  }
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: "var(--nh-text-tertiary)" }}>
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ConflictModal
        conflict={sync.conflict}
        onKeepDisk={() => sync.resolveKeepDisk(reload)}
        onKeepMine={() => sync.resolveKeepMine()}
      />
      <MarkdownEditor
        content={content}
        onChange={onChange}
        darkMode={darkMode}
        language={languageForPath(filePath)}
      />
    </div>
  );
}

function BinaryPlaceholder({ filePath }: { filePath: string }) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center"
      style={{ background: "var(--nh-bg)" }}
    >
      <svg
        className="w-8 h-8"
        style={{ color: "var(--nh-text-tertiary)" }}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 3h7l5 5v13H7a2 2 0 01-2-2V5a2 2 0 012-2z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
      </svg>
      <p className="text-sm font-medium" style={{ color: "var(--nh-text-secondary)" }}>
        {filePath.split("/").pop()}
      </p>
      <p className="text-xs" style={{ color: "var(--nh-text-tertiary)" }}>
        Binary file — can't display
      </p>
    </div>
  );
}
