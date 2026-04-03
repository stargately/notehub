import { useEffect } from "react";
import { isTauri } from "../lib/tauri-api";
import { toast } from "sonner";

export function useAutoUpdate() {
  useEffect(() => {
    if (!isTauri) return;

    async function checkForUpdate() {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const { ask } = await import("@tauri-apps/plugin-dialog");

        const update = await check();
        if (!update) return;

        const yes = await ask(
          `A new version (${update.version}) is available. Would you like to update now?`,
          {
            title: "Update Available",
            kind: "info",
            okLabel: "Update",
            cancelLabel: "Later",
          }
        );

        if (!yes) return;

        await update.downloadAndInstall();

        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      } catch (e) {
        toast.error("Auto-update check failed");
      }
    }

    const timer = setTimeout(checkForUpdate, 2000);
    return () => clearTimeout(timer);
  }, []);
}