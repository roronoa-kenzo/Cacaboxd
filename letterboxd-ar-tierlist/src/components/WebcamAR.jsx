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
  const [filterType, setFilterType] = useState('grid'); // 'grid' or 'tournament'
  const [tournamentMovies, setTournamentMovies] = useState({
    current: null,
    opponent: null,
    bracket: Array(15).fill(null) // 8 films require 15 slots for a complete tournament bracket
  });
  const [headPosition, setHeadPosition] = useState('center'); // 'left', 'center', or 'right'
  const headPositionRef = useRef('center');
  const lastSelectionTime = useRef(0);
  const selectionCooldown = 2000; // 2 secondes de cooldown entre les sélections

  const VIDEO_WIDTH = 1200;
  const VIDEO_HEIGHT = 1000;

  const allSlotsFilled = selectedMovies.every((slot) => slot !== null);
  // Tournament is completed when we have a winner in position 14 (the final position)
  const tournamentCompleted = tournamentMovies.bracket[14] !== null;

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
    
    if (filterType === 'grid') {
      startScrolling();
    } else if (filterType === 'tournament' && !tournamentMovies.current && !tournamentMovies.opponent && !tournamentCompleted) {
      // For tournament mode, select two random movies
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
    
    return () => clearInterval(intervalRef.current);
  }, [movies, selectedMovies, filterType, tournamentMovies.current, tournamentMovies.opponent, tournamentCompleted]);

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
        const nose = detections.landmarks.positions[30];
        const leftEye = detections.landmarks.positions[36];
        const rightEye = detections.landmarks.positions[45];
        
        // Calcul du centre du visage
        const faceCenter = {
          x: (leftEye.x + rightEye.x) / 2,
          y: (leftEye.y + rightEye.y) / 2
        };
        
        // Calcul du décalage horizontal de la tête
        const eyesVector = {
          x: rightEye.x - leftEye.x,
          y: rightEye.y - leftEye.y
        };
        
        // Normalisation du vecteur yeux
        const eyesLength = Math.sqrt(eyesVector.x * eyesVector.x + eyesVector.y * eyesVector.y);
        const normalizedEyesVector = {
          x: eyesVector.x / eyesLength,
          y: eyesVector.y / eyesLength
        };
        
        // Calcul de l'angle de rotation de la tête (en radians)
        const headAngle = Math.atan2(normalizedEyesVector.y, normalizedEyesVector.x);
        const headAngleDegrees = headAngle * (180 / Math.PI);
        
        // Détermine la position de la tête basée sur l'angle
        let newHeadPosition = 'center';
        const ANGLE_THRESHOLD = 15; // Seuil d'angle pour détecter l'inclinaison de la tête
        
        if (headAngleDegrees > ANGLE_THRESHOLD) {
          newHeadPosition = 'left';
        } else if (headAngleDegrees < -ANGLE_THRESHOLD) {
          newHeadPosition = 'right';
        } else {
          newHeadPosition = 'center';
        }
        
        // Mise à jour de la position de la tête
        if (newHeadPosition !== headPositionRef.current) {
          headPositionRef.current = newHeadPosition;
          setHeadPosition(newHeadPosition);
          
          // Vérification si on est en mode tournoi et si un film doit être sélectionné
          if (filterType === 'tournament' && 
              !tournamentCompleted && 
              tournamentMovies.current && 
              tournamentMovies.opponent &&
              (newHeadPosition === 'left' || newHeadPosition === 'right') &&
              Date.now() - lastSelectionTime.current > selectionCooldown) {
            
            // Sélectionner un film basé sur l'inclinaison de la tête
            const isLeftWinner = newHeadPosition === 'right'; // Inversé car la webcam est inversée
            handleSelectTournamentWinner(isLeftWinner);
            lastSelectionTime.current = Date.now();
          }
        }
        
        const scaleX = VIDEO_WIDTH / 640;
        const scaleY = VIDEO_HEIGHT / 480;
        
        
        
        if (filterType === 'grid') {
          // Original filter - show one movie on forehead
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
        } else if (filterType === 'tournament') {
          // Tournament filter - show two movies facing off
          if (tournamentMovies.current && tournamentMovies.opponent) {
            const imgLeft = new Image();
            imgLeft.src = tournamentMovies.current;
            
            const imgRight = new Image();
            imgRight.src = tournamentMovies.opponent;
            
            const vsText = "VS";
            
            imgLeft.onload = () => {
              // Left movie
              ctx.drawImage(
                imgLeft,
                forehead.x - -200 * scaleX,
                forehead.y - 50 * scaleY,
                110 * scaleX,
                140 * scaleY
              );
              
              // Position du VS exactement au milieu entre les deux images
              // Calcul des positions des images
              const leftImageX = forehead.x - -200 * scaleX;  // Position X de l'image gauche
              const rightImageX = forehead.x + -10 * scaleX;  // Position X de l'image droite
              const imageWidth = 110 * scaleX;               // Largeur des images
              
              // Calcul du point central entre les deux images
              const leftImageCenter = leftImageX + imageWidth / 2;
              const rightImageCenter = rightImageX + imageWidth / 2;
              const middlePoint = (leftImageCenter + rightImageCenter) / 2;
              
              // Rendu du texte VS au milieu
              ctx.font = `${30 * scaleX}px Arial`;
              ctx.fillStyle = 'white';
              ctx.strokeStyle = 'black';
              ctx.lineWidth = 2;
              ctx.textAlign = 'center';
           
              ctx.fillText(vsText, middlePoint, forehead.y - -30 * scaleY);
              
              // Right movie
              ctx.drawImage(
                imgRight,
                forehead.x + -10 * scaleX,
                forehead.y - 50 * scaleY,
                110 * scaleX,
                140 * scaleY
              );
            };
          }
        }
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(detect, 100);
    return () => clearInterval(interval);
  });

  const handleStopScrolling = () => {
    if (!isStopped && filterType === 'grid') {
      clearInterval(intervalRef.current);
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
      startScrolling();
    }
  };

  const handleSelectTournamentWinner = (isLeftWinner) => {
    const bracketCopy = [...tournamentMovies.bracket];
    const winner = isLeftWinner ? tournamentMovies.current : tournamentMovies.opponent;
    
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
    if (!isStopped || filterType !== 'grid') return; // déjà en train de défiler
    setIsStopped(false);
    startScrolling();
    console.log('Défilement relancé');
  };

  const handleRejouer = () => {
    if (filterType === 'grid') {
      setSelectedMovies(Array(10).fill(null));
      setIsStopped(false);
      startScrolling();
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
      clearInterval(intervalRef.current);
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
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: 'relative' }} onClick={filterType === 'grid' ? handleStopScrolling : null}>
        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
          mirrored={true} // Inverse la webcam
        />
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0 }}
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
        />

        {/* Toggle Filter Type Button */}
        <button
          onClick={toggleFilterType}
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            padding: '6px 12px',
            backgroundColor: '#f27300',
            color: 'white',
            border: '1px solid black',
            zIndex: 100
          }}
        >
          {filterType === 'grid' ? 'Passer au mode Tournoi' : 'Passer au mode Classement'}
        </button>

        {filterType === 'grid' && (
          <>
            {/* Original Grid Cases */}
            <div style={{ 
              position: 'absolute', 
              top: 70, 
              left: 50, 
              display: 'flex', 
              flexDirection: 'column' 
            }}>
              {Array.from({ length: 10 }).map((_, idx) => (
                <div
                  key={idx}
                  onClick={() => handleCaptureInSlot(idx)}
                  style={{
                    width: '80px',
                    height: '79px',
                    border: '2px solid white',
                    marginBottom: '4px',
                    backgroundColor: 'rgba(255,255,255,0.7)',
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
                      fontSize: '10px',
                      fontWeight: 'bold',
                      color: 'black'
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

            {/* Message en bas à gauche (Grid mode) */}
            <div style={{ position: 'absolute', bottom: 10, left: 10, color: 'white', background: 'black', padding: '4px' }}>
              {isStopped ? 'Clique sur une case ou relancer' : 'Clique pour stopper'}
            </div>

            {/* Bouton relancer (Grid mode) */}
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
          </>
        )}

        {filterType === 'tournament' && (
  <>
    {/* Tournament Bracket Display */}
    <div style={{ 
      position: 'absolute', 
      bottom: 0, 
      left: 198, 
      right: 55,
      height: '600px',
      display: 'flex',
      justifyContent: 'space-between'
    }}>
      {/* Colonne Gauche - 4 premiers films */}
      <div style={{ width: '30%', position: 'relative', height: '100%' }}>
        {tournamentMovies.bracket.slice(0, 4).map((movie, idx) => (
          <div key={`left-${idx}`} style={{
            position: 'absolute',
            width: '80px',
            height: '80px',
            left: '20%',
            top: `${10 + idx * 20}%`,
            border: '2px solid #666',
            backgroundColor: 'white',
            overflow: 'hidden'
          }}>
            {movie && <img src={movie} alt="bracket" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            <div style={{
              position: 'absolute',
              right: '-30px',
              top: '50%',
              width: '30px',
              borderTop: '2px solid black'
            }}></div>
          </div>
        ))}
      </div>

      {/* Colonne Droite - 4 films suivants */}
      <div style={{ width: '30%', position: 'relative', height: '100%' }}>
        {tournamentMovies.bracket.slice(4, 8).map((movie, idx) => (
          <div key={`right-${idx}`} style={{
            position: 'absolute',
            width: '80px',
            height: '80px',
            right: '70%',
            top: `${10 + idx * 20}%`,
            border: '2px solid #666',
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
          width: '80px',
          height: '80px',
          left: idx < 2 ? '17%' : '60%',
          top: `${20 + (idx % 2) * 40}%`,
          border: '2px solid #666',
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
          width: '80px',
          height: '80px',
          left: `${26 + idx * 26}%`,
          top: '41%',
          border: '2px solid #666',
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
          left: '43.5%',
          top: '48%',
          transform: 'translate(-50%, -50%)',
          width: '130px',
          height: '140px',
          border: '4px solid gold',
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

    {/* Tournament instructions and status */}
    <div style={{ 
      position: 'absolute', 
      top: 50, 
      left: 0,
      right: 0,
      textAlign: 'center',
      color: 'white',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: '10px'
    }}>
      {tournamentCompleted 
        ? 'Le tournoi est terminé ! Clique sur "Rejouer" pour recommencer'
        : tournamentMovies.current && tournamentMovies.opponent 
          ? 'Inclinez la tête vers la gauche ou la droite pour choisir votre film préféré !' 
          : 'Initialisation du tournoi...'}
    </div>
    </>
  )}

        {/* Bouton Rejouer si tout est rempli ou si tournoi terminé */}
        {((filterType === 'grid' && allSlotsFilled) || (filterType === 'tournament' && tournamentCompleted)) && (
          <button
            onClick={handleRejouer}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              padding: '6px 12px',
              backgroundColor: 'white',
              color: 'black',
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