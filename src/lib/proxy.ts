export function proxiedAudioUrl(originalUrl: string): string {
  return `/api/audio-proxy?url=${encodeURIComponent(originalUrl)}`;
}
