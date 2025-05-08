import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

export default function WebcamAR({ movies, setStep }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null); // stocke l'interval
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedMovies, setSelectedMovies] = useState(Array(10).fill(null)); // 10 slots
  const [isStopped, setIsStopped] = useState(false); // nouvel état

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    };
    loadModels();
  }, []);

  // Défilement automatique rapide
  useEffect(() => {
    if (!movies || movies.length === 0) return;
  
    clearInterval(intervalRef.current);
  
    intervalRef.current = setInterval(() => {
      setCurrentIdx((prevIdx) => {
        let nextIdx = prevIdx;
        let tries = 0;
        const totalMovies = movies.length;
  
        do {
          nextIdx = (nextIdx + 1) % totalMovies;
          tries++;
        } while (selectedMovies.includes(movies[nextIdx]) && tries <= totalMovies);
  
        if (tries > totalMovies) {
          clearInterval(intervalRef.current);
          console.log('Tous les films ont été sélectionnés');
          return prevIdx; // pas de changement si tous pris
        }
  
        return nextIdx;
      });
    }, 300);
  
    return () => clearInterval(intervalRef.current);
  }, [movies, selectedMovies]);
  

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

      // Désactivé les dessins de faceapi
      // faceapi.draw.drawDetections(canvasRef.current, resized);
      // faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);

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

  // 👉 Quand on clique sur la webcam (ou canvas), stoppe le défilement
  const handleStopScrolling = () => {
    if (!isStopped) { // empêche d'arrêter plusieurs fois
      clearInterval(intervalRef.current);
      setIsStopped(true);
      console.log(`Défilement stoppé sur l'image: ${movies[currentIdx]}`);
    }
  };

  // 👈 Clique sur une case pour mettre le film choisi
  const handleCaptureInSlot = (slotIdx) => {
    if (!isStopped) return; // si pas stoppé, ignore le clic
    const updated = [...selectedMovies];
    updated[slotIdx] = movies[currentIdx];
    setSelectedMovies(updated);
    console.log(`Film ajouté en case ${slotIdx + 1}: ${movies[currentIdx]}`);
    setIsStopped(false);

  };

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {/* Colonne verticale des 1-10 + images validées */}
      <div style={{ display: 'flex', flexDirection: 'column', marginRight: '20px' }}>
        {Array.from({ length: 10 }).map((_, idx) => (
          <div
            key={idx}
            onClick={() => handleCaptureInSlot(idx)} // 👈 clique sur la case
            style={{
              width: '80px',
              height: '80px',
              border: '2px solid black',
              margin: '4px',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              cursor: isStopped ? 'pointer' : 'not-allowed', // seulement cliquable après arrêt
              opacity: isStopped ? 1 : 0.5
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
      <div style={{ position: 'relative' }} onClick={handleStopScrolling}>
        <Webcam ref={webcamRef} screenshotFormat="image/jpeg" />
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0 }}
          width={640}
          height={480}
        />
        {/* 👉 On a retiré le bouton "Choisir" */}
        <div style={{ position: 'absolute', bottom: 10, left: 10, color: 'white', background: 'black', padding: '4px' }}>
          {isStopped ? 'Clique sur une case' : 'Clique pour stopper'}
        </div>
      </div>
    </div>
  );
}
