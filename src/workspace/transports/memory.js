// DEV TEST TRANSPORT. It is NOT CometChat and NOT shared between computers.
// It links tabs of ONE browser through BroadcastChannel so the editor and sync UI
// can be tested without CometChat. It stores nothing on disk (no localStorage):
// a new tab asks the open tabs for their copy of the log.
// Only used when you open the app with ?dev=memory&as=cometchat-uid-1 in `npm run dev`.

import { tinyDataUrl } from "../../slides/imageTools.js";

export function createMemoryTransport(self, teamCode = "") {
  // One channel per team, so tabs in different teams never see each other's slides.
  const channel = new BroadcastChannel(teamCode ? `ogslides-dev-sync-${teamCode}` : "ogslides-dev-sync");
  const log = new Map();
  let handlers = null;
  let counter = 0;

  const nextSeq = () => Date.now() * 1000 + ((counter++ + Math.floor(Math.random() * 500)) % 1000);

  channel.onmessage = ({ data }) => {
    if (!data) return;
    if (data.type === "hello") channel.postMessage({ type: "log", ops: [...log.values()] });
    else if (data.type === "log") for (const op of data.ops) log.set(op.seq, op);
    else if (data.type === "op") {
      log.set(data.op.seq, data.op);
      handlers?.onOp(data.op);
    } else if (data.type === "presence") handlers?.onPresence(data.data);
  };

  return {
    async connect() {
      channel.postMessage({ type: "hello" });
      await new Promise((r) => setTimeout(r, 250)); // give the other tabs time to answer
    },
    async fetchHistory() {
      return [...log.values()];
    },
    async send(payload) {
      await new Promise((r) => setTimeout(r, 30));
      const op = { seq: nextSeq(), sentAt: Date.now(), by: { uid: self.uid, name: self.name }, payload: JSON.parse(JSON.stringify(payload)) };
      log.set(op.seq, op);
      channel.postMessage({ type: "op", op });
      return op;
    },
    subscribe(h) {
      handlers = h;
      return () => {
        handlers = null;
        channel.close();
      };
    },
    // Test mode has no file storage: the picture is shrunk and travels inside the edit.
    uploadImage: (file) => tinyDataUrl(file),
    sendPresence(data) {
      channel.postMessage({ type: "presence", data });
    },
  };
}
