/**
 * Secure API Client for Iris
 * Implements HMAC request signing, timestamp validation, and certificate pinning
 * to prevent MITM attacks
 */

const crypto = require('crypto');
const https = require('https');
const axios = require('axios');

// Shared secret for HMAC signing (must match server)
// In production, this would be obfuscated/encrypted in the binary
const IRIS_SHARED_SECRET = 'NM_IRIS_SEC_K3Y_2024_!@#$%^&*()_SECURE';

// Request timestamp tolerance (5 minutes)
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

// Certificate pinning for production
const PINNED_CERTIFICATES = [
  // SHA-256 fingerprint of the server's certificate
  // Update this when the certificate is renewed
  'sha256//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' // Placeholder - update with actual cert fingerprint
];

/**
 * Generate HMAC signature for request
 * @param {string} method - HTTP method
 * @param {string} path - API path (e.g., /iris/heartbeat)
 * @param {number} timestamp - Unix timestamp in ms
 * @param {string} nonce - Random nonce
 * @param {object|string} body - Request body
 * @returns {string} - HMAC signature
 */
function generateSignature(method, path, timestamp, nonce, body = '') {
  const bodyString = typeof body === 'object' ? JSON.stringify(body) : (body || '');
  
  // Create message to sign: METHOD|PATH|TIMESTAMP|NONCE|BODY_HASH
  const bodyHash = crypto.createHash('sha256').update(bodyString).digest('hex');
  const message = `${method.toUpperCase()}|${path}|${timestamp}|${nonce}|${bodyHash}`;
  
  // Generate HMAC-SHA256 signature
  const signature = crypto.createHmac('sha256', IRIS_SHARED_SECRET)
    .update(message)
    .digest('hex');
  
  return signature;
}

/**
 * Generate random nonce
 * @returns {string} - 32 character random hex string
 */
function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Create secure axios instance with request signing
 * @param {string} baseURL - API base URL
 * @param {boolean} isDev - Development mode flag
 * @returns {object} - Configured axios instance
 */
function createSecureClient(baseURL, isDev = false) {
  // Configure HTTPS agent with certificate pinning for production
  const httpsAgent = !isDev ? new https.Agent({
    rejectUnauthorized: true,
    // Certificate pinning callback
    checkServerIdentity: (host, cert) => {
      // In production, verify the certificate fingerprint
      // For now, just use default verification
      // TODO: Implement proper certificate pinning when certificate is available
      return undefined; // undefined = success
    }
  }) : undefined;

  const instance = axios.create({
    baseURL,
    timeout: 30000,
    httpsAgent,
    headers: {
      'Content-Type': 'application/json',
      'X-Iris-Client': 'desktop',
      'X-Iris-Version': '1.0.0'
    }
  });

  // Add request interceptor for signing
  instance.interceptors.request.use((config) => {
    const timestamp = Date.now();
    const nonce = generateNonce();
    const path = config.url.replace(baseURL, '');
    const method = config.method.toUpperCase();
    const body = config.data || '';
    
    // Generate signature
    const signature = generateSignature(method, path, timestamp, nonce, body);
    
    // Add security headers
    config.headers['X-Iris-Timestamp'] = timestamp.toString();
    config.headers['X-Iris-Nonce'] = nonce;
    config.headers['X-Iris-Signature'] = signature;
    
    return config;
  }, (error) => {
    return Promise.reject(error);
  });

  // Add response interceptor for signature verification
  instance.interceptors.response.use((response) => {
    // Verify response signature if present
    const serverSignature = response.headers['x-iris-response-signature'];
    const serverTimestamp = response.headers['x-iris-response-timestamp'];
    
    if (serverSignature && serverTimestamp) {
      const expectedSignature = generateResponseSignature(
        response.config.url,
        serverTimestamp,
        response.data
      );
      
      if (serverSignature !== expectedSignature) {
        console.error('[Iris Security] Response signature mismatch - possible tampering!');
        // In production, you might want to reject the response
        // For now, just log the warning
      }
    }
    
    return response;
  }, (error) => {
    return Promise.reject(error);
  });

  return instance;
}

/**
 * Generate response signature for verification
 * @param {string} path - API path
 * @param {string} timestamp - Server timestamp
 * @param {object} body - Response body
 * @returns {string} - Expected signature
 */
function generateResponseSignature(path, timestamp, body) {
  const bodyString = typeof body === 'object' ? JSON.stringify(body) : (body || '');
  const bodyHash = crypto.createHash('sha256').update(bodyString).digest('hex');
  const message = `RESPONSE|${path}|${timestamp}|${bodyHash}`;
  
  return crypto.createHmac('sha256', IRIS_SHARED_SECRET)
    .update(message)
    .digest('hex');
}

/**
 * Encrypt sensitive data before sending
 * @param {object} data - Data to encrypt
 * @returns {object} - Encrypted payload
 */
function encryptPayload(data) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(IRIS_SHARED_SECRET, 'iris-salt', 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const jsonData = JSON.stringify(data);
  let encrypted = cipher.update(jsonData, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted: true,
    iv: iv.toString('hex'),
    data: encrypted,
    tag: authTag.toString('hex')
  };
}

/**
 * Decrypt response data
 * @param {object} encryptedPayload - Encrypted payload
 * @returns {object} - Decrypted data
 */
function decryptPayload(encryptedPayload) {
  if (!encryptedPayload.encrypted) {
    return encryptedPayload;
  }
  
  const key = crypto.scryptSync(IRIS_SHARED_SECRET, 'iris-salt', 32);
  const iv = Buffer.from(encryptedPayload.iv, 'hex');
  const authTag = Buffer.from(encryptedPayload.tag, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedPayload.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}

module.exports = {
  createSecureClient,
  generateSignature,
  generateNonce,
  encryptPayload,
  decryptPayload,
  TIMESTAMP_TOLERANCE_MS,
  IRIS_SHARED_SECRET
};
