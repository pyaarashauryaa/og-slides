// Owns the voice room for the whole app. It sits ABOVE page navigation (see App.jsx), so moving
// between Slides, Tasks, Resources and Team chat never ends the call.
//
// What this really is: a shared CometChat call session that everyone joins with the same session ID,
// using the official Calls SDK. People can join and leave freely, like a voice channel, but it is NOT a
// permanent Discord channel: you can't see who is inside before you join, and it closes by itself after
// being empty for a few minutes. It does not survive a page refresh.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatSoundManager, CometChatUIKit, loadCallsSDK } from "@cometchat/chat-uikit-react";
import { COMETCHAT } from "../config.js";
import { useSession } from "../session/SessionProvider.jsx";
import { useToast } from "../ui/Toast.jsx";
import { useTeam } from "../team/TeamProvider.jsx";
import {
  sessionIdFor,
  sessionSettingsFor,
  inviteText,
  roomName,
  callSupport,
  callSupportHelp,
  explainCallError,
  explainMediaError,
  isInRoom,
  normaliseParticipants,
} from "./callLogic.js";
import { resolveAuthToken, ensureCallsInit } from "./authToken.js";
import { RING_SECONDS, callSid, callType, decideIncoming, directTitle, explainDirectError, outcomeMessage, peerFromCall } from "./directCall.js";
import CallPopups from "./CallPopups.jsx";
import CallDock from "./CallDock.jsx";

export const CallContext = createContext(null);
export const useCall = () => useContext(CallContext);

const SPEAK_MS = 2500; // the SDK says who spoke last; we show the ring for a moment

