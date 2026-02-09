// Centralized configuration - uses environment variables
// Development: .env.development (auto-loaded by Vite when running `npm run dev`)
// Production: .env.production (auto-loaded by Vite when running `npm run build`)

const getApiUrl = () => {
  // If VITE_API_URL is explicitly set, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In development mode, use localhost
  if (import.meta.env.DEV) {
    return 'http://localhost:5000/api';
  }
  // Production default
  return 'https://api-nomercy.ggsecure.io/api';
};

const getSocketUrl = () => {
  // If VITE_SOCKET_URL is explicitly set, use it
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  // If VITE_API_URL is set, derive socket URL from it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace('/api', '');
  }
  // In development mode, use localhost
  if (import.meta.env.DEV) {
    return 'http://localhost:5000';
  }
  // Production default
  return 'https://api-nomercy.ggsecure.io';
};

export const API_URL = getApiUrl();
export const SOCKET_URL = getSocketUrl();

// Base URL for uploads (banners, avatars, etc.)
// In development, uploads are served from production since files don't exist locally
const getUploadsBaseUrl = () => {
  if (import.meta.env.VITE_UPLOADS_BASE_URL) {
    return import.meta.env.VITE_UPLOADS_BASE_URL;
  }
  // In dev mode, use production URL so banners/avatars load correctly
  if (import.meta.env.DEV) {
    return 'https://api-nomercy.ggsecure.io';
  }
  return SOCKET_URL;
};
export const UPLOADS_BASE_URL = getUploadsBaseUrl();

// For debugging
if (import.meta.env.DEV) {
  console.log('[Config] API_URL:', API_URL);
  console.log('[Config] SOCKET_URL:', SOCKET_URL);
  console.log('[Config] UPLOADS_BASE_URL:', UPLOADS_BASE_URL);
}
