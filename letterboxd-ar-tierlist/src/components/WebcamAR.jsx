
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

  // Références pour la stabilisation améliorée
  const smoothForeheadPositionRef = useRef({ x: 0, y: 0 });
  const prevForeheadPositionRef = useRef({ x: 0, y: 0 });
  const isFirstDetectionRef = useRef(true);
  
  // Nouvelle référence pour stabiliser l'inclinaison
  const smoothTiltHistoryRef = useRef([]);
  const TILT_HISTORY_SIZE = 8; // Nombre de valeurs à garder pour le lissage

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

  // Préchargement des images pour le mode tournament - version améliorée
  useEffect(() => {
    if (filterType === 'tournament') {
      // Précharger les images actuelles du match
      if (tournamentMovies.current && !loadedImages[tournamentMovies.current]) {
        const img = new Image();
        img.src = tournamentMovies.current;
        img.onload = () => {
          setLoadedImages(prev => ({ ...prev, [tournamentMovies.current]: img }));
        };
        img.onerror = () => {
          console.warn('Erreur chargement image:', tournamentMovies.current);
        };
      }
      
      if (tournamentMovies.opponent && !loadedImages[tournamentMovies.opponent]) {
        const img = new Image();
        img.src = tournamentMovies.opponent;
        img.onload = () => {
          setLoadedImages(prev => ({ ...prev, [tournamentMovies.opponent]: img }));
        };
        img.onerror = () => {
          console.warn('Erreur chargement image:', tournamentMovies.opponent);
        };
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
      return;
    }

    const video = webcamRef.current.video;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      return;
    }

    try {
      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      if (!detections || !detections.landmarks) {
        return;
      }

      const { positions } = detections.landmarks;
      const forehead = positions[22];
      const leftEye = positions[36];
      const rightEye = positions[45];

      // Stabilisation de la position du front (inchangé)
      if (isFirstDetectionRef.current) {
        smoothForeheadPositionRef.current = { x: forehead.x, y: forehead.y };
        prevForeheadPositionRef.current = { x: forehead.x, y: forehead.y };
        smoothTiltHistoryRef.current = [];
        isFirstDetectionRef.current = false;
      } else {
        // Lissage très fort pour la position (stabilise le tremblement)
        const positionSmoothing = 0.88; // Légèrement augmenté pour plus de stabilité
        smoothForeheadPositionRef.current.x = 
          prevForeheadPositionRef.current.x * positionSmoothing + forehead.x * (1 - positionSmoothing);
        smoothForeheadPositionRef.current.y = 
          prevForeheadPositionRef.current.y * positionSmoothing + forehead.y * (1 - positionSmoothing);
        
        prevForeheadPositionRef.current = { ...smoothForeheadPositionRef.current };
      }

      // Calcul de l'angle de tête avec stabilisation améliorée
      const eyesVector = { x: rightEye.x - leftEye.x, y: rightEye.y - leftEye.y };
      const eyesLength = Math.sqrt(eyesVector.x ** 2 + eyesVector.y ** 2);
      const normalizedEyesVector = { x: eyesVector.x / eyesLength, y: eyesVector.y / eyesLength };
      const headAngleDegrees = Math.atan2(normalizedEyesVector.y, normalizedEyesVector.x) * (180 / Math.PI);
      const rawTiltFactor = Math.max(-100, Math.min(100, headAngleDegrees * 5));

      // Nouveau système de lissage par moyenne mobile pour l'inclinaison
      smoothTiltHistoryRef.current.push(rawTiltFactor);
      if (smoothTiltHistoryRef.current.length > TILT_HISTORY_SIZE) {
        smoothTiltHistoryRef.current.shift();
      }

      // Calcul de la moyenne pondérée (plus de poids sur les valeurs récentes)
      let weightedSum = 0;
      let totalWeight = 0;
      for (let i = 0; i < smoothTiltHistoryRef.current.length; i++) {
        const weight = (i + 1) / smoothTiltHistoryRef.current.length; // Poids croissant
        weightedSum += smoothTiltHistoryRef.current[i] * weight;
        totalWeight += weight;
      }
      
      const smoothedTiltFactor = totalWeight > 0 ? weightedSum / totalWeight : rawTiltFactor;
      
      // Application d'un lissage final plus doux
      const finalTiltFactor = prevTiltFactorRef.current * 0.75 + smoothedTiltFactor * 0.25;
      prevTiltFactorRef.current = finalTiltFactor;
      
      setSmoothTiltFactor(finalTiltFactor);
      setHeadTiltDegree(finalTiltFactor);

      // Détection pour le mode tournament (utilise l'angle brut pour la réactivité)
      if (filterType === 'tournament' &&
        !tournamentCompleted &&
        tournamentMovies.current &&
        tournamentMovies.opponent &&
        Math.abs(headAngleDegrees) > SELECTION_TILT_THRESHOLD &&
        Date.now() - lastSelectionTime.current > selectionCooldown) {
    
          handleSelectTournamentWinner(headAngleDegrees > 0);
          lastSelectionTime.current = Date.now();
        }

      const scaleX = VIDEO_WIDTH / 900;
      const scaleY = VIDEO_HEIGHT / 450;

      // Utilisation de la position stabilisée pour l'affichage
      const stabilizedForehead = smoothForeheadPositionRef.current;

      if (filterType === 'grid') {
        const img = loadedImages[movies[currentIdx]];
        if (img && img.complete && img.naturalHeight !== 0) {
          ctx.drawImage(
            img, 
            VIDEO_WIDTH - stabilizedForehead.x - 40 * scaleX, 
            stabilizedForehead.y - 160 * scaleY, 
            110 * scaleX, 
            140 * scaleY
          );
        }
      } else if (filterType === 'tournament') {
        const { current, opponent } = tournamentMovies;
        
        // Vérification renforcée de l'existence des images
        if (!current || !opponent) {
          return;
        }

        const imgLeft = loadedImages[current];
        const imgRight = loadedImages[opponent];
        
        // Vérification que les images sont bien chargées et complètes
        if (imgLeft && imgLeft.complete && imgLeft.naturalHeight !== 0 && 
            imgRight && imgRight.complete && imgRight.naturalHeight !== 0) {
          
          const baseImgWidth = 110 * scaleX;
          const baseImgHeight = 140 * scaleY;
          // Utilisation de la position stabilisée
          const baseLeftX = stabilizedForehead.x - -70 * scaleX;
          const baseRightX = stabilizedForehead.x + -130 * scaleX;
          const baseY = stabilizedForehead.y - 180 * scaleY;

          // Utilisation du facteur d'inclinaison stabilisé
          const normalizedLeftTilt = Math.abs(Math.min(0, finalTiltFactor));
          const normalizedRightTilt = Math.max(0, finalTiltFactor);
          const leftScale = 1.0 + (normalizedLeftTilt / 100) * 0.2;
          const rightScale = 1.0 + (normalizedRightTilt / 100) * 0.2;
          const leftRotation = (normalizedLeftTilt / 100) * 10;
          const rightRotation = -(normalizedRightTilt / 100) * 10;

          const drawImageWithRotation = (img, x, y, width, height, rotation) => {
            ctx.save();
            ctx.translate(x + width / 2, y + height / 2);
            ctx.rotate(rotation * Math.PI / 180);
            const radius = 20;
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
            ctx.clip();
            ctx.drawImage(img, -width / 2, -height / 2, width, height);
            ctx.restore();
          };

          try {
            drawImageWithRotation(imgLeft, baseLeftX, baseY, baseImgWidth * leftScale, baseImgHeight * leftScale, leftRotation);
            drawImageWithRotation(imgRight, baseRightX, baseY, baseImgWidth * rightScale, baseImgHeight * rightScale, rightRotation);

            // VS text
            ctx.font = `${30 * scaleX}px Arial`;
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.textAlign = 'center';
            const middle = (baseLeftX + baseImgWidth + baseRightX) / 2;
            ctx.fillText('VS', middle, stabilizedForehead.y - 90 * scaleY);
          } catch (error) {
            console.warn('Erreur dans drawImageWithRotation:', error);
          }
        }
      }
    } catch (error) {
      console.warn('Erreur dans detect:', error);
    }
  };

  // Utilisation d'un interval optimisé pour detect
  useEffect(() => {
    const interval = setInterval(detect, 16); // ~60fps
    return () => clearInterval(interval);
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
      if (selectedMovies[slotIdx] !== null) {
        console.log(`Case ${slotIdx + 1} déjà remplie, action ignorée`);
        return;
      }
      
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
    
    const filledInitialSlots = bracketCopy.slice(0, 8).filter(slot => slot !== null).length;
    const filledQuarterFinals = bracketCopy.slice(8, 12).filter(slot => slot !== null).length;
    const filledSemiFinals = bracketCopy.slice(12, 14).filter(slot => slot !== null).length;
    const filledFinal = bracketCopy[14] !== null;
    
    let nextCurrent = null;
    let nextOpponent = null;
    
    if (filledInitialSlots < 8) {
      const nextInitialSlot = bracketCopy.slice(0, 8).findIndex(slot => slot === null);
      if (nextInitialSlot !== -1) {
        bracketCopy[nextInitialSlot] = winner;
      }
      
      if (filledInitialSlots + 1 < 8) {
        const usedMovieUrls = new Set([...bracketCopy.filter(m => m !== null)]);
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
      } else if (filledInitialSlots + 1 === 8) {
        nextCurrent = bracketCopy[0];
        nextOpponent = bracketCopy[1];
      }
    } else if (filledQuarterFinals < 4) {
      bracketCopy[8 + filledQuarterFinals] = winner;
      
      if (filledQuarterFinals === 0) {
        nextCurrent = bracketCopy[2];
        nextOpponent = bracketCopy[3];
      } else if (filledQuarterFinals === 1) {
        nextCurrent = bracketCopy[4];
        nextOpponent = bracketCopy[5];
      } else if (filledQuarterFinals === 2) {
        nextCurrent = bracketCopy[6];
        nextOpponent = bracketCopy[7];
      } else if (filledQuarterFinals === 3) {
        nextCurrent = bracketCopy[8];
        nextOpponent = bracketCopy[9];
      }
    } else if (filledSemiFinals < 2) {
      bracketCopy[12 + filledSemiFinals] = winner;
      
      if (filledSemiFinals === 0) {
        nextCurrent = bracketCopy[10];
        nextOpponent = bracketCopy[11];
      } else if (filledSemiFinals === 1) {
        nextCurrent = bracketCopy[12];
        nextOpponent = bracketCopy[13];
      }
    } else if (!filledFinal) {
      bracketCopy[14] = winner;
      nextCurrent = null;
      nextOpponent = null;
    }
    
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
    }
  };

    const handleRejouer = () => {
    if (filterType === 'grid') {
      setSelectedMovies(Array(10).fill(null));
      setCurrentIdx(Math.floor(Math.random() * movies.length)); // Index aléatoire
      setIsStopped(false);
      setHasStartedGrid(false); // Retour à l'état initial, pas encore commencé
      lastScrollTimeRef.current = 0;

      if (scrollAnimationFrameRef.current) {
        cancelAnimationFrame(scrollAnimationFrameRef.current);
        scrollAnimationFrameRef.current = null;
      }

      console.log('Jeu relancé, toutes les cases vidées');
    } else if (filterType === 'tournament') {
      setTournamentMovies({
        current: null,
        opponent: null,
        bracket: Array(15).fill(null)
      });
      
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

  const startScrolling = () => {
    setHasStartedGrid(true);
    setIsStopped(false);
    if (!scrollAnimationFrameRef.current) {
      scrollAnimationFrameRef.current = requestAnimationFrame(scrollLoop);
    }
  };

  const toggleFilterType = () => {
    // Réinitialiser complètement la stabilisation lors du changement de mode
    isFirstDetectionRef.current = true;
    smoothTiltHistoryRef.current = [];
    prevTiltFactorRef.current = 0;
    
    if (filterType === 'grid') {
      setFilterType('tournament');
      setIsStopped(false);
      
      setTournamentMovies({
        current: null,
        opponent: null,
        bracket: Array(15).fill(null)
      });
      
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
              {Array.from({ length: 10 }).map((_, idx) => {
                const isSlotFilled = selectedMovies[idx] !== null;
                const isClickable = !isSlotFilled && isStopped;
                
                return (
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
                      onClick={() => isClickable ? handleCaptureInSlot(idx) : null}
                      style={{
                        width: '90px',
                        height: '86px',
                        bottom: 70,                      
                        border: isSlotFilled 
                          ? '2px solid #888' // Bordure moins contrastée pour les cases remplies
                          : '2px solid white', // Bordure blanche pour les cases vides
                        borderRadius: '10px',
                        backgroundColor: isSlotFilled 
                          ? 'rgba(250,250,250,0.95)' // Fond très clair pour les cases remplies
                          : isStopped 
                            ? 'rgba(255,255,255,0.9)' // Normal si vide et stoppé
                            : 'rgba(255,255,255,0.6)', // Plus visible si en mouvement
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        cursor: isClickable ? 'pointer' : 'not-allowed',
                        opacity: 1, // Opacité maximale pour toutes les cases
                        // Ombre plus douce
                        boxShadow: isSlotFilled 
                          ? 'inset 0 0 5px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1)' // Ombre très légère
                          : '0 2px 4px rgba(0,0,0,0.1)',
                        // Désactive les événements de pointeur si la case est remplie
                        pointerEvents: isSlotFilled ? 'none' : 'auto'
                      }}
                    >
                      {selectedMovies[idx] && (
                        <img
                          src={selectedMovies[idx]}
                          alt={`film-${idx}`}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover', 
                            borderRadius: '8px',
                            // Filtre très léger pour garder une bonne visibilité
                            filter: isSlotFilled ? 'brightness(0.95) saturate(0.95)' : 'none'
                          }}
                        />
                      )}
                      
                      {/* Overlay très léger pour indiquer que la case est non-cliquable */}
                      {isSlotFilled && (
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(0,0,0,0.02)', // Overlay presque invisible
                          borderRadius: '8px'
                        }}>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
              {isStopped ? 'Clique sur une case vide ou relancer' : 'Clique pour stopper'}
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