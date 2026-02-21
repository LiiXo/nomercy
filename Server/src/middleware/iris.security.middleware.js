/**
 * Iris Security Middleware
 * Verifies HMAC signatures and timestamps to prevent MITM attacks
 */

import crypto from 'crypto';

// Shared secret for HMAC signing (must match client)
const IRIS_SHARED_SECRET = process.env.IRIS_SHARED_SECRET || 'NM_IRIS_SEC_K3Y_2024_!@#$%^&*()_SECURE';

// Request timestamp tolerance (10 minutes - increased for clock drift)
const TIMESTAMP_TOLERANCE_MS = 10 * 60 * 1000;

// Endpoints that can skip signature verification (protected by token auth)
const SKIP_SIGNATURE_ENDPOINTS = ['/iris/ping', '/iris/heartbeat', '/iris/verify'];

// Nonce cache to prevent replay attacks (in production, use Redis)
const nonceCache = new Map();
const NONCE_CACHE_CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

// Cleanup expired nonces periodically
setInterval(() => {
  const now = Date.now();
  for (const [nonce, timestamp] of nonceCache.entries()) {
    if (now - timestamp > TIMESTAMP_TOLERANCE_MS * 2) {
      nonceCache.delete(nonce);
    }
  }
}, NONCE_CACHE_CLEANUP_INTERVAL);

/**
 * Generate HMAC signature for verification
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @param {number} timestamp - Unix timestamp in ms
 * @param {string} nonce - Random nonce
 * @param {object|string} body - Request body
 * @returns {string} - Expected HMAC signature
 */
function generateExpectedSignature(method, path, timestamp, nonce, body = '') {
  // For GET/DELETE requests or empty body, use empty string
  let bodyString = '';
  
  if (method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'DELETE') {
    if (body && typeof body === 'object' && Object.keys(body).length > 0) {
      bodyString = JSON.stringify(body);
    } else if (typeof body === 'string' && body.length > 0) {
      bodyString = body;
    }
  }
  
  // Create message to verify: METHOD|PATH|TIMESTAMP|NONCE|BODY_HASH
  const bodyHash = crypto.createHash('sha256').update(bodyString).digest('hex');
  const message = `${method.toUpperCase()}|${path}|${timestamp}|${nonce}|${bodyHash}`;
  
  // Generate HMAC-SHA256 signature
  const signature = crypto.createHmac('sha256', IRIS_SHARED_SECRET)
    .update(message)
    .digest('hex');
  
  return signature;
}

/**
 * Generate response signature
 * @param {string} path - API path
 * @param {number} timestamp - Server timestamp
 * @param {object} body - Response body
 * @returns {string} - Response signature
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
 * Middleware to verify Iris request signatures
 * Prevents MITM attacks by validating HMAC signatures and timestamps
 */
export const verifyIrisSignature = (req, res, next) => {
  // Get security headers
  const clientTimestamp = req.headers['x-iris-timestamp'];
  const clientNonce = req.headers['x-iris-nonce'];
  const clientSignature = req.headers['x-iris-signature'];
  const irisClient = req.headers['x-iris-client'];
  
  // Check if this is an Iris request
  if (!irisClient || irisClient !== 'desktop') {
    // Not an Iris request, allow through (for web clients, etc.)
    return next();
  }
  
  // Get path for checking skip endpoints
  const path = req.originalUrl.replace('/api', '');
  
  // Skip signature verification for certain endpoints (they use token auth)
  if (SKIP_SIGNATURE_ENDPOINTS.some(ep => path.startsWith(ep))) {
    return next();
  }
  
  // Validate required headers
  if (!clientTimestamp || !clientNonce || !clientSignature) {
    console.warn('[Iris Security] Missing security headers from:', req.ip);
    return res.status(401).json({
      success: false,
      message: 'Missing security headers',
      code: 'IRIS_SEC_MISSING_HEADERS'
    });
  }
  
  const timestamp = parseInt(clientTimestamp, 10);
  const now = Date.now();
  
  // Validate timestamp (prevent replay attacks with old requests)
  if (isNaN(timestamp) || Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE_MS) {
    console.warn('[Iris Security] Invalid timestamp from:', req.ip, 'Diff:', Math.abs(now - timestamp), 'ms');
    return res.status(401).json({
      success: false,
      message: 'Request expired or invalid timestamp',
      code: 'IRIS_SEC_INVALID_TIMESTAMP'
    });
  }
  
  // Check for nonce reuse (prevent replay attacks)
  if (nonceCache.has(clientNonce)) {
    console.warn('[Iris Security] Nonce reuse detected from:', req.ip);
    return res.status(401).json({
      success: false,
      message: 'Request replay detected',
      code: 'IRIS_SEC_REPLAY_DETECTED'
    });
  }
  
  // Generate expected signature
  let expectedSignature;
  try {
    expectedSignature = generateExpectedSignature(
      req.method,
      path,
      timestamp,
      clientNonce,
      req.body
    );
  } catch (error) {
    console.error('[Iris Security] Error generating signature:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal signature error',
      code: 'IRIS_SEC_INTERNAL_ERROR'
    });
  }
  
  // Constant-time comparison to prevent timing attacks
  let signatureBuffer, expectedBuffer;
  try {
    signatureBuffer = Buffer.from(clientSignature, 'hex');
    expectedBuffer = Buffer.from(expectedSignature, 'hex');
  } catch (error) {
    console.error('[Iris Security] Error creating signature buffers:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Invalid signature format',
      code: 'IRIS_SEC_INVALID_FORMAT'
    });
  }
  
  if (signatureBuffer.length !== expectedBuffer.length || 
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    console.warn('[Iris Security] Signature mismatch from:', req.ip, 'Path:', path);
    return res.status(401).json({
      success: false,
      message: 'Invalid request signature',
      code: 'IRIS_SEC_INVALID_SIGNATURE'
    });
  }
  
  // Store nonce to prevent reuse
  nonceCache.set(clientNonce, timestamp);
  
  // Add response signature
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const responseTimestamp = Date.now();
    const responseSignature = generateResponseSignature(path, responseTimestamp, body);
    
    res.setHeader('X-Iris-Response-Timestamp', responseTimestamp.toString());
    res.setHeader('X-Iris-Response-Signature', responseSignature);
    
    return originalJson(body);
  };
  
  // Request is valid
  next();
};

/**
 * Decrypt encrypted Iris payload
 */
export const decryptIrisPayload = (req, res, next) => {
  if (req.body && req.body.encrypted === true) {
    try {
      const key = crypto.scryptSync(IRIS_SHARED_SECRET, 'iris-salt', 32);
      const iv = Buffer.from(req.body.iv, 'hex');
      const authTag = Buffer.from(req.body.tag, 'hex');
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(req.body.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      req.body = JSON.parse(decrypted);
      console.log('[Iris Security] Payload decrypted successfully');
    } catch (error) {
      console.error('[Iris Security] Decryption failed:', error.message);
      return res.status(400).json({
        success: false,
        message: 'Failed to decrypt payload',
        code: 'IRIS_SEC_DECRYPT_FAILED'
      });
    }
  }
  
  next();
};

export default {
  verifyIrisSignature,
  decryptIrisPayload,
  generateResponseSignature
};
