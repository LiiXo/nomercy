//! Secure storage module using keyring for credentials

use obfstr::obfstr;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

fn service_name() -> String {
    obfstr!("IrisAnticheat").to_string()
}

fn key_token() -> String {
    obfstr!("token").to_string()
}

fn key_user() -> String {
    obfstr!("user").to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UserSession {
    pub user_id: String,
    pub discord_id: String,
    pub username: String,
    pub avatar_url: Option<String>,
    pub hardware_id: String,
    pub token: String,
}

lazy_static::lazy_static! {
    static ref SESSION: Mutex<Option<UserSession>> = Mutex::new(None);
}

/// Save token to secure storage
pub fn save_token(token: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(&service_name(), &key_token())
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    entry.set_password(token)
        .map_err(|e| format!("Failed to save token: {}", e))
}

/// Get token from secure storage
pub fn get_token() -> Option<String> {
    let entry = keyring::Entry::new(&service_name(), &key_token()).ok()?;
    entry.get_password().ok()
}

/// Delete token from secure storage
pub fn delete_token() -> Result<(), String> {
    let entry = keyring::Entry::new(&service_name(), &key_token())
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    // Ignore error if entry doesn't exist
    let _ = entry.delete_password();
    Ok(())
}

/// Save user data to secure storage
pub fn save_user(user: &UserSession) -> Result<(), String> {
    let json = serde_json::to_string(user)
        .map_err(|e| format!("Failed to serialize user: {}", e))?;
    
    let entry = keyring::Entry::new(&service_name(), &key_user())
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    entry.set_password(&json)
        .map_err(|e| format!("Failed to save user: {}", e))?;
    
    // Also update in-memory cache
    if let Ok(mut session) = SESSION.lock() {
        *session = Some(user.clone());
    }
    
    Ok(())
}

/// Get user data from secure storage
pub fn get_user() -> Option<UserSession> {
    // Check in-memory cache first
    if let Ok(session) = SESSION.lock() {
        if let Some(ref user) = *session {
            return Some(user.clone());
        }
    }
    
    // Load from keyring
    let entry = keyring::Entry::new(&service_name(), &key_user()).ok()?;
    let json = entry.get_password().ok()?;
    let user: UserSession = serde_json::from_str(&json).ok()?;
    
    // Update cache
    if let Ok(mut session) = SESSION.lock() {
        *session = Some(user.clone());
    }
    
    Some(user)
}

/// Delete user data from secure storage
pub fn delete_user() -> Result<(), String> {
    let entry = keyring::Entry::new(&service_name(), &key_user())
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    // Ignore error if entry doesn't exist
    let _ = entry.delete_password();
    
    // Clear in-memory cache
    if let Ok(mut session) = SESSION.lock() {
        *session = None;
    }
    
    Ok(())
}

/// Clear all stored data (logout)
pub fn clear_all() -> Result<(), String> {
    delete_token()?;
    delete_user()?;
    Ok(())
}
