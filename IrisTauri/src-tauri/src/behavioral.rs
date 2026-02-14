//! Behavioral Analysis Module - Mouse/Keyboard input tracking for anomaly detection
//! 
//! This module collects gameplay behavior metrics to detect abnormal patterns
//! that may indicate cheating (inhuman reaction times, perfect aim snaps, etc.)

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(target_os = "windows")]
use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::POINT;

/// Maximum samples to keep in memory before sending to server
const MAX_SAMPLES: usize = 1000;
/// Minimum samples needed to calculate metrics
const MIN_SAMPLES_FOR_METRICS: usize = 50;

lazy_static::lazy_static! {
    static ref BEHAVIOR_TRACKER: Mutex<BehaviorTracker> = Mutex::new(BehaviorTracker::new());
}

/// Raw mouse movement sample
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MouseSample {
    pub x: i32,
    pub y: i32,
    pub timestamp: u64,
    pub delta_x: i32,
    pub delta_y: i32,
    pub velocity: f64,        // pixels per millisecond
    pub acceleration: f64,    // change in velocity
    pub angle: f64,           // direction in degrees
    pub left_button: bool,
    pub right_button: bool,
}

/// Keyboard input sample
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardSample {
    pub timestamp: u64,
    pub key_code: i32,
    pub is_press: bool,       // true = key down, false = key up
    pub hold_duration: Option<u64>, // ms if this is a release
}

/// Aggregated behavior metrics for a session
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BehaviorMetrics {
    // Mouse metrics
    pub avg_mouse_velocity: f64,
    pub max_mouse_velocity: f64,
    pub velocity_std_dev: f64,          // Consistency measure
    pub avg_acceleration: f64,
    pub max_acceleration: f64,          // Sudden snaps detection
    pub direction_changes: u32,         // Erratic movement detection
    pub micro_corrections: u32,         // Small adjustments (human trait)
    pub straight_line_ratio: f64,       // % of movements in straight lines (bot trait)
    pub click_accuracy_zone: f64,       // How often clicks happen at consistent positions
    
    // Reaction time metrics
    pub avg_reaction_time: f64,         // ms between stimulus and action
    pub min_reaction_time: f64,         // Inhuman if < 100ms consistently
    pub reaction_time_std_dev: f64,     // Consistency (bots are too consistent)
    
    // Keyboard metrics
    pub avg_key_hold_duration: f64,
    pub keys_per_minute: f64,
    pub key_pattern_consistency: f64,   // How repetitive are key sequences
    
    // Anomaly scores (0-100)
    pub aim_snap_score: u32,            // High = suspicious sudden aim changes
    pub consistency_score: u32,         // High = too consistent (inhuman)
    pub reaction_score: u32,            // High = reaction times too fast
    pub overall_anomaly_score: u32,     // Combined score
    
    // Session info
    pub sample_count: u32,
    pub session_duration_ms: u64,
    pub collected_at: u64,
}

/// Tracks behavior over time
pub struct BehaviorTracker {
    mouse_samples: VecDeque<MouseSample>,
    keyboard_samples: VecDeque<KeyboardSample>,
    last_mouse_pos: Option<(i32, i32)>,
    last_mouse_time: u64,
    last_velocity: f64,
    session_start: u64,
    is_tracking: bool,
    // For reaction time tracking
    last_visual_event: Option<u64>,     // Timestamp of last detected visual change
    reaction_times: Vec<f64>,
    // Key hold tracking
    key_press_times: std::collections::HashMap<i32, u64>,
}

impl BehaviorTracker {
    pub fn new() -> Self {
        Self {
            mouse_samples: VecDeque::with_capacity(MAX_SAMPLES),
            keyboard_samples: VecDeque::with_capacity(MAX_SAMPLES),
            last_mouse_pos: None,
            last_mouse_time: 0,
            last_velocity: 0.0,
            session_start: 0,
            is_tracking: false,
            last_visual_event: None,
            reaction_times: Vec::new(),
            key_press_times: std::collections::HashMap::new(),
        }
    }

    pub fn start_tracking(&mut self) {
        self.mouse_samples.clear();
        self.keyboard_samples.clear();
        self.last_mouse_pos = None;
        self.last_velocity = 0.0;
        self.reaction_times.clear();
        self.key_press_times.clear();
        self.session_start = current_timestamp();
        self.is_tracking = true;
        println!("[Behavioral] Started tracking session");
    }

    pub fn stop_tracking(&mut self) {
        self.is_tracking = false;
        println!("[Behavioral] Stopped tracking session");
    }

