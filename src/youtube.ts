export interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(time: number, ahead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlaybackRate(): number;
  getAvailablePlaybackRates(): number[];
  setPlaybackRate(rate: number): void;
  setVolume(volume: number): void;
  getVideoData(): { title?: string };
  destroy(): void;
}
type PlayerEvent = { target: YouTubePlayer; data: number };
declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: { Player: new (element: HTMLElement, options: {
      videoId: string;
      playerVars: Record<string, string | number>;
      events: Record<string, (event: PlayerEvent) => void>;
    }) => YouTubePlayer };
  }
}

let api: Promise<void> | null = null;
export function loadYouTube(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (api) return api;
  api = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => fail(), 15000);
    function fail() {
      clearTimeout(timeout);
      script.remove();
      api = null;
      reject(new Error('YouTube svarte ikke. Sjekk nettet og prøv igjen.'));
    }
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timeout); resolve(); };
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = fail;
    document.head.append(script);
  });
  return api;
}
