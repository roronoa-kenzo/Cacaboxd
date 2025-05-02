import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

export default function WebcamAR({ movies, setSelectedMovie, setStep }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (!movies || movies.length === 0) return; // <-- Sécurité anti crash
  
    const interval = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % movies.length);
    }, 2000);
  
    return () => clearInterval(interval);
  }, [movies]);
  

  const handleCapture = () => {
    setSelectedMovie(movies[currentIdx]);
    setStep(2); // Passage à TierList
  };

  const detect = async () => {
    if (webcamRef.current && canvasRef.current) {
      const video = webcamRef.current.video;
      const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
      const dims = faceapi.matchDimensions(canvasRef.current, video, true);
      const resized = faceapi.resizeResults(detections, dims);

      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      faceapi.draw.drawDetections(canvasRef.current, resized);
      faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);

      if (detections && detections.landmarks) {
        const forehead = detections.landmarks.positions[19]; // point du front
        const img = new Image();
        img.src = movies[currentIdx].imgUrl;
        img.onload = () => {
          ctx.drawImage(img, forehead.x - 30, forehead.y - 80, 60, 60);
        };
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(detect, 100);
    return () => clearInterval(interval);
  });

  return (
    <div>
      <Webcam ref={webcamRef} screenshotFormat="image/jpeg" />
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      <button onClick={handleCapture}>Choisir</button>
    </div>
  );
}
