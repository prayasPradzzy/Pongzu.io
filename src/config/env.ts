// Backend origin for both the REST room check and the Socket.io connection.
// Set VITE_API_URL at build time (e.g. in Netlify); falls back to the local dev server.
const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

export const SERVER_URL = (raw ? raw : 'http://localhost:3001').replace(/\/+$/, '');
