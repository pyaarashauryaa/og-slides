// Which team screen to show: landing -> create / join -> lobby. (The workspace itself is mounted by SessionGate.)
import { useTeam } from "./TeamProvider.jsx";
import Landing from "./Landing.jsx";
import { CreateTeamForm, JoinTeamForm, TeamCreated } from "./TeamForms.jsx";
import TeamLobby from "./TeamLobby.jsx";

export default function TeamFlow() {
  const t = useTeam();
  if (t.screen === "create") return <CreateTeamForm />;
  if (t.screen === "created" && t.current) return <TeamCreated />;
  if (t.screen === "join") return <JoinTeamForm />;
  if (t.screen === "lobby" && t.current) return <TeamLobby />;
  return <Landing />;
}
