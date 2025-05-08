import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

export default function WebcamAR({ movies, setStep }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedMovies, setSelectedMovies] = useState(Array(10).fill(null)); // 10 slots
  const [currentSlot, setCurrentSlot] = useState(0); // index de 0 à 9

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    };
    loadModels();
  }, []);

  // Défilement automatique des posters des film letterboxd
  useEffect(() => {
    if (!movies || movies.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % movies.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [movies]);

  // Détection et dessin sur le front
  const detect = async () => {
    if (webcamRef.current && canvasRef.current) {
      const video = webcamRef.current.video;
      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      const dims = faceapi.matchDimensions(canvasRef.current, video, true);
      const resized = faceapi.resizeResults(detections, dims);

      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      //faceapi.draw.drawDetections(canvasRef.current, resized);
      //faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);

      if (detections && detections.landmarks) {
        const forehead = detections.landmarks.positions[22];
        const img = new Image();
        img.src = movies[currentIdx]; 

        img.onload = () => {
          ctx.drawImage(img, forehead.x - 60, forehead.y - 160, 110, 140);

        };
      }
    }
  };

  // Détection en boucle
  useEffect(() => {
    const interval = setInterval(detect, 100);
    return () => clearInterval(interval);
  });

  // Action quand on clique
  const handleCapture = () => {
    if (currentSlot < 10) {
      const updated = [...selectedMovies];
      updated[currentSlot] = movies[currentIdx];
      setSelectedMovies(updated);
      setCurrentSlot(currentSlot + 1);
    } else {
      console.log("Tous les slots sont remplis !");
      setStep(2);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {/* Colonne verticale des 1-10 + images validées */}
      <div style={{ display: 'flex', flexDirection: 'column', marginRight: '20px' }}>
        {Array.from({ length: 10 }).map((_, idx) => (
          <div
            key={idx}
            style={{
              width: '80px',
              height: '80px',
              border: '2px solid black',
              margin: '4px',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: 2,
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              {idx + 1}
            </span>
            {selectedMovies[idx] && (
              <img
                src={selectedMovies[idx]}
                alt={`film-${idx}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Webcam + canvas */}
      <div style={{ position: 'relative' }}>
        <Webcam ref={webcamRef} screenshotFormat="image/jpeg" />
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0 }}
          width={640}
          height={480}
        />
        <button onClick={handleCapture} style={{ position: 'absolute', bottom: 10, left: 10 }}>
          Choisir
        </button>
      </div>
    </div>
  );
}