export function CallProvider({ children }) {
  const session = useSession();
  const team = useTeam();
  const toast = useToast();
  const stageRef = useRef(null);
  const callsRef = useRef(null);
  const unsubs = useRef([]);
  const speakTimer = useRef(null);
  const leaveTimer = useRef(null);
  const statusRef = useRef("idle");

  const [status, setStatusState] = useState("idle");
  const [error, setError] = useState(null); // { friendly, technical }
  const [muted, setMuted] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [remoteMuted, setRemoteMuted] = useState({});
  const [speakingUid, setSpeakingUid] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [mode, setMode] = useState("voice"); // "voice" | "video"
  const [cameraOn, setCameraOn] = useState(false);
  const [large, setLarge] = useState(false);
  const [notified, setNotified] = useState(false);
  const [kind, setKind] = useState("room"); // "room" (shared join-and-leave session) | "direct" (rings one person)
  const [peer, setPeer] = useState(null);
  const [ring, setRingState] = useState(null); // null | { dir: "in"|"out", sid, mode, peer }
  const kindRef = useRef("room");
  const sidRef = useRef("");
  const ringRef = useRef(null);
  const ringTimer = useRef(null);
  const startingRef = useRef(false);
  const handlers = useRef({});
  const peerRef = useRef(null);


  const setRing = useCallback((r) => {
    ringRef.current = r;
    setRingState(r);
  }, []);
  const stopRingSound = useCallback(() => {
    try { CometChatSoundManager.pause(); } catch { /* sound is optional */ }
  }, []);
  const clearRing = useCallback(() => {
    clearTimeout(ringTimer.current);
    stopRingSound();
    setRing(null);
  }, [setRing, stopRingSound]);

  const setStatus = useCallback((s) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const selfUid = session.uid;
  const available = Boolean(session.user) && !session.dev;

  const clearListeners = useCallback(() => {
    unsubs.current.forEach((u) => {
      try { u(); } catch { /* already gone */ }
    });
    unsubs.current = [];
    clearTimeout(speakTimer.current);
    clearTimeout(leaveTimer.current);
  }, []);

  const resetRoomState = useCallback(() => {
    setParticipants([]);
    setRemoteMuted({});
    setSpeakingUid(null);
    setMuted(false);
    setCameraOn(false);
    setLarge(false);
    setNotified(false);
  }, []);

  const finish = useCallback((nextStatus, err = null) => {
    if (kindRef.current === "direct") {
      try { CometChat.clearActiveCall(); } catch { /* nothing to clear */ }
    }
    sidRef.current = "";
    kindRef.current = "room";
    setKind("room");
    setPeer(null);
    peerRef.current = null;
    clearListeners();
    resetRoomState();
    setError(err);
    setStatus(nextStatus);
  }, [clearListeners, resetRoomState, setStatus]);

  const listen = useCallback((calls) => {
    const on = (name, fn) => {
      try {
        unsubs.current.push(calls.addEventListener(name, fn));
      } catch (e) {
        console.warn("OGSlides: could not listen to", name, e);
      }
    };
    on("onSessionJoined", () => setStatus("connected"));
    on("onSessionLeft", () => finish("idle"));
    on("onSessionTimedOut", () => finish("ended", { friendly: "The voice room closed because nobody else joined for a while. Join again whenever you like.", technical: "onSessionTimedOut" }));
    on("onConnectionLost", () => statusRef.current === "connected" && setStatus("reconnecting"));
    on("onConnectionRestored", () => setStatus("connected"));
    on("onConnectionClosed", () => statusRef.current !== "leaving" && finish("failed", { friendly: "The connection closed. Join again to continue.", technical: "onConnectionClosed" }));
    on("onConnectionFailed", (e) => finish("failed", { friendly: "The connection to the voice room failed. Check your internet and join again.", technical: `onConnectionFailed${e?.name ? `: ${e.name}` : ""}` }));
    on("onParticipantListChanged", (list) => setParticipants(normaliseParticipants(list, selfUid)));
    on("onVideoPaused", () => setCameraOn(false));
    on("onVideoResumed", () => setCameraOn(true));
    on("onAudioMuted", () => setMuted(true));
    on("onAudioUnMuted", () => setMuted(false));
    on("onParticipantAudioMuted", (p) => p?.uid && setRemoteMuted((m) => ({ ...m, [p.uid]: true })));
    on("onParticipantAudioUnmuted", (p) => p?.uid && setRemoteMuted((m) => ({ ...m, [p.uid]: false })));
    on("onDominantSpeakerChanged", (p) => {
      if (!p?.uid) return;
      setSpeakingUid(p.uid);
      clearTimeout(speakTimer.current);
      speakTimer.current = setTimeout(() => setSpeakingUid(null), SPEAK_MS);
    });
  }, [finish, selfUid, setStatus]);

  // Microphone check, only ever run from a button the person pressed. Returns null if fine, or a sentence.
  const checkMic = useCallback(async () => {
    const support = callSupport();
    if (!support.ok) return callSupportHelp(support.reason);
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((t) => t.stop());
      return null;
    } catch (e) {
      return explainMediaError(e, "microphone");
    }
  }, []);

  // Joins a Calls SDK session. Rooms and direct calls both end up here, so they share one set of lifecycle rules.
  const openSession = useCallback(async ({ sessionId, nextMode, nextKind, nextPeer, skipMicCheck }) => {
    setMode(nextMode);
    setError(null);
    kindRef.current = nextKind;
    setKind(nextKind);
    setPeer(nextPeer || null);
    peerRef.current = nextPeer || null;
    sidRef.current = sessionId;
    if (!skipMicCheck) {
      setStatus("checking-mic");
      const micError = await checkMic();
      if (micError) {
        setError({ friendly: micError, technical: "microphone" });
        setStatus("failed");
        return false;
      }
    }
    setStatus("connecting");
    try {
      const calls = callsRef.current || (await loadCallsSDK());
      if (!calls) throw Object.assign(new Error("Calls SDK not available"), { code: "CALLS_SDK_MISSING" });
      callsRef.current = calls;
      // Use the sign-in that already exists. (Bug fixed earlier: CometChat.getLoggedInUser() is a Promise in
      // Chat SDK 4.x, so reading a token from it directly always failed with AUTH_NO_TOKEN.)
      const authToken = await resolveAuthToken({
        sync: () => CometChatUIKit.getLoggedInUser(),
        async: () => CometChat.getLoggedinUser(),
      });
      if (!authToken) throw Object.assign(new Error("Not signed in to CometChat"), { code: "AUTH_NOT_SIGNED_IN" });
      await ensureCallsInit(calls, { appId: COMETCHAT.appId, region: COMETCHAT.region }, () => CometChatUIKit.isCallingReady?.());
      listen(calls);
      const tokenResult = await calls.generateToken(sessionId, authToken);
      const res = await calls.joinSession(tokenResult.token, sessionSettingsFor(nextMode), stageRef.current);
      if (res?.error) throw res.error;
      setTimeout(() => statusRef.current === "connecting" && setStatus("connected"), 4000);
      return true;
    } catch (e) {
      console.error("OGSlides call join failed:", e?.code || e?.name || "error");
      finish("failed", explainCallError(e));
      return false;
    }
  }, [checkMic, finish, listen, setStatus]);

  const join = useCallback(async (nextMode = "voice") => {
    if (!available || startingRef.current) return;
    if (isInRoom(statusRef.current) || ringRef.current) {
      if (ringRef.current) toast("Answer or cancel the ringing call first.", "info");
      else if (nextMode !== mode || kindRef.current === "direct") toast("Leave your current call first, then join.", "info");
      return;
    }
    startingRef.current = true;
    try {
      await openSession({ sessionId: sessionIdFor(nextMode, team.current?.code), nextMode, nextKind: "room", nextPeer: null });
    } finally {
      startingRef.current = false;
    }
  }, [available, mode, openSession, toast, team.current?.code]);

  // ---- One-to-one calls (they ring a specific person) ----
  const startRing = useCallback((r, onTimeout) => {
    clearTimeout(ringTimer.current);
    setRing(r);
    try { CometChatSoundManager.play(r.dir === "in" ? "incomingCall" : "outgoingCall"); } catch { /* sound is optional */ }
    ringTimer.current = setTimeout(onTimeout, (RING_SECONDS + (r.dir === "in" ? 2 : 0)) * 1000);
  }, [setRing]);

  const cancelOutgoing = useCallback((why) => {
    const r = ringRef.current;
    if (!r || r.dir !== "out") return;
    CometChat.rejectCall(r.sid, CometChat.CALL_STATUS.CANCELLED).catch(() => {});
    try { CometChat.clearActiveCall(); } catch { /* nothing to clear */ }
    clearRing();
    if (why === "unanswered") toast(outcomeMessage("unanswered", r.peer.name), "info");
  }, [clearRing, toast]);

  const callUser = useCallback(async (person, type) => {
    if (!available || startingRef.current || !person?.uid) return false;
    if (isInRoom(statusRef.current) || ringRef.current) {
      toast("You're already in a call. Leave or finish it before calling someone else.", "info");
      return false;
    }
    startingRef.current = true;
    try {
      const micError = await checkMic();
      if (micError) {
        toast(micError, "error", 7000);
        return false;
      }
      const c = new CometChat.Call(person.uid, type === "video" ? CometChat.CALL_TYPE.VIDEO : CometChat.CALL_TYPE.AUDIO, CometChat.RECEIVER_TYPE.USER);
      const out = await CometChat.initiateCall(c, RING_SECONDS);
      startRing({ dir: "out", sid: callSid(out), mode: type === "video" ? "video" : "voice", peer: person }, () => cancelOutgoing("unanswered"));
      return true;
    } catch (e) {
      console.error("OGSlides call could not start:", e?.code || e?.name || "error");
      toast(explainDirectError(e) || explainMediaError(e, "microphone"), "error", 7000);
      return false;
    } finally {
      startingRef.current = false;
    }
  }, [available, cancelOutgoing, checkMic, startRing, toast]);

  const declineIncoming = useCallback((reasonStatus = "rejected") => {
    const r = ringRef.current;
    if (!r || r.dir !== "in") return;
    CometChat.rejectCall(r.sid, reasonStatus === "busy" ? CometChat.CALL_STATUS.BUSY : CometChat.CALL_STATUS.REJECTED).catch(() => {});
    try { CometChat.clearActiveCall(); } catch { /* nothing to clear */ }
    clearRing();
  }, [clearRing]);

  const acceptIncoming = useCallback(async () => {
    const r = ringRef.current;
    if (!r || r.dir !== "in" || startingRef.current) return;
    startingRef.current = true;
    try {
      const micError = await checkMic(); // the pop-up stays so they can still decline
      if (micError) {
        toast(micError, "error", 7000);
        return;
      }
      try {
        await CometChat.acceptCall(r.sid);
      } catch (e) {
        clearRing();
        toast("That call is no longer available. They may have cancelled it.", "info");
        return;
      }
      clearRing();
      await openSession({ sessionId: r.sid, nextMode: r.mode, nextKind: "direct", nextPeer: r.peer, skipMicCheck: true });
    } finally {
      startingRef.current = false;
    }
  }, [checkMic, clearRing, openSession, toast]);

  // Event handlers read the latest state through refs, so the one CometChat listener never goes stale.
  handlers.current = {
    incoming(call) {
      const decision = decideIncoming({
        call,
        selfUid,
        busy: isInRoom(statusRef.current) || Boolean(ringRef.current) || startingRef.current,
        ringSid: ringRef.current?.sid,
      });
      if (decision === "show") {
        startRing({ dir: "in", sid: callSid(call), mode: callType(call), peer: peerFromCall(call, selfUid) }, () => {
          const r = ringRef.current;
          if (r && r.dir === "in") {
            clearRing();
            toast(outcomeMessage("cancelled", r.peer.name), "info");
          }
        });
      } else if (decision === "busy") {
        CometChat.rejectCall(callSid(call), CometChat.CALL_STATUS.BUSY).catch(() => {});
      }
    },
    accepted(call) {
      const r = ringRef.current;
      if (!r || r.dir !== "out" || r.sid !== callSid(call)) return;
      clearRing();
      openSession({ sessionId: r.sid, nextMode: r.mode, nextKind: "direct", nextPeer: r.peer, skipMicCheck: true });
    },
    rejected(call) {
      const r = ringRef.current;
      if (!r || r.dir !== "out" || r.sid !== callSid(call)) return;
      clearRing();
      try { CometChat.clearActiveCall(); } catch { /* nothing to clear */ }
      toast(outcomeMessage(call?.getStatus?.(), r.peer.name), "info");
    },
    cancelled(call) {
      const r = ringRef.current;
      if (!r || r.dir !== "in" || r.sid !== callSid(call)) return;
      clearRing();
      toast(outcomeMessage("cancelled", r.peer.name), "info");
    },
    ended(call) {
      if (kindRef.current !== "direct" || sidRef.current !== callSid(call) || !isInRoom(statusRef.current)) return;
      const name = peerRef.current?.name;
      toast(outcomeMessage("ended", name), "info");
      try { callsRef.current?.leaveSession(); } catch { /* already left */ }
      clearTimeout(leaveTimer.current);
      setStatus("leaving");
      leaveTimer.current = setTimeout(() => finish("idle"), 1500);
    },
  };

  // ONE listener for the signed-in person. It is removed on sign-out / switching user / unmount, never added twice.
  useEffect(() => {
    if (!available) return undefined;
    const id = `ogslides-calls-${selfUid}`;
    CometChat.removeCallListener(id);
    CometChat.addCallListener(
      id,
      new CometChat.CallListener({
        onIncomingCallReceived: (c) => handlers.current.incoming(c),
        onOutgoingCallAccepted: (c) => handlers.current.accepted(c),
        onOutgoingCallRejected: (c) => handlers.current.rejected(c),
        onIncomingCallCancelled: (c) => handlers.current.cancelled(c),
        onCallEndedMessageReceived: (c) => handlers.current.ended(c),
      })
    );
    return () => {
      CometChat.removeCallListener(id);
      // Leaving the screen as this user must not leave a call ringing or running.
      const r = ringRef.current;
      if (r) {
        CometChat.rejectCall(r.sid, r.dir === "out" ? CometChat.CALL_STATUS.CANCELLED : CometChat.CALL_STATUS.REJECTED).catch(() => {});
        clearRing();
      }
    };
  }, [available, selfUid, clearRing]);

  const leave = useCallback(() => {
    if (!isInRoom(statusRef.current)) return;
    setStatus("leaving");
    const wasDirect = kindRef.current === "direct";
    const sid = sidRef.current;
    try {
      callsRef.current?.leaveSession();
    } catch (e) {
      console.warn("OGSlides: leaveSession threw", e);
    }
    // For a one-to-one call, also tell CometChat the call ended so the other person's call stops too.
    if (wasDirect && sid) CometChat.endCall(sid).catch(() => {});
    // onSessionLeft normally finishes this; make sure the panel can never get stuck on "Leaving…".
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => statusRef.current === "leaving" && finish("idle"), 2500);
  }, [finish, setStatus]);

  const toggleMute = useCallback(() => {
    const calls = callsRef.current;
    if (!calls || statusRef.current !== "connected") return;
    try {
      if (muted) calls.unmuteAudio(); else calls.muteAudio();
      setMuted(!muted); // the SDK event confirms it a moment later
    } catch (e) {
      toast("Couldn't change your microphone. Try again.", "error");
    }
  }, [muted, toast]);

  // Camera: only ever turned on by this explicit button. We test the permission first so a refusal gives a clear message.
  const toggleCamera = useCallback(async () => {
    const calls = callsRef.current;
    if (!calls || statusRef.current !== "connected" || mode !== "video") return;
    try {
      if (cameraOn) {
        calls.pauseVideo();
        setCameraOn(false);
        return;
      }
      const probe = await navigator.mediaDevices.getUserMedia({ video: true });
      probe.getTracks().forEach((t) => t.stop());
      calls.resumeVideo();
      setCameraOn(true);
    } catch (e) {
      toast(explainMediaError(e, "camera"), "error", 7000);
    }
  }, [cameraOn, mode, toast]);

  const notifyTeam = useCallback(async () => {
    if (notified) return;
    try {
      const msg = new CometChat.TextMessage(team.current.chatGuid, inviteText(session.user?.getName?.(), mode), CometChat.RECEIVER_TYPE.GROUP);
      await CometChat.sendMessage(msg);
      setNotified(true);
      toast("Posted in Team chat.", "ok");
    } catch (e) {
      toast("Couldn't post in Team chat. Check your connection and try again.", "error");
    }
  }, [mode, notified, session.user, toast, team.current?.chatGuid]);

  const dismiss = useCallback(() => {
    if (!isInRoom(statusRef.current)) finish("idle");
  }, [finish]);

  // Signing out or switching test user must not leave the old user's audio running.
  useEffect(() => {
    return () => {
      if (isInRoom(statusRef.current)) {
        try { callsRef.current?.leaveSession(); } catch { /* ignore */ }
        clearListeners();
      }
    };
  }, [selfUid, clearListeners]);

  const value = useMemo(
    () => ({ available, status, error, muted, participants, remoteMuted, speakingUid, expanded, setExpanded, mode, cameraOn, large, setLarge, notified, stageRef, join, leave, toggleMute, toggleCamera, notifyTeam, dismiss, kind, peer, ring, callUser, acceptIncoming, declineIncoming, cancelOutgoing, title: kind === "direct" ? directTitle(mode, peer?.name) : roomName(mode), inRoom: isInRoom(status) }),
    [available, status, error, muted, participants, remoteMuted, speakingUid, expanded, mode, cameraOn, large, notified, join, leave, toggleMute, toggleCamera, notifyTeam, dismiss, kind, peer, ring, callUser, acceptIncoming, declineIncoming, cancelOutgoing]
  );

  return (
    <CallContext.Provider value={value}>
      {children}
      <CallDock />
      <CallPopups />
    </CallContext.Provider>
  );
}
