import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { youtubeAudio } from './server/youtube-audio.ts';

export default defineConfig({
  plugins: [tailwindcss(), youtubeAudio()],
  // Keep the browser storage address stable between development and preview.
  server: { port: 5177, strictPort: true },
  preview: { port: 5177, strictPort: true },
});
