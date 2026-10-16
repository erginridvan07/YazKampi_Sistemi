/** Duyuru gövdesi düz metin (Textarea); innerHTML ile render edilmez. */
export function normalizeAnnouncementContent(content: unknown): string {
  return typeof content === 'string' ? content : ''
}

export const announcementContentClassName = 'whitespace-pre-wrap'
