// Mentions are stored in message text as @[uid:Name] (people) and #[channelId:name] (channels).

// Plain-text version for previews: "@[uid:Bob]" -> "@Bob", "#[id:general]" -> "#general"
export function stripMentionTokens(text) {
  return text ? text.replace(/([@#])\[([^:\]]+):([^\]]+)\]/g, '$1$3') : text
}

export const OPEN_CHANNEL_EVENT = 'dinoclan:open-channel'

// Ask whichever layout is on screen (desktop or mobile) to switch to a channel in the same server
export function openChannel(serverId, channelId) {
  window.dispatchEvent(new CustomEvent(OPEN_CHANNEL_EVENT, { detail: { serverId, channelId } }))
}
