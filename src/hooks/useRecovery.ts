import { useEffect } from "react";
import { isTauri, checkRecovery, restoreFromBackup, dismissRecovery } from "../lib/tauri-api";
import { toast } from "sonner";

export function useRecovery({ loadFile }: { loadFile: () => void }) {
  useEffect(() => {
    if (!isTauri) return;

    async function checkForRecovery() {
      try {
        const { ask } = await import("@tauri-apps/plugin-dialog");

        const candidates = await checkRecovery();
        if (candidates.length === 0) return;

        const fileCount = candidates.length;
        const yes = await ask(
          `NoteHub did not shut down cleanly. Backups are available for ${fileCount} file(s). Would you like to restore the most recent backup?`,
          {
            title: "Recover from Crash",
            kind: "warning",
            okLabel: "Restore",
            cancelLabel: "Dismiss",
          }
        );

        if (yes) {
          for (const candidate of candidates) {
            const latest = candidate.backups[0];
            if (latest) {
              await restoreFromBackup(candidate.file_path, latest.backup_path);
            }
          }
          loadFile();
          toast.success(`Restored ${fileCount} file(s) from backup`);
        } else {
          await dismissRecovery();
          toast.info("Recovery dismissed — backups are still available in .notehub/backups/");
        }
      } catch (e) {
        console.error("Recovery check failed:", e);
      }
    }

    const timer = setTimeout(checkForRecovery, 1000);
    return () => clearTimeout(timer);
  }, [loadFile]);
}
