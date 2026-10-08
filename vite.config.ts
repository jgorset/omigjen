import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { youtubeAudio } from './server/youtube-audio.ts';

export default defineConfig({ plugins: [tailwindcss(), youtubeAudio()] });
