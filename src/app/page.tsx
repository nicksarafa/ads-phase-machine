import Dashboard from "@/components/Dashboard";
import { getState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Page() {
  // Server-rendered first paint, then the client takes over the SSE stream.
  const initial = JSON.parse(JSON.stringify(getState()));
  return <Dashboard initial={initial} />;
}
