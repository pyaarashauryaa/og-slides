// Real teams on CometChat. A team = two PASSWORD groups that share one passkey (see teamCodes.js).
// CometChat's server checks the passkey in joinGroup(), so nobody gets in with only a room code.
// Nothing here stores the passkey: CometChat keeps it, and it cannot be read back (shown once, at creation).
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { chatGuidFor, syncGuidFor, codeFromChatGuid, generateRoomCode, generatePasskey, LEGACY_CODE } from "./teamCodes.js";

const PASSWORD = () => CometChat.GROUP_TYPE.PASSWORD;
const MAX_CODE_TRIES = 5;

export const LEGACY_TEAM = {
  code: LEGACY_CODE,
  name: "Our team room",
  description: "The shared room from before teams existed.",
  chatGuid: "ogslides-team-room",
  syncGuid: "ogslides-workspace-sync",
  legacy: true,
};

function toTeam(group) {
  const owner = group.getOwner?.();
  return {
    code: codeFromChatGuid(group.getGuid()),
    name: group.getName(),
    description: group.getDescription?.() || "",
    chatGuid: group.getGuid(),
    syncGuid: syncGuidFor(codeFromChatGuid(group.getGuid())),
    ownerUid: owner || "",
    memberCount: group.getMembersCount?.() ?? null,
    createdAt: group.getCreatedAt?.() ? group.getCreatedAt() * 1000 : null,
    legacy: false,
  };
}

const isCode = (e, ...codes) => codes.includes(e?.code);

async function removeQuietly(guid) {
  try { await CometChat.deleteGroup(guid); } catch { /* best effort cleanup */ }
}

export const cometchatTeams = {
  kind: "cometchat",

  async createTeam({ name, description }) {
    const passkey = generatePasskey();
    let lastError = null;
    for (let i = 0; i < MAX_CODE_TRIES; i++) {
      const code = generateRoomCode();
      const chat = new CometChat.Group(chatGuidFor(code), name, PASSWORD(), passkey);
      if (description) chat.setDescription(description);
      let chatGroup;
      try {
        chatGroup = await CometChat.createGroup(chat);
      } catch (e) {
        lastError = e;
        if (isCode(e, "ERR_GUID_ALREADY_EXISTS")) continue; // someone owns this code: try another
        throw e;
      }
      try {
        const data = new CometChat.Group(syncGuidFor(code), `${name} (shared data)`, PASSWORD(), passkey);
        await CometChat.createGroup(data);
      } catch (e) {
        await removeQuietly(chatGroup.getGuid()); // never leave a half-made team behind
        if (isCode(e, "ERR_GUID_ALREADY_EXISTS")) { lastError = e; continue; }
        throw e;
      }
      return { team: toTeam(chatGroup), passkey };
    }
    throw lastError || new Error("Could not find a free room code.");
  },

  async joinTeam({ code, passkey }) {
    const chatGuid = chatGuidFor(code);
    let existing = null;
    try {
      existing = await CometChat.getGroup(chatGuid);
    } catch (e) {
      throw e; // ERR_GUID_NOT_FOUND etc. are explained by explainTeamError
    }
    if (existing.getHasJoined?.()) {
      // Already a member: no second membership, but make sure the data group is joined too.
      await this._joinData(code, passkey, true);
      return { team: toTeam(existing), already: true };
    }
    let joined;
    try {
      joined = await CometChat.joinGroup(chatGuid, PASSWORD(), passkey);
    } catch (e) {
      if (!isCode(e, "ERR_ALREADY_JOINED")) throw e;
      joined = await CometChat.getGroup(chatGuid);
    }
    await this._joinData(code, passkey, false);
    return { team: toTeam(joined), already: false };
  },

  async _joinData(code, passkey, quiet) {
    const guid = syncGuidFor(code);
    try {
      const g = await CometChat.getGroup(guid);
      if (g.getHasJoined?.()) return;
    } catch (e) {
      if (!quiet) throw e;
    }
    try {
      await CometChat.joinGroup(guid, PASSWORD(), passkey);
    } catch (e) {
      if (!isCode(e, "ERR_ALREADY_JOINED")) throw e;
    }
  },

  // Teams this account has really joined (CometChat's own list), plus the old shared room if this account used it.
  async listMyTeams() {
    const teams = [];
    const req = new CometChat.GroupsRequestBuilder().setLimit(100).joinedOnly(true).build();
    for (let i = 0; i < 10; i++) {
      const page = await req.fetchNext();
      for (const g of page || []) if (codeFromChatGuid(g.getGuid())) teams.push(toTeam(g));
      if (!page || page.length < 100) break;
    }
    try {
      const old = await CometChat.getGroup(LEGACY_TEAM.syncGuid);
      if (old.getHasJoined?.()) teams.push({ ...LEGACY_TEAM });
    } catch { /* no old room, or not allowed to see it: no legacy entry */ }
    return teams;
  },

  // Re-checks that this account is still a member before a team workspace opens.
  async openTeam(team) {
    const guid = team.legacy ? team.syncGuid : team.syncGuid;
    const g = await CometChat.getGroup(guid);
    if (!g.getHasJoined?.()) {
      const e = new Error("Not a member of this team");
      e.code = "ERR_NOT_A_MEMBER";
      throw e;
    }
    return team;
  },

  async listMembers(team) {
    const req = new CometChat.GroupMembersRequestBuilder(team.chatGuid).setLimit(100).build();
    const out = [];
    for (let i = 0; i < 5; i++) {
      const page = await req.fetchNext();
      for (const m of page || []) {
        const status = m.getStatus?.();
        out.push({
          uid: m.getUid(),
          name: m.getName() || m.getUid(),
          avatar: m.getAvatar?.() || "",
          online: status === "online" ? true : status === "offline" ? false : null,
          owner: m.getUid() === team.ownerUid || m.getScope?.() === "admin",
        });
      }
      if (!page || page.length < 100) break;
    }
    return out;
  },

  async leaveTeam(team) {
    try { await CometChat.leaveGroup(team.syncGuid); } catch { /* may already be out */ }
    await CometChat.leaveGroup(team.chatGuid);
  },
};
