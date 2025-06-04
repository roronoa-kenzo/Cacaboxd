/**
 * Benchmark de Performance - Reconnaissance Faciale
 * Script pour mesurer et comparer les performances des différentes configurations
 */

class FaceDetectionBenchmark {
  constructor() {
    this.results = {
      sessions: [],
      summary: {
        averageFPS: 0,
        averageConfidence: 0,
        totalFrames: 0,
        errorRate: 0
      }
    };
    this.isRunning = false;
    this.startTime = null;
    this.frameCount = 0;
    this.confidenceSum = 0;
    this.errorCount = 0;
  }

  /**
   * Démarre une session de benchmark
   * @param {Object} config - Configuration à tester
   * @param {number} duration - Durée du test en millisecondes
   */
  async startBenchmark(config = {}, duration = 30000) {
    if (this.isRunning) {
      console.warn('Un benchmark est déjà en cours');
      return;
    }

    console.log('🚀 Démarrage du benchmark de reconnaissance faciale');
    console.log(`📊 Configuration testée:`, config);
    console.log(`⏱️ Durée: ${duration / 1000}s`);

    this.isRunning = true;
    this.startTime = performance.now();
    this.frameCount = 0;
    this.confidenceSum = 0;
    this.errorCount = 0;

    const session = {
      config: { ...config },
      startTime: new Date().toISOString(),
      duration: duration,
      metrics: {
        fps: [],
        confidence: [],
        errors: [],
        memoryUsage: [],
        cpuUsage: []
      }
    };

    // Monitoring des performances toutes les 100ms
    const monitoringInterval = setInterval(() => {
      this.recordMetrics(session);
    }, 100);

    // Arrêt automatique après la durée spécifiée
    setTimeout(() => {
      this.stopBenchmark(session);
      clearInterval(monitoringInterval);
    }, duration);

    return session;
  }

  /**
   * Enregistre les métriques actuelles
   */
  recordMetrics(session) {
    const now = performance.now();
    const elapsed = now - this.startTime;
    
    // Calcul du FPS instantané
    const currentFPS = this.frameCount > 0 ? (this.frameCount / elapsed) * 1000 : 0;
    
    // Calcul de la confiance moyenne
    const avgConfidence = this.frameCount > 0 ? this.confidenceSum / this.frameCount : 0;

    session.metrics.fps.push({
      timestamp: elapsed,
      value: currentFPS
    });

    session.metrics.confidence.push({
      timestamp: elapsed,
      value: avgConfidence
    });

    // Monitoring mémoire (approximatif)
    if (performance.memory) {
      session.metrics.memoryUsage.push({
        timestamp: elapsed,
        value: performance.memory.usedJSHeapSize / 1024 / 1024 // MB
      });
    }

    // Log périodique
    if (Math.floor(elapsed / 1000) % 5 === 0) {
      console.log(`📊 ${Math.floor(elapsed / 1000)}s - FPS: ${currentFPS.toFixed(1)}, Confiance: ${(avgConfidence * 100).toFixed(1)}%`);
    }
  }

  /**
   * Enregistre une détection de visage
   */
  recordDetection(confidence) {
    if (!this.isRunning) return;
    
    this.frameCount++;
    this.confidenceSum += confidence;
  }

  /**
   * Enregistre une erreur
   */
  recordError(error) {
    if (!this.isRunning) return;
    
    this.errorCount++;
    console.warn('❌ Erreur détection:', error.message);
  }

  /**
   * Arrête le benchmark et calcule les résultats
   */
  stopBenchmark(session) {
    if (!this.isRunning) return;

    this.isRunning = false;
    const endTime = performance.now();
    const totalDuration = endTime - this.startTime;

    // Calculs finaux
    const finalMetrics = {
      totalFrames: this.frameCount,
      averageFPS: (this.frameCount / totalDuration) * 1000,
      averageConfidence: this.frameCount > 0 ? this.confidenceSum / this.frameCount : 0,
      errorRate: this.frameCount > 0 ? (this.errorCount / this.frameCount) * 100 : 0,
      totalDuration: totalDuration,
      memoryPeak: this.getMemoryPeak(session),
      stabilityScore: this.calculateStabilityScore(session)
    };

    session.endTime = new Date().toISOString();
    session.finalMetrics = finalMetrics;

    this.results.sessions.push(session);
    this.updateSummary();

    console.log('✅ Benchmark terminé');
    console.log('📊 Résultats:', finalMetrics);

    return session;
  }

  /**
   * Calcule le pic d'utilisation mémoire
   */
  getMemoryPeak(session) {
    if (!session.metrics.memoryUsage.length) return 0;
    return Math.max(...session.metrics.memoryUsage.map(m => m.value));
  }

  /**
   * Calcule un score de stabilité basé sur la variance du FPS
   */
  calculateStabilityScore(session) {
    const fpsValues = session.metrics.fps.map(f => f.value);
    if (fpsValues.length < 2) return 0;

    const mean = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
    const variance = fpsValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / fpsValues.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Score de stabilité: plus proche de 100 = plus stable
    return Math.max(0, 100 - (standardDeviation / mean) * 100);
  }

