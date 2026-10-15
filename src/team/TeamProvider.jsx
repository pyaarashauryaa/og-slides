// Everything about WHICH team you are in: your team list, creating, joining, the lobby, and opening the workspace.
// Sits inside SessionProvider (needs the signed-in user) and outside the workspace (which needs the active team).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../session/SessionProvider.jsx";
import { cometchatTeams } from "./cometchatTeams.js";
import { createMemoryTeams } from "./memoryTeams.js";
import { createAttemptLimiter } from "./attemptLimiter.js";
import { explainTeamError } from "./teamErrors.js";
import { validateTeamInput, validateJoinInput, validatePersonName, normalizeCode, normalizePasskey } from "./teamCodes.js";

const TeamContext = createContext(null);
export const useTeam = () => useContext(TeamContext);

const KEY = "ogslides.team"; // this tab's last team: { code, open }. Never contains a passkey.
const readSaved = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return null; } };
const writeSaved = (v) => { try { if (v) sessionStorage.setItem(KEY, JSON.stringify(v)); else sessionStorage.removeItem(KEY); } catch { /* fine without storage */ } };

// Development only: ?team=DEV234 puts this test tab straight into a built-in test team (memory test mode only).
const DEV_TEAM = { code: "DEV234", name: "Dev test team", passkey: "DEVKEY23" };
const devTeamParam = () => {
  if (!import.meta.env.DEV) return null;
  try { return new URLSearchParams(window.location.search).get("team") === DEV_TEAM.code ? DEV_TEAM : null; } catch { return null; }
};

