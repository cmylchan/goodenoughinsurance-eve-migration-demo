import { AgentChat } from "@/app/_components/agent-chat";
import { requireViewer } from "@/lib/session";

export default async function NewSessionPage() {
  const viewer = await requireViewer();
  return <AgentChat sessionless viewer={viewer} />;
}
