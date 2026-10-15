import { ArrowLeftRight } from "lucide-react";
import SessionGate from "../session/SessionGate.jsx";
import { useSession } from "../session/SessionProvider.jsx";
import { useTeam } from "../team/TeamProvider.jsx";
import TeamChatPanel from "../components/TeamChatPanel.jsx";

function ChatPage() {
  const s = useSession();
  const team = useTeam();
  return (
    <div className="chat-page">
      <div className="chat-bar">
        <p>
          You're chatting as <strong>{s.user?.getName()}</strong> in <strong>{team.current?.name}</strong>
        </p>
        <button className="btn btn--ghost btn--small" onClick={team.toLanding}>
          <ArrowLeftRight size={16} aria-hidden="true" /> Switch team
        </button>
      </div>
      <TeamChatPanel />
    </div>
  );
}

export default function ChatRoom() {
  return (
    <SessionGate>
      <ChatPage />
    </SessionGate>
  );
}
