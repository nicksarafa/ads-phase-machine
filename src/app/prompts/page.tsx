import PromptsScreen from "@/components/PromptsScreen";
import { getState } from "@/lib/store";
import type { Ad } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The prompt library on its own screen.
 *
 * On the dashboard this competed with the controls for a narrow column, which
 * is the wrong shape for reading a 15,000-character prompt. Here it gets the
 * width, and the dashboard gets its column back.
 */
export default function PromptsPage() {
  const s = getState();
  const ads = s.adOrder
    .map((id) => s.ads[id])
    .filter((a): a is Ad => Boolean(a) && a.status === "active")
    .slice(0, 60);

  return <PromptsScreen ads={JSON.parse(JSON.stringify(ads))} />;
}
