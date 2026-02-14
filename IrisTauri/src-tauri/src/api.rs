//! API client module for NoMercy server communication

use hmac::{Hmac, Mac};
use obfstr::obfstr;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

fn client_version() -> String {
    obfstr!("1.0.0").to_string()
}

#[derive(Clone)]
pub struct IrisApiClient {
    client: Client,
    base_url: String,
    hmac_secret: String,
    is_dev: bool,
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
            obfstr!("http://localhost:5000/api").to_string()
        } else {
            obfstr!("https://nomercy.ggsecure.io/api").to_string()
        };

        // HMAC secret (obfuscated)
        let hmac_secret = obfstr!("NM_IRIS_SEC_K3Y_2024_!@#$%^&*()_SECURE").to_string();

        // Build client
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .pool_idle_timeout(std::time::Duration::from_secs(90))
            .pool_max_idle_per_host(1)
            .tcp_keepalive(std::time::Duration::from_secs(30))
            .tcp_nodelay(true)
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url,
            hmac_secret,
            is_dev,
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

        // Add headers (obfuscated)
        request = request
            .header(obfstr!("Content-Type"), obfstr!("application/json"))
            .header(obfstr!("X-Iris-Client"), obfstr!("desktop"))
            .header(obfstr!("X-Iris-Version"), client_version())
            .header(obfstr!("X-Iris-Timestamp"), timestamp.to_string())
            .header(obfstr!("X-Iris-Nonce"), &nonce)
            .header(obfstr!("X-Iris-Signature"), &signature);

        if let Some(t) = token {
            request = request.header(obfstr!("Authorization"), format!("Bearer {}", t));
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
        self.request("GET", obfstr!("/iris/verify"), Some(token), None).await
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
        self.request("POST", obfstr!("/iris/register-hardware"), Some(token), Some(body)).await
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
        self.request("POST", obfstr!("/iris/heartbeat"), Some(token), Some(body)).await
    }

    /// Test basic connectivity (no auth required)
    pub async fn health_check(&self) -> Result<bool, String> {
        let url = format!("{}{}", self.base_url, obfstr!("/iris/health"));
        let response = self.client.get(&url)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| format!("Health check failed: {}", e))?;
        
        Ok(response.status().is_success())
    }

    /// Send simple ping (alive signal)
    pub async fn send_ping(&self, token: &str) -> Result<ApiResponse<serde_json::Value>, String> {
        self.request("POST", obfstr!("/iris/ping"), Some(token), Some(serde_json::json!({}))).await
    }

    /// Create auth session for desktop OAuth flow
    pub async fn create_auth_session(&self) -> Result<AuthSessionResponse, String> {
        self.request("POST", obfstr!("/iris/auth/create-session"), None, Some(serde_json::json!({}))).await
    }

    /// Check auth session status (polling)
    pub async fn check_auth_status(&self, session_id: &str) -> Result<AuthStatusResponse, String> {
        self.request("GET", &format!("{}/{}", obfstr!("/iris/auth/status"), session_id), None, None).await
    }

    /// Send behavioral metrics to server
    pub async fn send_behavioral_data(
        &self,
        token: &str,
        metrics: serde_json::Value,
        match_id: Option<&str>,
    ) -> Result<ApiResponse<BehavioralAnalysisResponse>, String> {
        let body = serde_json::json!({
            "metrics": metrics,
            "matchId": match_id
        });
        self.request("POST", obfstr!("/iris/behavioral"), Some(token), Some(body)).await
    }

    /// Get player's behavioral profile baseline
    pub async fn get_behavioral_baseline(&self, token: &str) -> Result<ApiResponse<BehavioralBaseline>, String> {
        self.request("GET", obfstr!("/iris/behavioral/baseline"), Some(token), None).await
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
    let client_id = obfstr!("1447607594351853618").to_string();
    let redirect_uri = if is_dev {
        obfstr!("http://localhost:5000/api/iris/discord-callback").to_string()
    } else {
        obfstr!("https://nomercy.ggsecure.io/api/iris/discord-callback").to_string()
    };

    format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope=identify%20email",
        obfstr!("https://discord.com/api/oauth2/authorize"),
        client_id,
        urlencoding::encode(&redirect_uri)
    )
}

/// Behavioral analysis response from server
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BehavioralAnalysisResponse {
    pub is_anomalous: bool,
    pub anomaly_score: u32,
    pub risk_level: String,
    pub baseline_deviation: f64,
    pub flags: Vec<BehavioralFlag>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BehavioralFlag {
    pub flag_type: String,
    pub description: String,
    pub severity: String,
}

/// Player's behavioral baseline
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BehavioralBaseline {
    pub has_baseline: bool,
    pub sample_count: u32,
    pub avg_mouse_velocity: f64,
    pub avg_reaction_time: f64,
    pub consistency_profile: f64,
}