export function TeamProvider({ children }) {
  const session = useSession();
  const limiter = useMemo(() => createAttemptLimiter({ max: 5, windowMs: 60_000 }), []);
  const ready = session.phase === "ready" && Boolean(session.user);
  const selfUid = ready ? session.user.getUid() : null;
  const selfName = ready ? session.user.getName?.() || selfUid : "";

  // Created in an effect (not useMemo) so React's dev double-run closes the first copy and builds a fresh one.
  const [service, setService] = useState(null);
  useEffect(() => {
    if (!ready) { setService(null); return undefined; }
    const svc = session.dev ? createMemoryTeams({ uid: selfUid, name: selfName }, import.meta.env.DEV ? { seed: DEV_TEAM } : {}) : cometchatTeams;
    setService(svc);
    return () => svc.close?.();
  }, [ready, session.dev, selfUid, selfName]);

  const [teams, setTeams] = useState({ phase: "idle", list: [], error: null });
  const [screen, setScreen] = useState("landing"); // landing | create | created | join | lobby
  const [current, setCurrent] = useState(null); // the team shown in the lobby / opened in the workspace
  const [inWorkspace, setInWorkspace] = useState(false);
  const [fresh, setFresh] = useState(null); // { code, passkey }: only exists in memory, right after creating a team
  const [resuming, setResuming] = useState(false);
  const [notice, setNotice] = useState("");
  const resumedFor = useRef(null);

  const refreshTeams = useCallback(async () => {
    if (!service) return [];
    setTeams((t) => ({ ...t, phase: "loading", error: null }));
    try {
      const list = await service.listMyTeams();
      setTeams({ phase: "ready", list, error: null });
      return list;
    } catch (e) {
      console.error("OGSlides: couldn't load teams:", e?.code || e?.name || "error");
      setTeams({ phase: "error", list: [], error: explainTeamError(e, "list") });
      return [];
    }
  }, [service]);

  // When someone signs in: load their teams, and (same tab, e.g. after a refresh) go back to the team they were in.
  useEffect(() => {
    if (!service) {
      setTeams({ phase: "idle", list: [], error: null });
      setCurrent(null);
      setInWorkspace(false);
      setScreen("landing");
      resumedFor.current = null;
      return undefined;
    }
    if (resumedFor.current === selfUid) return undefined;
    resumedFor.current = selfUid;
    let cancelled = false;
    (async () => {
      const devTeam = devTeamParam();
      setResuming(Boolean(devTeam || readSaved())); // only show "opening your team" when there is a team to go back to
      if (devTeam && session.dev) {
        try {
          const r = await service.joinTeam({ code: devTeam.code, passkey: devTeam.passkey });
          if (!cancelled) { setCurrent(r.team); setInWorkspace(true); writeSaved({ code: r.team.code, open: true }); }
        } catch (e) { console.error("OGSlides dev team failed:", e?.code || "error"); }
      }
      const saved = readSaved();
      const list = await refreshTeams();
      if (!cancelled && !devTeam && saved) {
        const hit = list.find((t) => t.code === saved.code);
        if (hit) {
          try {
            await service.openTeam(hit); // must still really be a member
            if (!cancelled) { setCurrent(hit); setInWorkspace(Boolean(saved.open)); setScreen("lobby"); }
          } catch { writeSaved(null); }
        } else writeSaved(null);
      }
      if (!cancelled) setResuming(false);
    })();
    return () => {
      cancelled = true;
      if (resumedFor.current === selfUid) resumedFor.current = null; // an interrupted run (e.g. React's dev double-run) may start again
    };
  }, [service, selfUid, refreshTeams, session.dev]);

  // --- actions: each returns { ok:true, ... } or { ok:false, field?, message } so forms can show the reason ---

  const ensureAccount = useCallback(async (personName) => {
    if (ready) return { ok: true };
    if (!session.signUp) return { ok: false, message: "Sign in first." };
    const v = validatePersonName(personName);
    if (!v.ok) return { ok: false, field: "person", message: v.message };
    try {
      await session.signUp(v.name);
      return { ok: true };
    } catch (e) {
      console.error("OGSlides sign-up failed:", e?.kind || e?.code || e?.name || "error");
      // Errors from our own sign-in server already carry a plain-language message.
      return { ok: false, message: e?.name === "AuthApiError" ? e.message : explainTeamError(e, "create").message };
    }
  }, [ready, session]);

  const createTeam = useCallback(async ({ name, description, personName }) => {
    const v = validateTeamInput({ name, description });
    if (!v.ok) return v;
    const acct = await ensureAccount(personName);
    if (!acct.ok) return acct;
    // The service appears on the next render; wait for it without a busy loop.
    const svc = await waitForService();
    if (!svc) return { ok: false, message: "We couldn't finish signing you in. Please try again." };
    try {
      const { team, passkey } = await svc.createTeam({ name: v.name, description: v.description });
      setCurrent(team);
      setFresh({ code: team.code, passkey });
      writeSaved({ code: team.code, open: false });
      setScreen("created");
      refreshTeams();
      return { ok: true, team };
    } catch (e) {
      console.error("OGSlides create team failed:", e?.code || e?.name || "error");
      return { ok: false, ...explainTeamError(e, "create") };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureAccount, refreshTeams]);

  const joinTeam = useCallback(async ({ code, passkey, personName }) => {
    const v = validateJoinInput({ code, passkey });
    if (!v.ok) return v;
    const gate = limiter.check(v.code);
    if (!gate.ok) return { ok: false, field: "passkey", kind: "rate", message: `Too many tries. Wait ${Math.ceil(gate.waitMs / 1000)} seconds, then try again.` };
    const acct = await ensureAccount(personName);
    if (!acct.ok) return acct;
    const svc = await waitForService();
    if (!svc) return { ok: false, message: "We couldn't finish signing you in. Please try again." };
    try {
      const { team, already } = await svc.joinTeam({ code: v.code, passkey: v.passkey });
      limiter.success(v.code);
      setNotice(already ? "You're already in this team, so we just opened it for you." : "");
      setCurrent(team);
      writeSaved({ code: team.code, open: false });
      setScreen("lobby");
      refreshTeams();
      return { ok: true, team, already };
    } catch (e) {
      const info = explainTeamError(e, "join");
      if (info.kind === "wrong_passkey") limiter.fail(v.code);
      console.error("OGSlides join team failed:", e?.code || e?.name || "error");
      return { ok: false, field: info.kind === "wrong_passkey" ? "passkey" : info.kind === "not_found" ? "code" : undefined, ...info };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureAccount, limiter, refreshTeams]);

  // Opens a team from "Your teams": re-checks that this account really is a member first.
  const openTeam = useCallback(async (team) => {
    try {
      await service.openTeam(team);
      setNotice("");
      setCurrent(team);
      writeSaved({ code: team.code, open: false });
      setScreen("lobby");
      return { ok: true };
    } catch (e) {
      console.error("OGSlides open team failed:", e?.code || e?.name || "error");
      const notMember = e?.code === "ERR_NOT_A_MEMBER";
      return { ok: false, message: notMember ? "You're no longer a member of this team." : explainTeamError(e, "join").message };
    }
  }, [service]);

  const enterWorkspace = useCallback(() => {
    if (!current) return;
    writeSaved({ code: current.code, open: true });
    setInWorkspace(true);
  }, [current]);

  const toLobby = useCallback(() => {
    if (current) writeSaved({ code: current.code, open: false });
    setInWorkspace(false);
    setScreen("lobby");
  }, [current]);

  const toLanding = useCallback(() => {
    writeSaved(null);
    setInWorkspace(false);
    setCurrent(null);
    setFresh(null);
    setScreen("landing");
    refreshTeams();
  }, [refreshTeams]);

  const leaveTeam = useCallback(async (team) => {
    try {
      await service.leaveTeam(team);
      toLanding();
      return { ok: true };
    } catch (e) {
      return { ok: false, message: explainTeamError(e, "join").message };
    }
  }, [service, toLanding]);

  // useEffect-free way to wait for `service` after a first-time sign-up.
  const serviceRef = useRef(null);
  serviceRef.current = service;
  const waitForService = async () => {
    for (let i = 0; i < 50; i++) {
      if (serviceRef.current) return serviceRef.current;
      await new Promise((r) => setTimeout(r, 40));
    }
    return null;
  };

  const value = useMemo(() => ({
    teams, screen, setScreen, current, inWorkspace, resuming, notice,
    // The passkey is only known on this device right after creating the team; afterwards it is null.
    passkey: fresh && current && fresh.code === current.code ? fresh.passkey : null,
    createTeam, joinTeam, openTeam, enterWorkspace, toLobby, toLanding, leaveTeam, refreshTeams,
    service,
    normalizeCode, normalizePasskey,
  }), [teams, screen, current, inWorkspace, resuming, notice, fresh, createTeam, joinTeam, openTeam, enterWorkspace, toLobby, toLanding, leaveTeam, refreshTeams, service]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}