    pub fn is_tracking(&self) -> bool {
        self.is_tracking
    }

    #[cfg(target_os = "windows")]
    pub fn sample_mouse(&mut self) {
        if !self.is_tracking {
            return;
        }

        let now = current_timestamp();
        
        unsafe {
            let mut point = POINT { x: 0, y: 0 };
            if GetCursorPos(&mut point).is_ok() {
                let x = point.x;
                let y = point.y;
                
                let (delta_x, delta_y, velocity, acceleration, angle) = 
                    if let Some((last_x, last_y)) = self.last_mouse_pos {
                        let dx = x - last_x;
                        let dy = y - last_y;
                        let dt = (now - self.last_mouse_time) as f64;
                        
                        if dt > 0.0 {
                            let distance = ((dx * dx + dy * dy) as f64).sqrt();
                            let vel = distance / dt;
                            let acc = (vel - self.last_velocity).abs();
                            let ang = (dy as f64).atan2(dx as f64).to_degrees();
                            
                            self.last_velocity = vel;
                            (dx, dy, vel, acc, ang)
                        } else {
                            (dx, dy, 0.0, 0.0, 0.0)
                        }
                    } else {
                        (0, 0, 0.0, 0.0, 0.0)
                    };
                
                // Check mouse buttons
                let left_button = GetAsyncKeyState(0x01) < 0;  // VK_LBUTTON
                let right_button = GetAsyncKeyState(0x02) < 0; // VK_RBUTTON
                
                let sample = MouseSample {
                    x,
                    y,
                    timestamp: now,
                    delta_x,
                    delta_y,
                    velocity,
                    acceleration,
                    angle,
                    left_button,
                    right_button,
                };
                
                if self.mouse_samples.len() >= MAX_SAMPLES {
                    self.mouse_samples.pop_front();
                }
                self.mouse_samples.push_back(sample);
                
                self.last_mouse_pos = Some((x, y));
                self.last_mouse_time = now;
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    pub fn sample_mouse(&mut self) {
        // No-op on non-Windows
    }

    #[cfg(target_os = "windows")]
    pub fn sample_keyboard(&mut self) {
        if !self.is_tracking {
            return;
        }

        let now = current_timestamp();
        
        // Track common gaming keys
        let keys_to_track = [
            (0x57, "W"), (0x41, "A"), (0x53, "S"), (0x44, "D"),  // WASD
            (0x10, "Shift"), (0x11, "Ctrl"), (0x20, "Space"),    // Modifiers
            (0x01, "LMB"), (0x02, "RMB"),                         // Mouse buttons as "keys"
            (0x52, "R"), (0x45, "E"), (0x46, "F"), (0x47, "G"),  // Common actions
            (0x31, "1"), (0x32, "2"), (0x33, "3"), (0x34, "4"),  // Number keys
        ];
        
        unsafe {
            for (key_code, _name) in keys_to_track.iter() {
                let is_pressed = GetAsyncKeyState(*key_code) < 0;
                let was_pressed = self.key_press_times.contains_key(key_code);
                
                if is_pressed && !was_pressed {
                    // Key just pressed
                    self.key_press_times.insert(*key_code, now);
                    
                    let sample = KeyboardSample {
                        timestamp: now,
                        key_code: *key_code,
                        is_press: true,
                        hold_duration: None,
                    };
                    
                    if self.keyboard_samples.len() >= MAX_SAMPLES {
                        self.keyboard_samples.pop_front();
                    }
                    self.keyboard_samples.push_back(sample);
                    
                } else if !is_pressed && was_pressed {
                    // Key just released
                    if let Some(press_time) = self.key_press_times.remove(key_code) {
                        let hold_duration = now.saturating_sub(press_time);
                        
                        let sample = KeyboardSample {
                            timestamp: now,
                            key_code: *key_code,
                            is_press: false,
                            hold_duration: Some(hold_duration),
                        };
                        
                        if self.keyboard_samples.len() >= MAX_SAMPLES {
                            self.keyboard_samples.pop_front();
                        }
                        self.keyboard_samples.push_back(sample);
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    pub fn sample_keyboard(&mut self) {
        // No-op on non-Windows
    }

    /// Calculate behavior metrics from collected samples
    pub fn calculate_metrics(&self) -> BehaviorMetrics {
        let mut metrics = BehaviorMetrics::default();
        
        if self.mouse_samples.len() < MIN_SAMPLES_FOR_METRICS {
            return metrics;
        }
        
        let now = current_timestamp();
        metrics.sample_count = self.mouse_samples.len() as u32;
        metrics.session_duration_ms = now.saturating_sub(self.session_start);
        metrics.collected_at = now;
        
        // Mouse velocity analysis
        let velocities: Vec<f64> = self.mouse_samples.iter()
            .map(|s| s.velocity)
            .filter(|&v| v > 0.0)
            .collect();
        
        if !velocities.is_empty() {
            metrics.avg_mouse_velocity = velocities.iter().sum::<f64>() / velocities.len() as f64;
            metrics.max_mouse_velocity = velocities.iter().cloned().fold(0.0, f64::max);
            
            // Standard deviation
            let variance = velocities.iter()
                .map(|v| (v - metrics.avg_mouse_velocity).powi(2))
                .sum::<f64>() / velocities.len() as f64;
            metrics.velocity_std_dev = variance.sqrt();
        }
        
        // Acceleration analysis (for aim snap detection)
        let accelerations: Vec<f64> = self.mouse_samples.iter()
            .map(|s| s.acceleration)
            .filter(|&a| a > 0.0)
            .collect();
        
        if !accelerations.is_empty() {
            metrics.avg_acceleration = accelerations.iter().sum::<f64>() / accelerations.len() as f64;
            metrics.max_acceleration = accelerations.iter().cloned().fold(0.0, f64::max);
        }
        
        // Direction change analysis
        let mut direction_changes = 0u32;
        let mut micro_corrections = 0u32;
        let mut last_angle: Option<f64> = None;
        
        for sample in self.mouse_samples.iter() {
            if let Some(last) = last_angle {
                let angle_diff = (sample.angle - last).abs();
                if angle_diff > 30.0 && angle_diff < 330.0 {
                    direction_changes += 1;
                }
                // Micro corrections: small movements (< 5 pixels) with direction change
                let movement = ((sample.delta_x.pow(2) + sample.delta_y.pow(2)) as f64).sqrt();
                if movement < 5.0 && angle_diff > 10.0 {
                    micro_corrections += 1;
                }
            }
            last_angle = Some(sample.angle);
        }
        metrics.direction_changes = direction_changes;
        metrics.micro_corrections = micro_corrections;
        
        // Straight line ratio (bots tend to move in perfect straight lines)
        let samples_vec: Vec<_> = self.mouse_samples.iter().collect();
        let straight_samples = samples_vec.windows(3)
            .filter(|w| {
                let angle_diff1 = (w[1].angle - w[0].angle).abs();
                let angle_diff2 = (w[2].angle - w[1].angle).abs();
                angle_diff1 < 5.0 && angle_diff2 < 5.0
            })
            .count();
        metrics.straight_line_ratio = straight_samples as f64 / self.mouse_samples.len() as f64 * 100.0;
        
        // Keyboard metrics
        let key_holds: Vec<u64> = self.keyboard_samples.iter()
            .filter_map(|s| s.hold_duration)
            .collect();
        
        if !key_holds.is_empty() {
            metrics.avg_key_hold_duration = key_holds.iter().sum::<u64>() as f64 / key_holds.len() as f64;
        }
        
        let key_presses = self.keyboard_samples.iter().filter(|s| s.is_press).count();
        let duration_mins = metrics.session_duration_ms as f64 / 60000.0;
        if duration_mins > 0.0 {
            metrics.keys_per_minute = key_presses as f64 / duration_mins;
        }
        
        // Reaction time metrics
        if !self.reaction_times.is_empty() {
            metrics.avg_reaction_time = self.reaction_times.iter().sum::<f64>() / self.reaction_times.len() as f64;
            metrics.min_reaction_time = self.reaction_times.iter().cloned().fold(f64::MAX, f64::min);
            
            let variance = self.reaction_times.iter()
                .map(|t| (t - metrics.avg_reaction_time).powi(2))
                .sum::<f64>() / self.reaction_times.len() as f64;
            metrics.reaction_time_std_dev = variance.sqrt();
        }
        
        // Calculate anomaly scores
        metrics.aim_snap_score = calculate_aim_snap_score(&metrics);
        metrics.consistency_score = calculate_consistency_score(&metrics);
        metrics.reaction_score = calculate_reaction_score(&metrics);
        metrics.overall_anomaly_score = (metrics.aim_snap_score + metrics.consistency_score + metrics.reaction_score) / 3;
        
        metrics
    }
    
    /// Get raw samples for detailed analysis (server-side)
    pub fn get_raw_data(&self) -> BehaviorRawData {
        BehaviorRawData {
            mouse_samples: self.mouse_samples.iter().cloned().collect(),
            keyboard_samples: self.keyboard_samples.iter().cloned().collect(),
            session_start: self.session_start,
            session_end: current_timestamp(),
        }
    }
    
    /// Clear samples (after sending to server)
    pub fn clear_samples(&mut self) {
        self.mouse_samples.clear();
        self.keyboard_samples.clear();
        self.reaction_times.clear();
    }
}

/// Raw behavior data for server analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BehaviorRawData {
    pub mouse_samples: Vec<MouseSample>,
    pub keyboard_samples: Vec<KeyboardSample>,
    pub session_start: u64,
    pub session_end: u64,
}

/// Behavior analysis result from server
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BehaviorAnalysisResult {
    pub is_anomalous: bool,
    pub anomaly_score: u32,
    pub risk_level: String,
    pub flags: Vec<BehaviorFlag>,
    pub baseline_deviation: f64,
    pub analyzed_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BehaviorFlag {
    pub flag_type: String,
    pub description: String,
    pub severity: String,
    pub value: f64,
    pub threshold: f64,
}

// === Anomaly Score Calculations ===

fn calculate_aim_snap_score(metrics: &BehaviorMetrics) -> u32 {
    let mut score = 0u32;
    
    // High max acceleration = sudden aim snaps
    if metrics.max_acceleration > 50.0 {
        score += 20;
    }
    if metrics.max_acceleration > 100.0 {
        score += 30;
    }
    
    // Too many high-velocity movements
    if metrics.max_mouse_velocity > 10.0 {
        score += 15;
    }
    
    // High straight line ratio (bots move in straight lines)
    if metrics.straight_line_ratio > 40.0 {
        score += 20;
    }
    if metrics.straight_line_ratio > 60.0 {
        score += 15;
    }
    
    score.min(100)
}

fn calculate_consistency_score(metrics: &BehaviorMetrics) -> u32 {
    let mut score = 0u32;
    
    // Very low velocity std dev = too consistent (bot-like)
    if metrics.velocity_std_dev < 0.5 && metrics.avg_mouse_velocity > 1.0 {
        score += 30;
    }
    
    // Very low reaction time std dev = inhuman consistency
    if metrics.reaction_time_std_dev < 20.0 && metrics.avg_reaction_time > 0.0 {
        score += 30;
    }
    
    // Lack of micro corrections (humans naturally make small adjustments)
    let micro_ratio = metrics.micro_corrections as f64 / metrics.sample_count as f64;
    if micro_ratio < 0.01 && metrics.sample_count > 100 {
        score += 25;
    }
    
    score.min(100)
}

fn calculate_reaction_score(metrics: &BehaviorMetrics) -> u32 {
    let mut score = 0u32;
    
    // Average reaction time below human limits (~150ms for pros, ~100ms absolute minimum)
    if metrics.min_reaction_time > 0.0 && metrics.min_reaction_time < 80.0 {
        score += 50;
    } else if metrics.min_reaction_time > 0.0 && metrics.min_reaction_time < 100.0 {
        score += 30;
    }
    
    if metrics.avg_reaction_time > 0.0 && metrics.avg_reaction_time < 120.0 {
        score += 30;
    }
    
    score.min(100)
}

// === Public API ===

/// Start behavior tracking (call when game starts or match begins)
pub fn start_tracking() {
    if let Ok(mut tracker) = BEHAVIOR_TRACKER.lock() {
        tracker.start_tracking();
    }
}

/// Stop behavior tracking (call when game/match ends)
pub fn stop_tracking() {
    if let Ok(mut tracker) = BEHAVIOR_TRACKER.lock() {
        tracker.stop_tracking();
    }
}

/// Check if tracking is active
pub fn is_tracking() -> bool {
    BEHAVIOR_TRACKER.lock().map(|t| t.is_tracking()).unwrap_or(false)
}

/// Sample current input state (call periodically, e.g., every 16ms = 60Hz)
pub fn sample_inputs() {
    if let Ok(mut tracker) = BEHAVIOR_TRACKER.lock() {
        tracker.sample_mouse();
        tracker.sample_keyboard();
    }
}

/// Get calculated metrics
pub fn get_metrics() -> BehaviorMetrics {
    BEHAVIOR_TRACKER.lock()
        .map(|t| t.calculate_metrics())
        .unwrap_or_default()
}

/// Get raw data for server analysis
pub fn get_raw_data() -> Option<BehaviorRawData> {
    BEHAVIOR_TRACKER.lock()
        .ok()
        .map(|t| t.get_raw_data())
}

/// Clear collected data (call after sending to server)
pub fn clear_data() {
    if let Ok(mut tracker) = BEHAVIOR_TRACKER.lock() {
        tracker.clear_samples();
    }
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
