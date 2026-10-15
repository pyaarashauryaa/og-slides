// Makes sure the shared team-room group exists and the signed-in user is in it.
import { CometChat } from "@cometchat/chat-sdk-javascript";

export const TEAM_ROOM = {
  guid: "ogslides-team-room", // letters, numbers, - and _ only (CometChat rule)
  name: "OGSlides team room",
};

export async function ensureTeamRoom() {
  const { guid, name } = TEAM_ROOM;
  const type = CometChat.GROUP_TYPE.PUBLIC;
  let group;

  // 1. Does the group already exist?
  try {
    group = await CometChat.getGroup(guid);
  } catch (error) {
    if (error?.code !== "ERR_GUID_NOT_FOUND") throw error;

    // 2. No: create it. The creator becomes its admin and a member.
    try {
      group = await CometChat.createGroup(new CometChat.Group(guid, name, type, ""));
    } catch (createError) {
      // Another tab may have created it a moment ago, so look once more.
      try {
        group = await CometChat.getGroup(guid);
      } catch {
        throw createError;
      }
    }
  }

  // 3. Existing group but we are not a member yet: join it.
  if (!group.getHasJoined()) {
    try {
      group = await CometChat.joinGroup(guid, type, "");
    } catch (error) {
      if (error?.code !== "ERR_ALREADY_JOINED") throw error;
      group = await CometChat.getGroup(guid); // already a member: just refresh the group
    }
  }

  return group;
}
