import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

export default function WebcamAR({ movies, setStep }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedMovies, setSelectedMovies] = useState(Array(10).fill(null));
  const [isStopped, setIsStopped] = useState(false);

  const VIDEO_WIDTH = 1200;
  const VIDEO_HEIGHT = 1000;

  const allSlotsFilled = selectedMovies.every((slot) => slot !== null);

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    };
    loadModels();
  }, []);

  const startScrolling = () => {
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
          return prevIdx;
        }

        return nextIdx;
      });
    }, 300);
  };

  useEffect(() => {
    if (!movies || movies.length === 0) return;
    startScrolling();
    return () => clearInterval(intervalRef.current);
  }, [movies, selectedMovies]);

  const detect = async () => {
    if (webcamRef.current && canvasRef.current) {
      const video = webcamRef.current.video;
      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      const dims = { width: VIDEO_WIDTH, height: VIDEO_HEIGHT };
      const resized = faceapi.resizeResults(detections, dims);

      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      if (detections && detections.landmarks) {
        const forehead = detections.landmarks.positions[22];
        const scaleX = VIDEO_WIDTH / 640;
        const scaleY = VIDEO_HEIGHT / 480;
        const img = new Image();
        img.src = movies[currentIdx];

        img.onload = () => {
          ctx.drawImage(
            img,
            forehead.x - -105 * scaleX,
            forehead.y - 20 * scaleY,
            110 * scaleX,
            140 * scaleY
          );
        };
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(detect, 100);
    return () => clearInterval(interval);
  });

  const handleStopScrolling = () => {
    if (!isStopped) {
      clearInterval(intervalRef.current);
      setIsStopped(true);
      console.log(`Défilement stoppé sur l'image: ${movies[currentIdx]}`);
    }
  };

  const handleCaptureInSlot = (slotIdx) => {
    if (!isStopped) return;
    const updated = [...selectedMovies];
    updated[slotIdx] = movies[currentIdx];
    setSelectedMovies(updated);
    console.log(`Film ajouté en case ${slotIdx + 1}: ${movies[currentIdx]}`);
    setIsStopped(false);
    startScrolling();
  };

  const handleRelancer = () => {
    if (!isStopped) return; // déjà en train de défiler
    setIsStopped(false);
    startScrolling();
    console.log('Défilement relancé');
  };

  const handleRejouer = () => {
    setSelectedMovies(Array(10).fill(null));
    setIsStopped(false);
    startScrolling();
    console.log('Jeu relancé, toutes les cases vidées');
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', marginRight: '20px' }}>
        {Array.from({ length: 10 }).map((_, idx) => (
          <div
            key={idx}
            onClick={() => handleCaptureInSlot(idx)}
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
              cursor: isStopped ? 'pointer' : 'not-allowed',
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
        {allSlotsFilled && (
          <button
            onClick={handleRejouer}
            style={{ marginTop: '10px', padding: '6px 12px' }}
          >
            Rejouer
          </button>
        )}
      </div>

      <div style={{ position: 'relative' }} onClick={handleStopScrolling}>
        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
        />
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0 }}
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
        />
        <div style={{ position: 'absolute', bottom: 10, left: 10, color: 'white', background: 'black', padding: '4px' }}>
          {isStopped ? 'Clique sur une case ou relancer' : 'Clique pour stopper'}
        </div>
        <button
          onClick={handleRelancer}
          disabled={!isStopped}
          style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            padding: '6px 12px',
            backgroundColor: isStopped ? 'white' : 'gray',
            color: isStopped ? 'black' : 'lightgray',
            border: '1px solid black',
            cursor: isStopped ? 'pointer' : 'not-allowed'
          }}
        >
          Relancer
        </button>
      </div>
    </div>
  );
}
