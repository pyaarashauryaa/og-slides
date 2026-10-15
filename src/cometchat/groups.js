// Finds a group, creates it if missing, joins it if we are not a member yet.
// (Same steps as teamRoom.js, for any group. teamRoom.js is left untouched.)
import { CometChat } from "@cometchat/chat-sdk-javascript";

export async function ensureGroup({ guid, name }) {
  const type = CometChat.GROUP_TYPE.PUBLIC;
  let group;
  try {
    group = await CometChat.getGroup(guid);
  } catch (error) {
    if (error?.code !== "ERR_GUID_NOT_FOUND") throw error;
    try {
      group = await CometChat.createGroup(new CometChat.Group(guid, name, type, ""));
    } catch (createError) {
      try {
        group = await CometChat.getGroup(guid); // someone else created it a moment ago
      } catch {
        throw createError;
      }
    }
  }
  if (!group.getHasJoined()) {
    try {
      group = await CometChat.joinGroup(guid, type, "");
    } catch (error) {
      if (error?.code !== "ERR_ALREADY_JOINED") throw error;
      group = await CometChat.getGroup(guid);
    }
  }
  return group;
}
