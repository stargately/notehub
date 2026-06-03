import { useEffect, useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import { useRawFile } from "../hooks/useRawFile";
import { languageForPath } from "../lib/file-kind";
import { toAssetUrl } from "../lib/tauri-api";
import type { FileSync } from "../hooks/useFileSync";
import type { FileKind } from "../lib/types";

interface RawFileEditorProps {
  filePath: string;
  kind: FileKind;
  darkMode: boolean;
  sync: FileSync;
}

/**
 * Renders a non-markdown file opened from the workspace tree: images inline, other text
 * files in an editable Monaco editor, and non-text blobs as an "is binary" placeholder.
 */
export function RawFileEditor({ filePath, kind, darkMode, sync }: RawFileEditorProps) {
  if (kind === "image") return <ImageView filePath={filePath} />;
  return <TextView filePath={filePath} darkMode={darkMode} sync={sync} />;
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
  sync,
}: {
  filePath: string;
  darkMode: boolean;
  sync: FileSync;
}) {
  const { content, onChange, loading, error } = useRawFile(filePath, sync);

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
