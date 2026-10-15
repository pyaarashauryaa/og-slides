import { CometChatAudioPlugin } from "@cometchat/chat-uikit-react";
import VoiceBubble from "../components/VoiceBubble.jsx";

// Registered through <CometChatProvider plugins={[...]}>. The kit builds its list as [...yourPlugins, ...defaultPlugins]
// and uses the FIRST plugin that matches a message's type and category, so this one handles audio messages
// (voice notes and attached audio files) instead of the default audio plugin. Message options (copy, delete, reply,
// info...) and the conversation preview are still the kit's own.
export const ogAudioPlugin = {
  id: "ogslides-audio",
  messageTypes: ["audio"],
  messageCategories: ["message"],
  renderBubble(message, context) {
    return <VoiceBubble message={message} alignment={context?.alignment === "right" ? "right" : "left"} />;
  },
  getOptions: (message, context) => CometChatAudioPlugin.getOptions?.(message, context) ?? [],
  getLastMessagePreview: (message, user, t) => CometChatAudioPlugin.getLastMessagePreview?.(message, user, t) ?? "Voice note",
};
