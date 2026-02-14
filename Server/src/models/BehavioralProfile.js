import mongoose from 'mongoose';

/**
 * Behavioral Profile Model
 * 
 * Stores player behavioral data collected during gameplay sessions.
 * Used for anomaly detection and cheat identification through pattern analysis.
 */

const behavioralSessionSchema = new mongoose.Schema({
  // Session info
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    default: null
  },
  matchType: {
    type: String,
    enum: ['ranked', 'stricker', 'ladder', 'casual', null],
    default: null
  },
  sessionStart: {
    type: Date,
    required: true
  },
  sessionEnd: {
    type: Date,
    required: true
  },
  sessionDurationMs: {
    type: Number,
    required: true
  },
  
  // Mouse metrics
  avgMouseVelocity: { type: Number, default: 0 },
  maxMouseVelocity: { type: Number, default: 0 },
  velocityStdDev: { type: Number, default: 0 },
  avgAcceleration: { type: Number, default: 0 },
  maxAcceleration: { type: Number, default: 0 },
  directionChanges: { type: Number, default: 0 },
  microCorrections: { type: Number, default: 0 },
  straightLineRatio: { type: Number, default: 0 },
  clickAccuracyZone: { type: Number, default: 0 },
  
  // Reaction time metrics
  avgReactionTime: { type: Number, default: 0 },
  minReactionTime: { type: Number, default: 0 },
  reactionTimeStdDev: { type: Number, default: 0 },
  
  // Keyboard metrics
  avgKeyHoldDuration: { type: Number, default: 0 },
  keysPerMinute: { type: Number, default: 0 },
  keyPatternConsistency: { type: Number, default: 0 },
  
  // Anomaly scores (0-100)
  aimSnapScore: { type: Number, default: 0 },
  consistencyScore: { type: Number, default: 0 },
  reactionScore: { type: Number, default: 0 },
  overallAnomalyScore: { type: Number, default: 0 },
  
  // Sample info
  sampleCount: { type: Number, default: 0 },
  
  // Analysis results
  analysisResult: {
    isAnomalous: { type: Boolean, default: false },
    riskLevel: { 
      type: String, 
      enum: ['none', 'low', 'medium', 'high', 'critical'],
      default: 'none'
    },
    baselineDeviation: { type: Number, default: 0 }, // % deviation from baseline
    flags: [{
      flagType: String,
      description: String,
      severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
      value: Number,
      threshold: Number
    }]
  }
}, { _id: false });

const behavioralProfileSchema = new mongoose.Schema({
  // User reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // Baseline profile (average of first N sessions to establish "normal" behavior)
  baseline: {
    established: { type: Boolean, default: false },
    establishedAt: { type: Date, default: null },
    sessionCount: { type: Number, default: 0 }, // Sessions used to build baseline
    
    // Averaged metrics that represent "normal" for this player
    avgMouseVelocity: { type: Number, default: 0 },
    avgMouseVelocityStdDev: { type: Number, default: 0 },
    avgAcceleration: { type: Number, default: 0 },
    avgReactionTime: { type: Number, default: 0 },
    avgReactionTimeStdDev: { type: Number, default: 0 },
    avgKeysPerMinute: { type: Number, default: 0 },
    avgMicroCorrections: { type: Number, default: 0 },
    avgStraightLineRatio: { type: Number, default: 0 },
    
    // Baseline confidence (higher = more reliable)
    confidence: { type: Number, default: 0 } // 0-100
  },
  
  // Historical sessions (last 50 for analysis)
  sessions: {
    type: [behavioralSessionSchema],
    default: [],
    validate: [arr => arr.length <= 50, 'Max 50 sessions stored']
  },
  
  // Anomaly history (flagged sessions)
  anomalyHistory: [{
    sessionIndex: Number,
    detectedAt: { type: Date, default: Date.now },
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
    anomalyScore: Number,
    riskLevel: String,
    flags: [{
      flagType: String,
      description: String,
      severity: String
    }],
    reviewed: { type: Boolean, default: false },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewNotes: String,
    falsePositive: { type: Boolean, default: false }
  }],
  
  // Stats
  totalSessionsRecorded: { type: Number, default: 0 },
  totalAnomaliesDetected: { type: Number, default: 0 },
  lastSessionAt: { type: Date, default: null },
  lastAnomalyAt: { type: Date, default: null },
  
  // Trust score (builds over time with clean sessions)
  trustScore: {
    score: { type: Number, default: 50 }, // 0-100, starts at 50
    cleanSessions: { type: Number, default: 0 },
    flaggedSessions: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  }
}, {
  timestamps: true
});

// Methods

/**
 * Add a new behavioral session and analyze it
 */
