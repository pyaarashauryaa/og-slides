// Sends and receives workspace edits through a SECOND, hidden CometChat group.
// The team chat group is never used for this, so chat stays clean.
//
// Every call below was checked against the installed SDK (@cometchat/chat-sdk-javascript 4.2.0)
// and the CometChat docs: CustomMessage, sendCustomMessage, MessageListener.onCustomMessageReceived,
// MessagesRequestBuilder.setGUID/.setCategories/.setTypes/.setLimit, fetchPrevious,
// TransientMessage + sendTransientMessage, ConnectionListener.
import { CometChat } from "@cometchat/chat-sdk-javascript";

const OP_TYPE = "ogslides.ops.v1";
const PAGE = 100; // CometChat returns at most 100 messages per request
const MAX_PAGES = 200; // safety stop: 20,000 edits

// CometChat gives times in seconds; our code wants milliseconds.
const toMs = (t) => (t < 1e12 ? t * 1000 : t);

function toOp(message) {
  const sender = message.getSender?.();
  const data = message.getCustomData?.();
  return {
    seq: Number(message.getId()),
    sentAt: toMs(Number(message.getSentAt?.() || Date.now() / 1000)),
    by: { uid: sender?.getUid?.() || "unknown", name: sender?.getName?.() || "Someone" },
    payload: data,
  };
}

// `team.syncGuid` is the team's own hidden data group. Only members of that team can read or write it.
export function createCometChatTransport(team) {
  const guid = team.syncGuid;
  const listenerId = `ogslides-sync-${Math.random().toString(36).slice(2, 8)}`;

  return {
    async connect() {
      // Never creates or joins anything: you must already be a member (joining needs the team passkey).
      const group = await CometChat.getGroup(guid);
      if (!group.getHasJoined?.()) {
        const e = new Error("Not a member of this team");
        e.code = "ERR_NOT_A_MEMBER";
        throw e;
      }
    },

    async fetchHistory() {
      const request = new CometChat.MessagesRequestBuilder()
        .setGUID(guid)
        .setCategories([CometChat.CATEGORY_CUSTOM])
        .setTypes([OP_TYPE])
        .setLimit(PAGE)
        .build();
      const all = [];
      for (let i = 0; i < MAX_PAGES; i++) {
        const page = await request.fetchPrevious(); // each call returns the next-older page
        if (!page || !page.length) break;
        for (const m of page) all.push(toOp(m));
        if (page.length < PAGE) break;
      }
      return all; // the engine sorts and de-duplicates by seq
    },

    async send(payload) {
      const message = new CometChat.CustomMessage(guid, CometChat.RECEIVER_TYPE.GROUP, OP_TYPE, payload);
      message.shouldUpdateConversation(false); // keep this out of conversation lists
      const sent = await CometChat.sendCustomMessage(message);
      return toOp(sent);
    },

    subscribe({ onOp, onPresence, onConnection }) {
      CometChat.addMessageListener(
        listenerId,
        new CometChat.MessageListener({
          onCustomMessageReceived: (m) => {
            if (m.getReceiverId?.() === guid && m.getType?.() === OP_TYPE) onOp(toOp(m));
          },
          onTransientMessageReceived: (t) => {
            if (t.getReceiverId?.() === guid) onPresence(t.getData?.());
          },
        })
      );
      CometChat.addConnectionListener(
        listenerId,
        new CometChat.ConnectionListener({
          onConnected: () => onConnection("connected"),
          inConnecting: () => onConnection("connecting"),
          onDisconnected: () => onConnection("disconnected"),
        })
      );
      return () => {
        CometChat.removeMessageListener(listenerId);
        CometChat.removeConnectionListener(listenerId);
      };
    },

    // Uploads a picture to CometChat's own file storage and returns its https link.
    // Only the LINK is stored in the shared edit log, never the picture.
    // (Whether every teammate's browser may open that link has to be checked with a real two-user test.)
    uploadImage(file) {
      return new Promise((resolve, reject) => {
        const request = CometChat.createUploadFileRequest(guid, CometChat.RECEIVER_TYPE.GROUP);
        const fileId = `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        request.uploadAttachment(
          fileId,
          file,
          new CometChat.UploadFileListener({
            onFileUploaded: (_id, attachment) => {
              const url = attachment.getUrl();
              try { request.clearAll(); } catch { /* nothing to clean */ }
              resolve(url);
            },
            onFileError: (_id, e) => reject(e),
            onFileFailure: (_id, e) => reject(e),
          })
        );
      });
    },
    sendPresence(data) {
      CometChat.sendTransientMessage(new CometChat.TransientMessage(guid, CometChat.RECEIVER_TYPE.GROUP, data));
    },
  };
}
