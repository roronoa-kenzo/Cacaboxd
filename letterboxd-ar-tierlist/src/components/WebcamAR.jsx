import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

export default function WebcamAR({ movies, setStep }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);


  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedMovies, setSelectedMovies] = useState(Array(10).fill(null));
  const [isStopped, setIsStopped] = useState(false);
  const [hasStartedGrid, setHasStartedGrid] = useState(false);

  const [filterType, setFilterType] = useState('grid'); // 'grid' or 'tournament'
  const [tournamentMovies, setTournamentMovies] = useState({
    current: null,
    opponent: null,
    bracket: Array(15).fill(null),
  });
  const [smoothTiltFactor, setSmoothTiltFactor] = useState(0);
const prevTiltFactorRef = useRef(0);
  const [headPosition, setHeadPosition] = useState('center');
  const [headTiltDegree, setHeadTiltDegree] = useState(0);
  const [loadedImages, setLoadedImages] = useState({});

  const scrollAnimationFrameRef = useRef(null);
const lastScrollTimeRef = useRef(0);
const SCROLL_INTERVAL = 150; // en ms


  const headPositionRef = useRef('center');
  const lastSelectionTime = useRef(0);
  const selectionCooldown = 2000;

  const VIDEO_WIDTH = 1920;
  const VIDEO_HEIGHT = 1080;

  const allSlotsFilled = selectedMovies.every((slot) => slot !== null);
  const tournamentCompleted = tournamentMovies.bracket[14] !== null;

  const SLIGHT_TILT_THRESHOLD = 10;
  const SELECTION_TILT_THRESHOLD = 20;

  // Chargement des modèles face-api.js
  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    };
    loadModels();
  }, []);

  // Préchargement des images pour le mode tournament
  useEffect(() => {
    if (filterType === 'tournament' && tournamentMovies.current && tournamentMovies.opponent) {
      // Préchargement des images du match actuel
      if (tournamentMovies.current && !loadedImages[tournamentMovies.current]) {
        const img = new Image();
        img.src = tournamentMovies.current;
        img.onload = () => setLoadedImages(prev => ({ ...prev, [tournamentMovies.current]: img }));
      }
      
      if (tournamentMovies.opponent && !loadedImages[tournamentMovies.opponent]) {
        const img = new Image();
        img.src = tournamentMovies.opponent;
        img.onload = () => setLoadedImages(prev => ({ ...prev, [tournamentMovies.opponent]: img }));
      }
    }
  }, [tournamentMovies.current, tournamentMovies.opponent, filterType, loadedImages]);

  useEffect(() => {
  if (filterType === 'grid' && movies[currentIdx] && !loadedImages[movies[currentIdx]]) {
    const img = new Image();
    img.src = movies[currentIdx];
    img.onload = () => {
      setLoadedImages(prev => ({ ...prev, [movies[currentIdx]]: img }));
    };
  }
}, [currentIdx, filterType, movies, loadedImages]);

  // Fonction de défilement automatique
  const scrollLoop = (timestamp) => {
  if (!lastScrollTimeRef.current) lastScrollTimeRef.current = timestamp;

  const elapsed = timestamp - lastScrollTimeRef.current;
  if (elapsed >= SCROLL_INTERVAL) {
    setCurrentIdx((prevIdx) => {
      let nextIdx = prevIdx;
      let tries = 0;
      const totalMovies = movies.length;

      do {
        nextIdx = (nextIdx + 1) % totalMovies;
        tries++;
      } while (selectedMovies.includes(movies[nextIdx]) && tries <= totalMovies);

      if (tries > totalMovies) {
        console.log('Tous les films ont été sélectionnés');
        return prevIdx;
      }

      return nextIdx;
    });

    lastScrollTimeRef.current = timestamp;
  }

  scrollAnimationFrameRef.current = requestAnimationFrame(scrollLoop);
};


  // Effet spécifique au mode grid (défilement)
 useEffect(() => {
  if (!movies || movies.length === 0 || filterType !== 'grid' || !hasStartedGrid) return;

  scrollAnimationFrameRef.current = requestAnimationFrame(scrollLoop);

  return () => {
    if (scrollAnimationFrameRef.current) {
      cancelAnimationFrame(scrollAnimationFrameRef.current);
      scrollAnimationFrameRef.current = null;
    }
  };
}, [movies, selectedMovies, filterType, hasStartedGrid]);



  useEffect(() => {
    
  if (
    !movies ||
    movies.length === 0 ||
    filterType !== 'tournament' ||
    tournamentMovies.current ||
    tournamentMovies.opponent ||
    tournamentCompleted
  )
    return;

  const randomIndex1 = Math.floor(Math.random() * movies.length);
  let randomIndex2;
  do {
    randomIndex2 = Math.floor(Math.random() * movies.length);
  } while (randomIndex2 === randomIndex1);

  setTournamentMovies((prev) => ({
    ...prev,
    current: movies[randomIndex1],
    opponent: movies[randomIndex2],
  }));
}, [movies, filterType, tournamentMovies.current, tournamentMovies.opponent, tournamentCompleted]);

  
  
  
  const detect = async () => {
    
    if (!webcamRef.current || !canvasRef.current) {
      animationFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    const video = webcamRef.current.video;
    const detections = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks();

    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    if (!detections || !detections.landmarks) {
      animationFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    const { positions } = detections.landmarks;
    const forehead = positions[22];
    const leftEye = positions[36];
    const rightEye = positions[45];

    const eyesVector = { x: rightEye.x - leftEye.x, y: rightEye.y - leftEye.y };
    const eyesLength = Math.sqrt(eyesVector.x ** 2 + eyesVector.y ** 2);
    const normalizedEyesVector = { x: eyesVector.x / eyesLength, y: eyesVector.y / eyesLength };
    const headAngleDegrees = Math.atan2(normalizedEyesVector.y, normalizedEyesVector.x) * (180 / Math.PI);
    const tiltFactor = Math.max(-100, Math.min(100, headAngleDegrees * 5));
    setHeadTiltDegree(tiltFactor);

    // Ajoutez ce code de lissage après le calcul de tiltFactor
    const headPositionSmoothing = 0.15; // Ajustez cette valeur selon la fluidité désirée (0.05-0.3)
    const smoothedTiltFactor = prevTiltFactorRef.current * (1 - headPositionSmoothing) + 
                               tiltFactor * headPositionSmoothing;
    prevTiltFactorRef.current = smoothedTiltFactor;
    setSmoothTiltFactor(smoothedTiltFactor);

    // Utilisez smoothedTiltFactor au lieu de tiltFactor
    setHeadTiltDegree(smoothedTiltFactor);

    if (filterType === 'tournament' &&
      !tournamentCompleted &&
      tournamentMovies.current &&
      tournamentMovies.opponent &&
      Math.abs(headAngleDegrees) > SELECTION_TILT_THRESHOLD &&
      Date.now() - lastSelectionTime.current > selectionCooldown) {
  
        handleSelectTournamentWinner(headAngleDegrees > 0); // gauche = current gagne
        lastSelectionTime.current = Date.now();
      }

    const scaleX = VIDEO_WIDTH / 900;
    const scaleY = VIDEO_HEIGHT / 450;

    if (filterType === 'grid') {
      const img = loadedImages[movies[currentIdx]];
      if (img) {
        ctx.drawImage(img, VIDEO_WIDTH - forehead.x - 40 * scaleX, forehead.y - 160 * scaleY, 110 * scaleX, 140 * scaleY);
      };
    } else if (filterType === 'tournament') {

      const { current, opponent } = tournamentMovies;
      

      if (!loadedImages[current]) {
        const img = new Image();
        img.src = current;
        img.onload = () => setLoadedImages(prev => ({ ...prev, [current]: img }));
      }

      if (!loadedImages[opponent]) {
        const img = new Image();
        img.src = opponent;
        img.onload = () => setLoadedImages(prev => ({ ...prev, [opponent]: img }));
      }

      
      const imgLeft = current ? loadedImages[current] : null;
    const imgRight = opponent ? loadedImages[opponent] : null;
      
      if (imgLeft && imgRight) {
        
        const baseImgWidth = 110 * scaleX;
        const baseImgHeight = 140 * scaleY;
        const baseLeftX = forehead.x - -70 * scaleX;
        const baseRightX = forehead.x + -130 * scaleX;
        const baseY = forehead.y - 180 * scaleY;

        const normalizedLeftTilt = Math.abs(Math.min(0, tiltFactor));
        const normalizedRightTilt = Math.max(0, tiltFactor);
        const leftScale = 1.0 + (normalizedLeftTilt / 100) * 0.2;
        const rightScale = 1.0 + (normalizedRightTilt / 100) * 0.2;
        const leftRotation = (normalizedLeftTilt / 100) * 10;
        const rightRotation = -(normalizedRightTilt / 100) * 10;

        const drawImageWithRotation = (img, x, y, width, height, rotation) => {
          ctx.save();
          ctx.translate(x + width / 2, y + height / 2);
          ctx.rotate(rotation * Math.PI / 180);
          // Début du masque arrondi (border-radius)
          const radius = 20; // ajuste ce rayon selon l’effet souhaité
          ctx.beginPath();
          ctx.moveTo(-width / 2 + radius, -height / 2);
          ctx.lineTo(width / 2 - radius, -height / 2);
          ctx.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
          ctx.lineTo(width / 2, height / 2 - radius);
          ctx.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
          ctx.lineTo(-width / 2 + radius, height / 2);
          ctx.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
          ctx.lineTo(-width / 2, -height / 2 + radius);
          ctx.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);
          ctx.closePath();
          ctx.clip(); // on applique le masque
          ctx.drawImage(img, -width / 2, -height / 2, width, height);
          ctx.restore();
        };

        drawImageWithRotation(imgLeft, baseLeftX, baseY, baseImgWidth * leftScale, baseImgHeight * leftScale, leftRotation);
        drawImageWithRotation(imgRight, baseRightX, baseY, baseImgWidth * rightScale, baseImgHeight * rightScale, rightRotation);

        // VS text
        ctx.font = `${30 * scaleX}px Arial`;
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.textAlign = 'center';
        const middle = (baseLeftX + baseImgWidth + baseRightX) / 2;
        ctx.fillText('VS', middle, forehead.y - 90 * scaleY);
      }
    }

    animationFrameRef.current = requestAnimationFrame(detect);
  };


   useEffect(() => {
    const interval = requestAnimationFrame(detect)
    return () => cancelAnimationFrame(interval);
  });

  const handleStopScrolling = () => {
    if (!isStopped && filterType === 'grid') {
  if (scrollAnimationFrameRef.current) {
    cancelAnimationFrame(scrollAnimationFrameRef.current);
    scrollAnimationFrameRef.current = null;
  }
  setIsStopped(true);
  console.log(`Défilement stoppé sur l'image: ${movies[currentIdx]}`);
}

  };

  const handleCaptureInSlot = (slotIdx) => {
    if (filterType === 'grid') {
      if (!isStopped) return;
      const updated = [...selectedMovies];
      updated[slotIdx] = movies[currentIdx];
      setSelectedMovies(updated);
      console.log(`Film ajouté en case ${slotIdx + 1}: ${movies[currentIdx]}`);
      setIsStopped(false);
      scrollAnimationFrameRef.current = requestAnimationFrame(scrollLoop);
    }
  };

  const handleSelectTournamentWinner = (isLeftWinner) => {
    const bracketCopy = [...tournamentMovies.bracket];
    const winner = isLeftWinner ? tournamentMovies.opponent : tournamentMovies.current;
    
    // Track which phase of the tournament we're in
    const filledInitialSlots = bracketCopy.slice(0, 8).filter(slot => slot !== null).length;
    const filledQuarterFinals = bracketCopy.slice(8, 12).filter(slot => slot !== null).length;
    const filledSemiFinals = bracketCopy.slice(12, 14).filter(slot => slot !== null).length;
    const filledFinal = bracketCopy[14] !== null;
    
    let nextCurrent = null;
    let nextOpponent = null;
    
    // Phase 1: Initial selection of 8 movies
    if (filledInitialSlots < 8) {
      // Add the winner to the next available spot in first 8 positions
      const nextInitialSlot = bracketCopy.slice(0, 8).findIndex(slot => slot === null);
      if (nextInitialSlot !== -1) {
        bracketCopy[nextInitialSlot] = winner;
      }
      
      // If we've filled less than 8 slots, continue with selection
      if (filledInitialSlots + 1 < 8) {
        // We need more initial films for the tournament
        const usedMovieUrls = new Set([
          ...bracketCopy.filter(m => m !== null)
        ]);
        
        // Find movies that haven't been used yet
        const availableMovies = movies.filter(movie => !usedMovieUrls.has(movie));
        
        if (availableMovies.length >= 2) {
          const randomIndex1 = Math.floor(Math.random() * availableMovies.length);
          let randomIndex2;
          do {
            randomIndex2 = Math.floor(Math.random() * availableMovies.length);
          } while (randomIndex2 === randomIndex1);
          
          nextCurrent = availableMovies[randomIndex1];
          nextOpponent = availableMovies[randomIndex2];
        }
      } 
      // If we just completed the initial 8 selections, set up the first quarter-final match
      else if (filledInitialSlots + 1 === 8) {
        nextCurrent = bracketCopy[0];
        nextOpponent = bracketCopy[1];
      }
    }
    // Phase 2: Quarter-finals (4 matches)
    else if (filledQuarterFinals < 4) {
      // Add winner to next quarter-final slot
      bracketCopy[8 + filledQuarterFinals] = winner;
      
      // Set up next match based on how many quarter-finals completed
      if (filledQuarterFinals === 0) {
        // Second quarter-final match
        nextCurrent = bracketCopy[2];
        nextOpponent = bracketCopy[3];
      } else if (filledQuarterFinals === 1) {
        // Third quarter-final match
        nextCurrent = bracketCopy[4];
        nextOpponent = bracketCopy[5];
      } else if (filledQuarterFinals === 2) {
        // Fourth quarter-final match
        nextCurrent = bracketCopy[6];
        nextOpponent = bracketCopy[7];
      } else if (filledQuarterFinals === 3) {
        // All quarter-finals done, set up first semi-final
        nextCurrent = bracketCopy[8]; // First quarter-final winner
        nextOpponent = bracketCopy[9]; // Second quarter-final winner
      }
    }
    // Phase 3: Semi-finals (2 matches)
    else if (filledSemiFinals < 2) {
      // Add winner to next semi-final slot
      bracketCopy[12 + filledSemiFinals] = winner;
      
      // Set up next match 
      if (filledSemiFinals === 0) {
        // Second semi-final
        nextCurrent = bracketCopy[10]; // Third quarter-final winner
        nextOpponent = bracketCopy[11]; // Fourth quarter-final winner
      } else if (filledSemiFinals === 1) {
        // All semi-finals done, set up the final
        nextCurrent = bracketCopy[12]; // First semi-final winner
        nextOpponent = bracketCopy[13]; // Second semi-final winner
      }
    }
    // Phase 4: Final
    else if (!filledFinal) {
      // Add winner to final slot
      bracketCopy[14] = winner;
      
      // Tournament is complete, no more matches
      nextCurrent = null;
      nextOpponent = null;
    }
    
    // Update the tournament state
    setTournamentMovies({
      current: nextCurrent,
      opponent: nextOpponent,
      bracket: bracketCopy
    });
  };

  const handleRelancer = () => {
  if (filterType === 'grid') {
    setCurrentIdx(0);
    lastScrollTimeRef.current = 0;
    setIsStopped(false);

    if (!scrollAnimationFrameRef.current) {
      scrollAnimationFrameRef.current = requestAnimationFrame(scrollLoop);
    }
  } else if (filterType === 'tournament') {
    // Rien à faire ici pour l’instant
  }
};

  const handleRejouer = () => {
    if (filterType === 'grid') {
      setSelectedMovies(Array(10).fill(null));

// Empêche le défilement auto à la relance
setIsStopped(true);

// Stoppe proprement toute animation en cours
if (scrollAnimationFrameRef.current) {
  cancelAnimationFrame(scrollAnimationFrameRef.current);
  scrollAnimationFrameRef.current = null;
}

console.log('Jeu relancé, toutes les cases vidées');
    } else if (filterType === 'tournament') {
      // Reset tournament
      setTournamentMovies({
        current: null,
        opponent: null,
        bracket: Array(15).fill(null)
      });
      
      // Select new random movies
      const randomIndex1 = Math.floor(Math.random() * movies.length);
      let randomIndex2;
      do {
        randomIndex2 = Math.floor(Math.random() * movies.length);
      } while (randomIndex2 === randomIndex1);
      
      setTournamentMovies(prev => ({
        ...prev,
        current: movies[randomIndex1],
        opponent: movies[randomIndex2]
      }));
    }
  };

  const toggleFilterType = () => {
    if (filterType === 'grid') {
      // Switch to tournament mode
      setFilterType('tournament');

      setIsStopped(false);
      
      // Reset tournament state
      setTournamentMovies({
        current: null,
        opponent: null,
        bracket: Array(15).fill(null)
      });
      
      // Select initial movies for tournament
      const randomIndex1 = Math.floor(Math.random() * movies.length);
      let randomIndex2;
      do {
        randomIndex2 = Math.floor(Math.random() * movies.length);
      } while (randomIndex2 === randomIndex1);
      
      setTournamentMovies(prev => ({
        ...prev,
        current: movies[randomIndex1],
        opponent: movies[randomIndex2]
      }));
    } else {
      // Switch to grid mode
      setFilterType('grid');
      setIsStopped(false);
      startScrolling();
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', maxWidth: '100vw', maxHeight: '100vh', overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: VIDEO_WIDTH, height: VIDEO_HEIGHT }} onClick={filterType === 'grid' ? handleStopScrolling : null}>
        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
          mirrored={true} // Inverse la webcam
          videoConstraints={{
            width: VIDEO_WIDTH,
            height: VIDEO_HEIGHT,
            facingMode: "user"
          }}
        />
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0 }}
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
        />

        {/* Toggle Filter Type Button - redimensionné et repositionné pour 1920x1080 */}
        <button
          onClick={toggleFilterType}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            padding: '10px 20px',
            backgroundColor: '#f27300',
            color: 'white',
            border: '1px solid black',
            fontSize: '18px',
            borderRadius: '5px',
            zIndex: 100
          }}
        >
          {filterType === 'grid' ? 'Passer au mode Tournoi' : 'Passer au mode Classement'}
        </button>

        {filterType === 'grid' && (
          <>
            {/* Grid Cases - repositionnées pour 1920x1080 */}
            <div style={{ 
              position: 'absolute', 
              top: 100, 
              left: 35,
              display: 'flex', 
              flexDirection: 'column' 
            }}>
              {Array.from({ length: 10 }).map((_, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                  {/* Number on the left side */}
                  <div style={{
                    position: 'relative',
                    bottom: 70,  
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: 'white',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    borderRadius: '50%'
                  }}>
                    {idx + 1}
                  </div>
                  
                  {/* Movie box */}
                  <div
                    onClick={() => handleCaptureInSlot(idx)}
                    style={{
                      width: '90px',
                      height: '86px',
                      bottom: 70,                      border: '1px solid white',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255,255,255,0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      cursor: isStopped ? 'pointer' : 'not-allowed',
                      opacity: isStopped ? 1 : 0.5
                    }}
                  >
                    {selectedMovies[idx] && (
                      <img
                        src={selectedMovies[idx]}
                        alt={`film-${idx}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Message en bas à gauche (Grid mode) - adapté pour 1920x1080 */}
            <div style={{ 
              position: 'absolute', 
              bottom: 20, 
              right: 20, 
              color: 'white', 
              background: 'rgba(0,0,0,0.7)', 
              padding: '10px',
              fontSize: '18px',
              borderRadius: '5px'
            }}>
              {isStopped ? 'Clique sur une case ou relancer' : 'Clique pour stopper'}
            </div>

            {/* Bouton relancer (Grid mode) - adapté pour 1920x1080 */}
            <button
              onClick={handleRelancer}
              disabled={!isStopped}
              style={{
                position: 'absolute',
                bottom: 20,
                right: '17em',
                padding: '10px 20px',
                fontSize: '18px',
                backgroundColor: isStopped ? 'white' : 'gray',
                color: isStopped ? 'black' : 'lightgray',
                border: '1px solid black',
                borderRadius: '5px',
                cursor: isStopped ? 'pointer' : 'not-allowed'
              }}
            >
              Relancer
            </button>
          </>
        )}

        {filterType === 'tournament' && (
          <>
            {/* Tournament Bracket Display - redimensionné pour 1920x1080 */}
            <div style={{ 
              position: 'absolute', 
              bottom: 20, 
              left: 280, 
              right: 20,
              height: '600px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              {/* Colonne Gauche - 4 premiers films */}
              <div style={{ width: '30%', position: 'relative', height: '100%' }}>
                {tournamentMovies.bracket.slice(0, 4).map((movie, idx) => (
                  <div key={`left-${idx}`} style={{
                    position: 'absolute',
                    width: '100px',
                    height: '100px',
                    left: '20%',
                    top: `${10 + idx * 20}%`,
                    border: '2px solid #666',
                    borderRadius: '10px',
                    backgroundColor: 'white',
                    overflow: 'hidden'
                  }}>
                    {movie && <img src={movie} alt="bracket" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <div style={{
                      position: 'absolute',
                      right: '-40px',
                      top: '50%',
                      width: '40px',
                      borderTop: '3px solid #666'
                    }}></div>
                  </div>
                ))}
              </div>

      {/* Colonne Droite - 4 films suivants */}
      <div style={{ width: '30%', position: 'relative', height: '100%' }}>
        {tournamentMovies.bracket.slice(4, 8).map((movie, idx) => (
          <div key={`right-${idx}`} style={{
            position: 'absolute',
            width: '100px',
            height: '100px',
            right: '70%',
            top: `${10 + idx * 20}%`,
            border: '2px solid #666',
            borderRadius: '10px',
            backgroundColor: 'white',
            overflow: 'hidden'
          }}>
            {movie && <img src={movie} alt="bracket" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            <div style={{
              position: 'absolute',
              left: '-30px',
              top: '50%',
              width: '30px',
              borderTop: '2px solid black'
            }}></div>
          </div>
        ))}
      </div>

      {/* Quarts de finale (centre gauche/droite) */}
      {tournamentMovies.bracket.slice(8, 12).map((movie, idx) => (
        <div key={`quarter-${idx}`} style={{
          position: 'absolute',
          width: '100px',
          height: '100px',
          left: idx < 2 ? '17%' : '60%',
          top: `${20 + (idx % 2) * 40}%`,
          border: '2px solid #666',
          borderRadius: '10px',
          backgroundColor: 'white',
          overflow: 'hidden'
        }}>
          {movie && <img src={movie} alt="bracket" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
      ))}

      {/* Demi-finales */}
      {tournamentMovies.bracket.slice(12, 14).map((movie, idx) => (
        <div key={`semi-${idx}`} style={{
          position: 'absolute',
          width: '100px',
          height: '100px',
          left: `${26 + idx * 26}%`,
          top: '41%',
          border: '2px solid #666',
          borderRadius: '10px',
          backgroundColor: 'white',
          overflow: 'hidden'
        }}>
          {movie && <img src={movie} alt="bracket" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
      ))}

      {/* Finale Centrale */}
      {tournamentMovies.bracket[14] && (
        <div style={{
          position: 'absolute',
          left: '42.5%',
          top: '48%',
          transform: 'translate(-50%, -50%)',
          width: '180px',
          height: '240px',
          border: '4px solid gold',
          borderRadius: '10px',
          backgroundColor: 'white',
          overflow: 'hidden',
          zIndex: 10
        }}>
          <img
            src={tournamentMovies.bracket[14]}
            alt="winner"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'gold',
            textAlign: 'center',
            padding: '2px',
            fontSize: '12px'
          }}>
            GAGNANT
          </div>
        </div>
      )}
    </div>

    
    
    </>
  )}

        {/* Bouton Rejouer si tout est rempli ou si tournoi terminé */}
        {((filterType === 'grid' && allSlotsFilled) || (filterType === 'tournament' && tournamentCompleted)) && (
          <button
            onClick={handleRejouer}
            style={{
              position: 'absolute',
              top: '1.5em',
              right: '19em',
              padding: '10px 12px',
              backgroundColor: '#00d543',
              color: '#ffffff',
              border: '1px solid black'                 
            }}
          >
            Rejouer
          </button>
        )}
      </div>
    </div>
  );
}