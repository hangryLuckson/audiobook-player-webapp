export interface M3ULink {
  url: string;
  title?: string;
}

export interface AudiobookPlaylist {
  sourceUrl: string;
  title: string;
  chapters: M3ULink[];
}

export interface UserProgress {
  userId: string;
  url: string;
  chapterIndex: number;
  timestamp: number;
  speed: number;
  updatedAt?: string;
}

export interface ExtractResponse {
  playlist: AudiobookPlaylist;
}

export interface ErrorResponse {
  error: string;
}

export const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];
