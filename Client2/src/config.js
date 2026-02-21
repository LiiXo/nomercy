// Centralized configuration - uses environment variables

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:5000/api';
  }
  return 'https://api-nomercy.ggsecure.io/api';
};

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace('/api', '');
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:5000';
  }
  return 'https://api-nomercy.ggsecure.io';
};

const getUploadsBaseUrl = () => {
  if (import.meta.env.VITE_UPLOADS_BASE_URL) {
    return import.meta.env.VITE_UPLOADS_BASE_URL;
  }
  if (import.meta.env.DEV) {
    return 'https://api-nomercy.ggsecure.io';
  }
  return getSocketUrl();
};

export const API_URL = getApiUrl();
export const SOCKET_URL = getSocketUrl();
export const UPLOADS_BASE_URL = getUploadsBaseUrl();

// Debug in development
if (import.meta.env.DEV) {
  console.log('[Config] API_URL:', API_URL);
  console.log('[Config] SOCKET_URL:', SOCKET_URL);
  console.log('[Config] UPLOADS_BASE_URL:', UPLOADS_BASE_URL);
}
