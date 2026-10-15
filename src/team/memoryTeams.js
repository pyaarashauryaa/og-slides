// DEV TEST version of the team service. NOT secure and NOT shared between computers: it links browser tabs on ONE
// computer through BroadcastChannel so create/join/lobby can be tested without CometChat keys.
// It does mimic the real rules: unknown room codes fail, a wrong passkey fails, passkeys are stored only as a salted hash,
// joining twice does not add a second membership, and you only list teams you belong to.
import { chatGuidFor, syncGuidFor, generateRoomCode, generatePasskey } from "./teamCodes.js";

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");

// store: { teams: { CODE: {code,name,description,ownerUid,createdAt,salt,hash,members:{uid:{uid,name,joinedAt}}} } }
export function createMemoryTeams(self, { channelName = "ogslides-dev-teams", delay = 120, seed = null } = {}) {
  const store = { teams: {} };
  // Optional built-in test team (development only), so test pages can all start in the same team.
  const seeding = (async () => {
    if (!seed) return;
    const salt = "seed";
    const hash = await sha256(salt + seed.passkey);
    if (store.teams[seed.code]) return;
    store.teams[seed.code] = {
      code: seed.code, name: seed.name, description: "Built-in team for development testing.", ownerUid: "", createdAt: Date.now(),
      salt, hash, members: {},
    };
  })();
  const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(channelName) : null;
  const wait = (ms = delay) => new Promise((r) => setTimeout(r, ms));
  const merge = (incoming) => {
    for (const [code, t] of Object.entries(incoming?.teams || {})) {
      const mine = store.teams[code];
      if (!mine) store.teams[code] = t;
      else mine.members = { ...t.members, ...mine.members };
    }
  };
  if (channel) {
    channel.onmessage = ({ data }) => {
      if (data?.type === "hello") channel.postMessage({ type: "store", store });
      else if (data?.type === "store") merge(data.store);
    };
    channel.postMessage({ type: "hello" });
  }
  const share = () => channel?.postMessage({ type: "store", store });
  const view = (t) => ({
    code: t.code, name: t.name, description: t.description,
    chatGuid: chatGuidFor(t.code), syncGuid: syncGuidFor(t.code),
    ownerUid: t.ownerUid, memberCount: Object.keys(t.members).length, createdAt: t.createdAt, legacy: false,
  });
  const err = (code, message) => Object.assign(new Error(message), { code });

  return {
    kind: "memory",
    close() { channel?.close(); },

    async createTeam({ name, description }) {
      await seeding;
      await wait(250); // let other tabs share what they know, so codes stay unique
      let code;
      do { code = generateRoomCode(); } while (store.teams[code]);
      const passkey = generatePasskey();
      const salt = hex();
      store.teams[code] = {
        code, name, description, ownerUid: self.uid, createdAt: Date.now(), salt, hash: await sha256(salt + passkey),
        members: { [self.uid]: { uid: self.uid, name: self.name, joinedAt: Date.now() } },
      };
      share();
      return { team: view(store.teams[code]), passkey };
    },

    async joinTeam({ code, passkey }) {
      await seeding;
      await wait(250);
      const t = store.teams[code];
      if (!t) throw err("ERR_GUID_NOT_FOUND", "Group not found");
      if ((await sha256(t.salt + passkey)) !== t.hash) throw err("ERR_WRONG_GROUP_PASS", "Wrong passkey");
      const already = Boolean(t.members[self.uid]);
      if (!already) t.members[self.uid] = { uid: self.uid, name: self.name, joinedAt: Date.now() };
      share();
      return { team: view(t), already };
    },

    async listMyTeams() {
      await seeding;
      await wait(250);
      return Object.values(store.teams).filter((t) => t.members[self.uid]).map(view);
    },

    async openTeam(team) {
      await seeding;
      const t = store.teams[team.code];
      if (!t || !t.members[self.uid]) throw err("ERR_NOT_A_MEMBER", "Not a member");
      return team;
    },

    async listMembers(team) {
      await wait(60);
      const t = store.teams[team.code];
      if (!t) return [];
      // The test service cannot know who is online, so it reports "unknown" (null), never a made-up status.
      return Object.values(t.members).map((m) => ({ uid: m.uid, name: m.name, avatar: "", online: null, owner: m.uid === t.ownerUid }));
    },

    async leaveTeam(team) {
      const t = store.teams[team.code];
      if (t) delete t.members[self.uid];
      share();
    },
  };
}
