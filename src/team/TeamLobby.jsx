// The waiting room for a team: real members, the room code, an invite button, and "Open workspace".
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, LoaderCircle, RefreshCw, TriangleAlert, Users } from "lucide-react";
import { Card } from "./TeamForms.jsx";
import { Avatar } from "../ui/People.jsx";
import { useSession } from "../session/SessionProvider.jsx";
import { useTeam } from "./TeamProvider.jsx";
import CopyButton from "./CopyButton.jsx";
import { buildInvitation, formatCode } from "./teamCodes.js";

const REFRESH_MS = 15_000;

export default function TeamLobby() {
  const t = useTeam();
  const s = useSession();
  const team = t.current;
  const selfUid = s.user?.getUid?.();
  const [state, setState] = useState({ phase: "loading", members: [] });

  const load = useCallback(async () => {
    if (!team || !t.service) return;
    try {
      const members = await t.service.listMembers(team);
      setState({ phase: "ready", members });
    } catch (e) {
      console.error("OGSlides: couldn't load members:", e?.code || e?.name || "error");
      setState((p) => ({ phase: "error", members: p.members }));
    }
  }, [team, t.service]);

  useEffect(() => {
    load();
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!team) return null;
  const owner = state.members.find((m) => m.owner);
  const invite = () => buildInvitation({ name: team.name, code: team.code, passkey: t.passkey, ownerName: owner?.name });
  const members = [...state.members].sort((a, b) => Number(b.uid === selfUid) - Number(a.uid === selfUid) || a.name.localeCompare(b.name));

  return (
    <Card title={team.name} mood="happy" wide onBack={t.toLanding} backLabel="Your teams">
      {team.description && <p className="tcard__lead">{team.description}</p>}
      {t.notice && <p className="tform__ok" role="status">{t.notice}</p>}
      <div className="tlobby__top">
        {!team.legacy && (
          <div className="tcred tcred--inline">
            <span className="tcred__label">Room code</span>
            <code className="tcred__val" aria-label={`Room code ${team.code.split("").join(" ")}`}>{formatCode(team.code)}</code>
            <CopyButton getText={() => team.code} label="Copy room code" doneLabel="Room code copied!">Copy</CopyButton>
          </div>
        )}
        {!team.legacy && <CopyButton className="btn btn--soft btn--small" getText={invite} label="Copy invitation" doneLabel="Invitation copied!">Copy invitation</CopyButton>}
      </div>

      <section aria-labelledby="mem-h" className="tmem">
        <h2 id="mem-h" className="tmem__h"><Users size={18} aria-hidden="true" /> Who's here
          {state.phase === "ready" && <span className="tmem__count">{members.length} member{members.length === 1 ? "" : "s"}</span>}
          <button type="button" className="icon-btn" onClick={load} aria-label="Refresh members" title="Refresh members"><RefreshCw size={16} aria-hidden="true" /></button>
        </h2>
        {state.phase === "loading" && <p role="status" className="yteams__msg"><LoaderCircle size={16} className="spin" aria-hidden="true" /> Loading members…</p>}
        {state.phase === "error" && <p role="alert" className="yteams__msg tform__error"><TriangleAlert size={16} aria-hidden="true" /> Couldn't load the member list. <button type="button" className="btn btn--soft btn--small" onClick={load}>Try again</button></p>}
        {state.phase === "ready" && members.length === 0 && <p className="yteams__msg">No members to show yet.</p>}
        <ul className="tmem__list stagger">
          {members.map((m, i) => {
            const you = m.uid === selfUid;
            const online = you ? true : m.online; // you are signed in right now; for others only a real status is shown
            return (
              <li key={m.uid} className="tmember" style={{ "--i": i }}>
                {m.avatar ? <img className="avatar" src={m.avatar} alt="" width={36} height={36} /> : <Avatar uid={m.uid} name={m.name} size={36} />}
                <span className="tmember__name">{m.name}{you && <em> (you)</em>}</span>
                {m.owner && <span className="tmember__tag">Owner</span>}
                {online === true && <span className="tmember__status is-online">Online</span>}
                {online === false && <span className="tmember__status">Offline</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="tform__actions">
        <button type="button" className="btn btn--primary" onClick={t.enterWorkspace}>Open workspace <ArrowRight size={18} aria-hidden="true" /></button>
        <button type="button" className="btn btn--ghost" onClick={t.toLanding}>Switch team</button>
      </div>
    </Card>
  );
}
