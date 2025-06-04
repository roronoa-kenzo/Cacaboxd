import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';

const OptimizedFaceDetection = ({ 
  onFaceDetected, 
  onHeadMovement, 
  isActive = true,
  detectionQuality = 'balanced' // 'fast', 'balanced', 'accurate'
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastDetectionTime = useRef(0);
  
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [cameraStatus, setCameraStatus] = useState('initializing');
  const [detectionStats, setDetectionStats] = useState({
    fps: 0,
    avgConfidence: 0,
    detectionCount: 0
  });

  // Configuration adaptative selon la qualité demandée
  const QUALITY_CONFIGS = {
    fast: {
      detectionInterval: 100, // 10 FPS
      inputSize: 320,
      scoreThreshold: 0.4,
      minFaceSize: 80
    },
    balanced: {
      detectionInterval: 66, // 15 FPS
      inputSize: 416,
      scoreThreshold: 0.5,
      minFaceSize: 100
    },
    accurate: {
      detectionInterval: 33, // 30 FPS
      inputSize: 512,
      scoreThreshold: 0.6,
      minFaceSize: 120
    }
  };

  const currentConfig = QUALITY_CONFIGS[detectionQuality];

  // Énumération et sélection intelligente des caméras
  const enumerateCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // Priorisation des caméras externes
      const prioritizedCameras = videoDevices.sort((a, b) => {
        const aIsExternal = /usb|external|logitech|microsoft|webcam|c920|c930|brio/i.test(a.label);
        const bIsExternal = /usb|external|logitech|microsoft|webcam|c920|c930|brio/i.test(b.label);
        
        if (aIsExternal && !bIsExternal) return -1;
        if (!aIsExternal && bIsExternal) return 1;
        return 0;
      });
      
      setAvailableCameras(prioritizedCameras);
      
      if (prioritizedCameras.length > 0) {
        setSelectedCamera(prioritizedCameras[0]);
        console.log(`🎥 Caméra sélectionnée: ${prioritizedCameras[0].label}`);
      }
    } catch (error) {
      console.error('Erreur énumération caméras:', error);
      setCameraStatus('error');
    }
  }, []);

  // Chargement optimisé des modèles IA
  const loadFaceModels = useCallback(async () => {
    try {
      console.log('🧠 Chargement des modèles d\'IA...');
      const MODEL_URL = '/models';
      
      // Chargement parallèle et optimisé
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
      ]);
      
      setIsModelLoaded(true);
      console.log('✅ Modèles IA chargés');
    } catch (error) {
      console.error('❌ Erreur chargement modèles:', error);
      setCameraStatus('model-error');
    }
  }, []);

  // Configuration optimale de la caméra
  const getOptimalCameraConstraints = useCallback((camera) => {
    const baseConstraints = {
      deviceId: camera?.deviceId,
      width: { ideal: 1920, min: 640 },
      height: { ideal: 1080, min: 480 },
      frameRate: { ideal: 30, min: 15 },
      facingMode: 'user'
    };

    // Optimisations spécifiques aux caméras externes
    if (camera?.label && /logitech|microsoft|webcam/i.test(camera.label)) {
      return {
        ...baseConstraints,
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        frameRate: { ideal: 60, min: 30 }
      };
    }

    return baseConstraints;
  }, []);

  // Initialisation de la caméra
  const initializeCamera = useCallback(async () => {
    if (!selectedCamera || !videoRef.current) return;

    try {
      setCameraStatus('connecting');
      
      const constraints = {
        video: getOptimalCameraConstraints(selectedCamera),
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      
      // Attendre que la vidéo soit prête
      await new Promise((resolve) => {
        videoRef.current.onloadedmetadata = resolve;
      });

      setCameraStatus('active');
      console.log(`✅ Caméra initialisée: ${stream.getVideoTracks()[0].getSettings().width}x${stream.getVideoTracks()[0].getSettings().height}`);
      
    } catch (error) {
      console.error('❌ Erreur initialisation caméra:', error);
      setCameraStatus('permission-denied');
    }
  }, [selectedCamera, getOptimalCameraConstraints]);

  // Détection faciale optimisée
  const detectFaces = useCallback(async () => {
    if (!isActive || !isModelLoaded || !videoRef.current || cameraStatus !== 'active') {
      animationFrameRef.current = requestAnimationFrame(detectFaces);
      return;
    }

    const now = performance.now();
    if (now - lastDetectionTime.current < currentConfig.detectionInterval) {
      animationFrameRef.current = requestAnimationFrame(detectFaces);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!canvas) {
      animationFrameRef.current = requestAnimationFrame(detectFaces);
      return;
    }

    try {
      // Options de détection optimisées
      const detectionOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: currentConfig.inputSize,
        scoreThreshold: currentConfig.scoreThreshold
      });

      const detections = await faceapi
        .detectSingleFace(video, detectionOptions)
        .withFaceLandmarks()
        .withFaceExpressions();

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (detections) {
        // Calculs de position et d'inclinaison optimisés
        const landmarks = detections.landmarks;
        const leftEye = landmarks.positions[36];
        const rightEye = landmarks.positions[45];
        const nose = landmarks.positions[33];
        
        // Calcul de l'inclinaison avec lissage
        const eyeAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
        const tiltDegrees = (eyeAngle * 180) / Math.PI;
        
        // Détection des expressions pour plus de précision
        const expressions = detections.expressions;
        const confidence = detections.detection.score;

        // Mise à jour des statistiques
        setDetectionStats(prev => ({
          fps: Math.round(1000 / (now - lastDetectionTime.current)),
          avgConfidence: ((prev.avgConfidence * prev.detectionCount) + confidence) / (prev.detectionCount + 1),
          detectionCount: prev.detectionCount + 1
        }));

        // Callbacks vers le composant parent
        onFaceDetected?.(detections);
        onHeadMovement?.({
          tilt: tiltDegrees,
          position: { x: nose.x, y: nose.y },
          confidence,
          expressions
        });

        // Affichage optionnel des points de repère
        if (import.meta.env.DEV) {
          faceapi.draw.drawFaceLandmarks(canvas, detections);
        }
      }

      lastDetectionTime.current = now;
    } catch (error) {
      console.error('Erreur détection:', error);
    }

    animationFrameRef.current = requestAnimationFrame(detectFaces);
  }, [isActive, isModelLoaded, cameraStatus, currentConfig, onFaceDetected, onHeadMovement]);

  // Initialisation
  useEffect(() => {
    enumerateCameras();
    loadFaceModels();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enumerateCameras, loadFaceModels]);

  // Initialisation de la caméra quand elle est sélectionnée
  useEffect(() => {
    if (selectedCamera && isModelLoaded) {
      initializeCamera();
    }
  }, [selectedCamera, isModelLoaded, initializeCamera]);

  // Démarrage de la détection
  useEffect(() => {
    if (isActive && isModelLoaded && cameraStatus === 'active') {
      animationFrameRef.current = requestAnimationFrame(detectFaces);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, isModelLoaded, cameraStatus, detectFaces]);

  // Interface de sélection de caméra
  const CameraSelector = () => {
    if (availableCameras.length <= 1) return null;

    return (
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0,0,0,0.7)',
        padding: '10px',
        borderRadius: '5px',
        color: 'white',
        zIndex: 1000
      }}>
        <select 
          value={selectedCamera?.deviceId || ''}
          onChange={(e) => {
            const camera = availableCameras.find(c => c.deviceId === e.target.value);
            setSelectedCamera(camera);
          }}
          style={{ marginLeft: '5px' }}
        >
          {availableCameras.map(camera => (
            <option key={camera.deviceId} value={camera.deviceId}>
              {camera.label || `Caméra ${availableCameras.indexOf(camera) + 1}`}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // Indicateur de statut
  const StatusIndicator = () => (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.7)',
      padding: '8px',
      borderRadius: '5px',
      color: 'white',
      fontSize: '12px',
      zIndex: 1000
    }}>
      <div>État: {cameraStatus}</div>
      {cameraStatus === 'active' && (
        <>
          <div>FPS: {detectionStats.fps}</div>
          <div>Confiance: {(detectionStats.avgConfidence * 100).toFixed(1)}%</div>
        </>
      )}
    </div>
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)' // Effet miroir
        }}
      />
      
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          transform: 'scaleX(-1)',
          pointerEvents: 'none'
        }}
      />

      <CameraSelector />
      <StatusIndicator />
      
      {/* Messages d'erreur */}
      {cameraStatus === 'permission-denied' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255,0,0,0.8)',
          color: 'white',
          padding: '20px',
          borderRadius: '10px',
          textAlign: 'center'
        }}>
          🚫 Accès à la caméra refusé
          <br />
          <small>Veuillez autoriser l'accès à la caméra</small>
        </div>
      )}
    </div>
  );
};

export default OptimizedFaceDetection; 