  /**
   * Met à jour le résumé global
   */
  updateSummary() {
    const sessions = this.results.sessions;
    if (sessions.length === 0) return;

    const totalFrames = sessions.reduce((sum, s) => sum + s.finalMetrics.totalFrames, 0);
    const avgFPS = sessions.reduce((sum, s) => sum + s.finalMetrics.averageFPS, 0) / sessions.length;
    const avgConfidence = sessions.reduce((sum, s) => sum + s.finalMetrics.averageConfidence, 0) / sessions.length;
    const avgErrorRate = sessions.reduce((sum, s) => sum + s.finalMetrics.errorRate, 0) / sessions.length;

    this.results.summary = {
      averageFPS: avgFPS,
      averageConfidence: avgConfidence,
      totalFrames: totalFrames,
      errorRate: avgErrorRate,
      sessionsCount: sessions.length
    };
  }

  /**
   * Compare deux configurations
   */
  compareConfigurations(configA, configB) {
    const sessionsA = this.results.sessions.filter(s => 
      JSON.stringify(s.config) === JSON.stringify(configA)
    );
    const sessionsB = this.results.sessions.filter(s => 
      JSON.stringify(s.config) === JSON.stringify(configB)
    );

    if (sessionsA.length === 0 || sessionsB.length === 0) {
      console.warn('Pas assez de données pour la comparaison');
      return null;
    }

    const getAverage = (sessions, metric) => {
      return sessions.reduce((sum, s) => sum + s.finalMetrics[metric], 0) / sessions.length;
    };

    const comparison = {
      configA: configA,
      configB: configB,
      fps: {
        A: getAverage(sessionsA, 'averageFPS'),
        B: getAverage(sessionsB, 'averageFPS'),
        improvement: 0
      },
      confidence: {
        A: getAverage(sessionsA, 'averageConfidence'),
        B: getAverage(sessionsB, 'averageConfidence'),
        improvement: 0
      },
      stability: {
        A: getAverage(sessionsA, 'stabilityScore'),
        B: getAverage(sessionsB, 'stabilityScore'),
        improvement: 0
      }
    };

    // Calcul des améliorations
    comparison.fps.improvement = ((comparison.fps.B - comparison.fps.A) / comparison.fps.A) * 100;
    comparison.confidence.improvement = ((comparison.confidence.B - comparison.confidence.A) / comparison.confidence.A) * 100;
    comparison.stability.improvement = ((comparison.stability.B - comparison.stability.A) / comparison.stability.A) * 100;

    return comparison;
  }

  /**
   * Génère un rapport détaillé
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      sessions: this.results.sessions.map(session => ({
        config: session.config,
        duration: session.duration,
        metrics: session.finalMetrics,
        startTime: session.startTime,
        endTime: session.endTime
      })),
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Génère des recommandations basées sur les résultats
   */
  generateRecommendations() {
    const recommendations = [];
    const { summary } = this.results;

    if (summary.averageFPS < 10) {
      recommendations.push({
        type: 'performance',
        message: 'FPS faible détecté. Réduisez la qualité de détection ou la résolution.',
        priority: 'high'
      });
    }

    if (summary.averageConfidence < 0.6) {
      recommendations.push({
        type: 'accuracy',
        message: 'Confiance de détection faible. Améliorez l\'éclairage ou la position de la caméra.',
        priority: 'medium'
      });
    }

    if (summary.errorRate > 5) {
      recommendations.push({
        type: 'stability',
        message: 'Taux d\'erreur élevé. Vérifiez la compatibilité de la caméra.',
        priority: 'high'
      });
    }

    return recommendations;
  }

  /**
   * Exporte les résultats au format JSON
   */
  exportResults(filename = null) {
    const report = this.generateReport();
    const jsonData = JSON.stringify(report, null, 2);
    
    if (filename) {
      // Navigateur
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    return jsonData;
  }

  /**
   * Réinitialise tous les résultats
   */
  reset() {
    this.results = {
      sessions: [],
      summary: {
        averageFPS: 0,
        averageConfidence: 0,
        totalFrames: 0,
        errorRate: 0
      }
    };
    this.isRunning = false;
  }
}

// Configurations de test prédéfinies
export const BENCHMARK_CONFIGS = {
  EXTERNAL_CAMERA_OPTIMAL: {
    inputSize: 512,
    scoreThreshold: 0.6,
    frameRate: 30,
    resolution: '1920x1080',
    quality: 'accurate'
  },
  
  EXTERNAL_CAMERA_BALANCED: {
    inputSize: 416,
    scoreThreshold: 0.5,
    frameRate: 15,
    resolution: '1280x720',
    quality: 'balanced'
  },
  
  INTEGRATED_CAMERA: {
    inputSize: 320,
    scoreThreshold: 0.4,
    frameRate: 10,
    resolution: '640x480',
    quality: 'fast'
  },

  MOBILE_OPTIMIZED: {
    inputSize: 320,
    scoreThreshold: 0.4,
    frameRate: 8,
    resolution: '480x640',
    quality: 'fast'
  }
};

// Instance globale pour utilisation dans l'application
export const benchmark = new FaceDetectionBenchmark();

export default FaceDetectionBenchmark; 