// Turns CometChat / network errors into short, honest sentences. Pure, so it is unit-tested.
const text = (e) => `${e?.code || ""} ${e?.name || ""} ${e?.message || ""} ${e?.details || ""}`.toLowerCase();

export function explainTeamError(err, action = "join") {
  const t = text(err);
  const code = String(err?.code || "");
  if (/guid_not_found|not.found|does not exist|no such group/.test(t)) {
    return { kind: "not_found", message: "We couldn't find a team with that room code. Check it and try again." };
  }
  if (/wrong.*(group.*)?pass|invalid.*pass|password.*(wrong|incorrect|invalid)|err_wrong/.test(t)) {
    return { kind: "wrong_passkey", message: "That passkey doesn't match this team. Check it with whoever invited you." };
  }
  if (/empty_group_pass|pass.*(empty|required|blank)/.test(t)) {
    return { kind: "wrong_passkey", message: "Enter the passkey for this team." };
  }
  if (/banned|kicked|blocked/.test(t)) {
    return { kind: "banned", message: "You can't join this team. Ask its owner for help." };
  }
  if (/guid_already_exists|already.exist/.test(t) && action === "create") {
    return { kind: "exists", message: "That room code was just taken. Please try again." };
  }
  if (/permission|not_authorized|unauthor|forbidden|403|401|auth.?token/.test(t)) {
    return { kind: "denied", message: "CometChat didn't allow that for this account. Try signing in again." };
  }
  if (/network|offline|failed_to_fetch|fetch|timeout|websocket|connection/.test(t)) {
    return { kind: "network", message: "Couldn't reach CometChat. Check your internet connection and try again." };
  }
  if (/rate|too.many|limit/.test(t) || code === "429") {
    return { kind: "rate", message: "Too many tries. Wait a minute, then try again." };
  }
  return { kind: "unknown", message: action === "create" ? "We couldn't create the team. Please try again." : "We couldn't join that team. Please try again.", technical: code || err?.message || "" };
}
