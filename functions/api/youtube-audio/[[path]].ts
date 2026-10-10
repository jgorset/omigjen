import { hostedYoutubeAudio } from '../../../server/hosted-youtube.ts';

export const onRequest = ({ request, env }: { request: Request; env: Env & { APIFY_TOKEN?: string } }) => hostedYoutubeAudio(request, env);
