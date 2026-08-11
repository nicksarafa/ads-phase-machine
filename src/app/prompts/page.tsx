import Link from "next/link";
import PromptsPanel from "@/components/PromptsPanel";
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

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <h1>Prompts</h1>
          <span>files, format references, and the prompt they build</span>
        </div>
        <span className="spacer" style={{ flex: 1 }} />
        <Link className="btn" href="/">
          ← Back to the wall
        </Link>
      </header>

      <div className="prompt-screen">
        <PromptsPanel ads={JSON.parse(JSON.stringify(ads))} version={0} />
      </div>
    </div>
  );
}
