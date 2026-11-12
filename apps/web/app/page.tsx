import { AgentChat } from "@/app/_components/agent-chat";
import { requireViewer } from "@/lib/session";

export default async function Page() {
  const viewer = await requireViewer();
  return <AgentChat viewer={viewer} />;
}