behavioralProfileSchema.methods.addSession = async function(sessionData) {
  // Analyze against baseline if established
  const analysisResult = this.analyzeSession(sessionData);
  
  const session = {
    ...sessionData,
    analysisResult
  };
  
  // Add to sessions array (keep last 50)
  this.sessions.push(session);
  if (this.sessions.length > 50) {
    this.sessions.shift();
  }
  
  this.totalSessionsRecorded++;
  this.lastSessionAt = new Date();
  
  // Update baseline if not yet established (need 10+ clean sessions)
  if (!this.baseline.established && this.sessions.length >= 10) {
    this.calculateBaseline();
  }
  
  // Record anomaly if detected
  if (analysisResult.isAnomalous) {
    this.totalAnomaliesDetected++;
    this.lastAnomalyAt = new Date();
    this.anomalyHistory.push({
      sessionIndex: this.sessions.length - 1,
      detectedAt: new Date(),
      matchId: sessionData.matchId,
      anomalyScore: sessionData.overallAnomalyScore,
      riskLevel: analysisResult.riskLevel,
      flags: analysisResult.flags
    });
    
    // Keep only last 100 anomalies
    if (this.anomalyHistory.length > 100) {
      this.anomalyHistory.shift();
    }
    
    // Decrease trust score
    this.trustScore.flaggedSessions++;
    this.trustScore.score = Math.max(0, this.trustScore.score - 5);
  } else {
    // Increase trust score for clean session
    this.trustScore.cleanSessions++;
    this.trustScore.score = Math.min(100, this.trustScore.score + 1);
  }
  
  this.trustScore.lastUpdated = new Date();
  
  return analysisResult;
};

/**
 * Analyze a session against baseline
 */
behavioralProfileSchema.methods.analyzeSession = function(sessionData) {
  const result = {
    isAnomalous: false,
    riskLevel: 'none',
    baselineDeviation: 0,
    flags: []
  };
  
  // If no baseline, just check absolute thresholds
  if (!this.baseline.established) {
    return this.analyzeAbsoluteThresholds(sessionData);
  }
  
  const baseline = this.baseline;
  let totalDeviation = 0;
  let deviationCount = 0;
  
  // Check mouse velocity deviation
  if (baseline.avgMouseVelocity > 0) {
    const velocityDev = Math.abs(sessionData.avgMouseVelocity - baseline.avgMouseVelocity) / baseline.avgMouseVelocity * 100;
    if (velocityDev > 100) { // 100% deviation
      result.flags.push({
        flagType: 'velocity_deviation',
        description: `Vitesse souris ${velocityDev.toFixed(0)}% différente de la baseline`,
        severity: velocityDev > 200 ? 'high' : 'medium',
        value: sessionData.avgMouseVelocity,
        threshold: baseline.avgMouseVelocity
      });
    }
    totalDeviation += velocityDev;
    deviationCount++;
  }
  
  // Check acceleration (aim snaps)
  if (baseline.avgAcceleration > 0) {
    const accelDev = Math.abs(sessionData.avgAcceleration - baseline.avgAcceleration) / baseline.avgAcceleration * 100;
    if (accelDev > 150) {
      result.flags.push({
        flagType: 'acceleration_spike',
        description: `Accélération ${accelDev.toFixed(0)}% plus élevée (aim snaps potentiels)`,
        severity: accelDev > 300 ? 'critical' : 'high',
        value: sessionData.avgAcceleration,
        threshold: baseline.avgAcceleration
      });
    }
    totalDeviation += accelDev;
    deviationCount++;
  }
  
  // Check reaction time
  if (baseline.avgReactionTime > 0 && sessionData.avgReactionTime > 0) {
    const reactionDiff = baseline.avgReactionTime - sessionData.avgReactionTime;
    if (reactionDiff > 50) { // 50ms faster than usual
      result.flags.push({
        flagType: 'reaction_time',
        description: `Temps de réaction ${reactionDiff.toFixed(0)}ms plus rapide que d'habitude`,
        severity: reactionDiff > 100 ? 'critical' : 'high',
        value: sessionData.avgReactionTime,
        threshold: baseline.avgReactionTime
      });
    }
    const reactionDev = Math.abs(reactionDiff) / baseline.avgReactionTime * 100;
    totalDeviation += reactionDev;
    deviationCount++;
  }
  
  // Check straight line ratio (bots move in straight lines)
  if (sessionData.straightLineRatio > 50) {
    result.flags.push({
      flagType: 'straight_lines',
      description: `${sessionData.straightLineRatio.toFixed(0)}% des mouvements en ligne droite (bot potentiel)`,
      severity: sessionData.straightLineRatio > 70 ? 'critical' : 'high',
      value: sessionData.straightLineRatio,
      threshold: 30
    });
  }
  
  // Check micro corrections (humans make small adjustments)
  const expectedMicro = baseline.avgMicroCorrections || 50;
  if (sessionData.microCorrections < expectedMicro * 0.3) {
    result.flags.push({
      flagType: 'lack_corrections',
      description: `Manque de micro-corrections (comportement non-humain)`,
      severity: 'medium',
      value: sessionData.microCorrections,
      threshold: expectedMicro
    });
  }
  
  // Calculate overall deviation
  if (deviationCount > 0) {
    result.baselineDeviation = totalDeviation / deviationCount;
  }
  
  // Determine risk level
  if (result.flags.some(f => f.severity === 'critical')) {
    result.riskLevel = 'critical';
    result.isAnomalous = true;
  } else if (result.flags.some(f => f.severity === 'high')) {
    result.riskLevel = 'high';
    result.isAnomalous = true;
  } else if (result.flags.length >= 2) {
    result.riskLevel = 'medium';
    result.isAnomalous = true;
  } else if (result.flags.length === 1) {
    result.riskLevel = 'low';
  }
  
  // Also check anomaly scores from client
  if (sessionData.overallAnomalyScore >= 70) {
    result.isAnomalous = true;
    result.riskLevel = sessionData.overallAnomalyScore >= 85 ? 'critical' : 'high';
  }
  
  return result;
};

