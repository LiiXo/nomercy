//! API client module for NoMercy server communication

use hmac::{Hmac, Mac};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

const CLIENT_VERSION: &str = "1.0.0";

#[derive(Clone)]
pub struct IrisApiClient {
    client: Client,
    base_url: String,
    hmac_secret: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: Option<String>,
    #[serde(flatten)]
    pub data: Option<T>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfo {
    pub _id: String,
    pub username: String,
    #[serde(rename = "discordId")]
    pub discord_id: Option<String>,
    #[serde(rename = "discordUsername")]
    pub discord_username: Option<String>,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerifyResponse {
    pub success: bool,
    pub message: Option<String>,
    pub user: Option<UserInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterHardwareRequest {
    #[serde(rename = "hardwareId")]
    pub hardware_id: String,
    #[serde(rename = "systemInfo")]
    pub system_info: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HeartbeatRequest {
    #[serde(rename = "hardwareId")]
    pub hardware_id: String,
    pub security: serde_json::Value,
    #[serde(rename = "systemInfo")]
    pub system_info: Option<serde_json::Value>,
    pub verification: Option<serde_json::Value>,
}

impl IrisApiClient {
    pub fn new(is_dev: bool) -> Self {
        let base_url = if is_dev {
            "http://localhost:5000/api".to_string()
        } else {
            "https://nomercy.ggsecure.io/api".to_string()
        };

        // HMAC secret (same as server default)
        let hmac_secret = "NM_IRIS_SEC_K3Y_2024_!@#$%^&*()_SECURE".to_string();

        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            base_url,
            hmac_secret,
        }
    }

    /// Generate HMAC signature for request (matches server format)
    fn generate_signature(&self, method: &str, path: &str, timestamp: u64, nonce: &str, body: &str) -> String {
        // Hash the body first (server expects body hash)
        let body_hash = {
            let mut hasher = Sha256::new();
            hasher.update(body.as_bytes());
            hex::encode(hasher.finalize())
        };
        
        // Create message: METHOD|PATH|TIMESTAMP|NONCE|BODY_HASH (server format)
        let sign_payload = format!("{}|{}|{}|{}|{}", method.to_uppercase(), path, timestamp, nonce, body_hash);
        
        let mut mac = HmacSha256::new_from_slice(self.hmac_secret.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(sign_payload.as_bytes());
        
        hex::encode(mac.finalize().into_bytes())
    }

    /// Make authenticated request
    async fn request<T: for<'de> Deserialize<'de>>(
        &self,
        method: &str,
        path: &str,
        token: Option<&str>,
        body: Option<serde_json::Value>,
    ) -> Result<T, String> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        
        let nonce = uuid::Uuid::new_v4().to_string().replace("-", "")[..32].to_string();
        let body_str = body.as_ref().map(|b| b.to_string()).unwrap_or_default();
        
        let signature = self.generate_signature(method, path, timestamp, &nonce, &body_str);
        
        let url = format!("{}{}", self.base_url, path);
        
        let mut request = match method {
            "GET" => self.client.get(&url),
            "POST" => self.client.post(&url),
            "PUT" => self.client.put(&url),
            "DELETE" => self.client.delete(&url),
            _ => return Err("Invalid method".to_string()),
        };

        // Add headers
        request = request
            .header("Content-Type", "application/json")
            .header("X-Iris-Client", "desktop")
            .header("X-Iris-Version", CLIENT_VERSION)
            .header("X-Iris-Timestamp", timestamp.to_string())
            .header("X-Iris-Nonce", &nonce)
            .header("X-Iris-Signature", &signature);

        if let Some(t) = token {
            request = request.header("Authorization", format!("Bearer {}", t));
        }

        if let Some(b) = body {
            request = request.json(&b);
        }

        let response = request
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let status = response.status();
        let text = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

        if !status.is_success() {
            return Err(format!("API error {}: {}", status.as_u16(), text));
        }

        serde_json::from_str(&text).map_err(|e| format!("Failed to parse response: {}", e))
    }

    /// Verify Iris token
    pub async fn verify_token(&self, token: &str) -> Result<VerifyResponse, String> {
        self.request("GET", "/iris/verify", Some(token), None).await
    }

    /// Register hardware
    pub async fn register_hardware(
        &self,
        token: &str,
        hardware_id: &str,
        system_info: serde_json::Value,
    ) -> Result<ApiResponse<serde_json::Value>, String> {
        let body = serde_json::json!({
            "hardwareId": hardware_id,
            "systemInfo": system_info
        });
        self.request("POST", "/iris/register-hardware", Some(token), Some(body)).await
    }

    /// Send heartbeat
    pub async fn send_heartbeat(
        &self,
        token: &str,
        hardware_id: &str,
        security: serde_json::Value,
        system_info: Option<serde_json::Value>,
    ) -> Result<ApiResponse<serde_json::Value>, String> {
        let body = serde_json::json!({
            "hardwareId": hardware_id,
            "security": security,
            "systemInfo": system_info
        });
        self.request("POST", "/iris/heartbeat", Some(token), Some(body)).await
    }

    /// Send simple ping (alive signal)
    pub async fn send_ping(&self, token: &str) -> Result<ApiResponse<serde_json::Value>, String> {
        self.request("POST", "/iris/ping", Some(token), Some(serde_json::json!({}))).await
    }

    /// Create auth session for desktop OAuth flow
    pub async fn create_auth_session(&self) -> Result<AuthSessionResponse, String> {
        self.request("POST", "/iris/auth/create-session", None, Some(serde_json::json!({}))).await
    }

    /// Check auth session status (polling)
    pub async fn check_auth_status(&self, session_id: &str) -> Result<AuthStatusResponse, String> {
        self.request("GET", &format!("/iris/auth/status/{}", session_id), None, None).await
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthSessionResponse {
    pub success: bool,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    #[serde(rename = "authUrl")]
    pub auth_url: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthStatusResponse {
    pub success: bool,
    pub status: Option<String>,
    pub token: Option<String>,
    pub user: Option<AuthUser>,
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthUser {
    pub id: String,
    pub username: String,
    #[serde(rename = "discordId")]
    pub discord_id: Option<String>,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
}

/// Get Discord OAuth URL
pub fn get_discord_auth_url(is_dev: bool) -> String {
    let client_id = "1447607594351853618";
    let redirect_uri = if is_dev {
        "http://localhost:5000/api/iris/discord-callback"
    } else {
        "https://nomercy.ggsecure.io/api/iris/discord-callback"
    };

    format!(
        "https://discord.com/api/oauth2/authorize?client_id={}&redirect_uri={}&response_type=code&scope=identify%20email",
        client_id,
        urlencoding::encode(redirect_uri)
    )
}
