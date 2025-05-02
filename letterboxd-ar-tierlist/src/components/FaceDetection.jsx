import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

const FaceDetection = ({ setDetectedFace }) => {
  const videoRef = useRef(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      setIsVideoLoaded(true);
    };

    loadModels();

    const video = videoRef.current;
    video?.addEventListener('play', () => {
      setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video, new faceapi.SsdMobilenetv1Options())
          .withFaceLandmarks()
          .withFaceDescriptors();
        if (detections.length > 0) {
          setDetectedFace(detections);
        }
      }, 100);
    });
  }, []);

  const startVideo = () => {
    navigator.mediaDevices
      .getUserMedia({ video: {} })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
  };

  return (
    <div>
      <video
        ref={videoRef}
        width="640"
        height="480"
        onPlay={startVideo}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
      {isVideoLoaded && <p>Vidéo en cours de détection...</p>}
    </div>
  );
};

export default FaceDetection;