/**
 * Analyze with absolute thresholds (no baseline yet)
 */
behavioralProfileSchema.methods.analyzeAbsoluteThresholds = function(sessionData) {
  const result = {
    isAnomalous: false,
    riskLevel: 'none',
    baselineDeviation: 0,
    flags: []
  };
  
  // Inhuman reaction times
  if (sessionData.minReactionTime > 0 && sessionData.minReactionTime < 80) {
    result.flags.push({
      flagType: 'inhuman_reaction',
      description: `Temps de réaction minimum ${sessionData.minReactionTime}ms (< 80ms = inhumain)`,
      severity: 'critical',
      value: sessionData.minReactionTime,
      threshold: 80
    });
  }
  
  // Too consistent (bots are perfectly consistent)
  if (sessionData.velocityStdDev < 0.3 && sessionData.avgMouseVelocity > 2) {
    result.flags.push({
      flagType: 'too_consistent',
      description: `Mouvements trop réguliers (écart-type: ${sessionData.velocityStdDev.toFixed(2)})`,
      severity: 'high',
      value: sessionData.velocityStdDev,
      threshold: 0.5
    });
  }
  
  // Extreme straight line ratio
  if (sessionData.straightLineRatio > 60) {
    result.flags.push({
      flagType: 'straight_lines',
      description: `${sessionData.straightLineRatio.toFixed(0)}% mouvements en ligne droite`,
      severity: sessionData.straightLineRatio > 75 ? 'critical' : 'high',
      value: sessionData.straightLineRatio,
      threshold: 40
    });
  }
  
  // Determine risk level
  if (result.flags.some(f => f.severity === 'critical')) {
    result.riskLevel = 'critical';
    result.isAnomalous = true;
  } else if (result.flags.length >= 2) {
    result.riskLevel = 'high';
    result.isAnomalous = true;
  } else if (result.flags.length === 1) {
    result.riskLevel = 'medium';
    result.isAnomalous = sessionData.overallAnomalyScore >= 50;
  }
  
  return result;
};

/**
 * Calculate baseline from clean sessions
 */
behavioralProfileSchema.methods.calculateBaseline = function() {
  // Use only sessions with low anomaly scores
  const cleanSessions = this.sessions.filter(s => 
    s.overallAnomalyScore < 30 && s.sampleCount >= 100
  );
  
  if (cleanSessions.length < 5) {
    return; // Not enough clean data
  }
  
  const count = cleanSessions.length;
  
  this.baseline = {
    established: true,
    establishedAt: new Date(),
    sessionCount: count,
    avgMouseVelocity: cleanSessions.reduce((sum, s) => sum + s.avgMouseVelocity, 0) / count,
    avgMouseVelocityStdDev: cleanSessions.reduce((sum, s) => sum + s.velocityStdDev, 0) / count,
    avgAcceleration: cleanSessions.reduce((sum, s) => sum + s.avgAcceleration, 0) / count,
    avgReactionTime: cleanSessions.reduce((sum, s) => sum + s.avgReactionTime, 0) / count,
    avgReactionTimeStdDev: cleanSessions.reduce((sum, s) => sum + s.reactionTimeStdDev, 0) / count,
    avgKeysPerMinute: cleanSessions.reduce((sum, s) => sum + s.keysPerMinute, 0) / count,
    avgMicroCorrections: cleanSessions.reduce((sum, s) => sum + s.microCorrections, 0) / count,
    avgStraightLineRatio: cleanSessions.reduce((sum, s) => sum + s.straightLineRatio, 0) / count,
    confidence: Math.min(100, count * 10) // 10 sessions = 100% confidence
  };
  
  console.log(`[Behavioral] Baseline established for user with ${count} sessions`);
};

// Indexes
behavioralProfileSchema.index({ 'trustScore.score': -1 });
behavioralProfileSchema.index({ lastAnomalyAt: -1 });
behavioralProfileSchema.index({ totalAnomaliesDetected: -1 });

const BehavioralProfile = mongoose.model('BehavioralProfile', behavioralProfileSchema);

export default BehavioralProfile;
