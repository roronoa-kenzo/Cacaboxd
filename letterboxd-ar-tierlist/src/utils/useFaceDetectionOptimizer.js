import { useRef, useCallback, useMemo } from 'react';

/**
 * Hook personnalisé pour optimiser les performances de la reconnaissance faciale
 * Gère le throttling, la mise en cache et l'optimisation mémoire
 */
export const useFaceDetectionOptimizer = ({
  targetFPS = 15,
  maxCacheSize = 50,
  smoothingFactor = 0.2
}) => {
  const frameTimeTarget = 1000 / targetFPS;
  const lastFrameTime = useRef(0);
  const smoothedValues = useRef({});
  const imageCache = useRef(new Map());
  const performanceMetrics = useRef({
    averageFrameTime: 0,
    frameCount: 0,
    lastOptimization: Date.now()
  });

  // Throttling intelligent des frames
  const shouldProcessFrame = useCallback(() => {
    const now = performance.now();
    const timeSinceLastFrame = now - lastFrameTime.current;
    
    if (timeSinceLastFrame >= frameTimeTarget) {
      lastFrameTime.current = now;
      return true;
    }
    return false;
  }, [frameTimeTarget]);

  // Lissage des valeurs pour réduire le bruit
  const smoothValue = useCallback((key, newValue) => {
    if (!smoothedValues.current[key]) {
      smoothedValues.current[key] = newValue;
      return newValue;
    }
    
    const currentValue = smoothedValues.current[key];
    const smoothed = currentValue + (newValue - currentValue) * smoothingFactor;
    smoothedValues.current[key] = smoothed;
    
    return smoothed;
  }, [smoothingFactor]);

  // Cache intelligent pour les images
  const cacheImage = useCallback((url, image) => {
    if (imageCache.current.size >= maxCacheSize) {
      // Suppression du plus ancien élément (LRU simple)
      const firstKey = imageCache.current.keys().next().value;
      imageCache.current.delete(firstKey);
    }
    imageCache.current.set(url, {
      image,
      lastUsed: Date.now(),
      usage: 0
    });
  }, [maxCacheSize]);

  const getCachedImage = useCallback((url) => {
    const cached = imageCache.current.get(url);
    if (cached) {
      cached.lastUsed = Date.now();
      cached.usage++;
      return cached.image;
    }
    return null;
  }, []);

  // Optimisation adaptative basée sur les performances
  const adaptiveOptimization = useCallback((frameTime) => {
    const metrics = performanceMetrics.current;
    metrics.frameCount++;
    metrics.averageFrameTime = (metrics.averageFrameTime * (metrics.frameCount - 1) + frameTime) / metrics.frameCount;
    
    // Optimisation toutes les 5 secondes
    const now = Date.now();
    if (now - metrics.lastOptimization > 5000) {
      metrics.lastOptimization = now;
      
      // Si les performances sont mauvaises, retourner des recommandations
      if (metrics.averageFrameTime > frameTimeTarget * 1.5) {
        return {
          shouldReduceQuality: true,
          recommendedInputSize: 320,
          recommendedFPS: Math.max(10, targetFPS - 5),
          reason: 'Performance insuffisante détectée'
        };
      }
      
      // Si les performances sont excellentes, on peut augmenter la qualité
      if (metrics.averageFrameTime < frameTimeTarget * 0.7) {
        return {
          shouldIncreaseQuality: true,
          recommendedInputSize: 512,
          recommendedFPS: Math.min(30, targetFPS + 5),
          reason: 'Performances excellentes, augmentation possible'
        };
      }
    }
    
    return { optimal: true };
  }, [frameTimeTarget, targetFPS]);

  // Nettoyage de mémoire
  const cleanup = useCallback(() => {
    imageCache.current.clear();
    smoothedValues.current = {};
    performanceMetrics.current = {
      averageFrameTime: 0,
      frameCount: 0,
      lastOptimization: Date.now()
    };
  }, []);

  // Statistiques de performance
  const getPerformanceStats = useCallback(() => {
    const metrics = performanceMetrics.current;
    return {
      averageFrameTime: Math.round(metrics.averageFrameTime * 100) / 100,
      currentFPS: Math.round(1000 / Math.max(metrics.averageFrameTime, 1)),
      cacheSize: imageCache.current.size,
      frameCount: metrics.frameCount,
      memoryEstimate: `${Math.round(imageCache.current.size * 0.5)}MB` // Estimation approximative
    };
  }, []);

  // Optimisations spécifiques aux caméras externes
  const getCameraOptimizations = useCallback((cameraLabel) => {
    const optimizations = {
      // Optimisations par défaut
      default: {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        frameRate: { ideal: 15, min: 10 }
      },
      
      // Caméras Logitech (généralement performantes)
      logitech: {
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        frameRate: { ideal: 30, min: 15 }
      },
      
      // Caméras Microsoft
      microsoft: {
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        frameRate: { ideal: 30, min: 15 }
      },
      
      // Caméras intégrées (plus conservateur)
      integrated: {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        frameRate: { ideal: 15, min: 10 }
      }
    };

    // Détection du type de caméra
    if (/logitech|c920|c930|brio/i.test(cameraLabel)) {
      return optimizations.logitech;
    }
    if (/microsoft|lifecam/i.test(cameraLabel)) {
      return optimizations.microsoft;
    }
    if (/integrated|built-in|facetime/i.test(cameraLabel)) {
      return optimizations.integrated;
    }
    
    return optimizations.default;
  }, []);

  // Worker pour le preprocessing d'images (si disponible)
  const preprocessWorker = useMemo(() => {
    if (typeof Worker !== 'undefined') {
      const workerCode = `
        self.onmessage = function(e) {
          const { imageData, operation } = e.data;
          
          try {
            let result = imageData;
            
            switch(operation) {
              case 'resize':
                // Code de redimensionnement optimisé
                result = resizeImageData(imageData, e.data.targetWidth, e.data.targetHeight);
                break;
              case 'enhance':
                // Amélioration du contraste pour la détection
                result = enhanceContrast(imageData);
                break;
            }
            
            self.postMessage({ success: true, result });
          } catch (error) {
            self.postMessage({ success: false, error: error.message });
          }
        };
        
        function resizeImageData(imageData, targetWidth, targetHeight) {
          // Implémentation simple de redimensionnement
          return imageData; // Placeholder
        }
        
        function enhanceContrast(imageData) {
          const data = new Uint8ClampedArray(imageData.data);
          for (let i = 0; i < data.length; i += 4) {
            // Amélioration simple du contraste
            data[i] = Math.min(255, data[i] * 1.2);     // R
            data[i + 1] = Math.min(255, data[i + 1] * 1.2); // G
            data[i + 2] = Math.min(255, data[i + 2] * 1.2); // B
          }
          return new ImageData(data, imageData.width, imageData.height);
        }
      `;
      
      try {
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        return new Worker(URL.createObjectURL(blob));
      } catch (error) {
        console.warn('Web Workers non disponibles:', error);
        return null;
      }
    }
    return null;
  }, []);

  return {
    shouldProcessFrame,
    smoothValue,
    cacheImage,
    getCachedImage,
    adaptiveOptimization,
    cleanup,
    getPerformanceStats,
    getCameraOptimizations,
    preprocessWorker
  };
};

export default useFaceDetectionOptimizer; 