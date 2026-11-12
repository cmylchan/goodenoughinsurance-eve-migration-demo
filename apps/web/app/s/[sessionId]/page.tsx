import { AgentChat } from "@/app/_components/agent-chat";
import { requireViewer } from "@/lib/session";

export default async function SessionPage({
  params,
}: {
  readonly params: Promise<{ readonly sessionId: string }>;
}) {
  const { sessionId } = await params;
  const viewer = await requireViewer();
  return <AgentChat sessionId={sessionId} viewer={viewer} />;
}
