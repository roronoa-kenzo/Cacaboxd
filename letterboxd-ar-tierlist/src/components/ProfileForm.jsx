import React, { useState, useEffect } from 'react';
import WebcamAR from './WebcamAR';

export default function ProfileForm() {
  const [username, setUsername] = useState('');
  const [posters, setPosters] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showLoading, setShowLoading] = useState(false);
  const [readyForWebcam, setReadyForWebcam] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
     setShowLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/fetchMovies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      setPosters(data); // met les films
      setShowLoading(true); // affiche la barre de chargement
    } catch (err) {
      console.error(err);
    }
  };

  // simulate loading progress
  useEffect(() => {
    if (showLoading) {
      const interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setReadyForWebcam(true), 500); // petite pause avant transition
            return 100;
          }
          return prev + 0.4; // vitesse de chargement
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [showLoading]);

  if (readyForWebcam) {
    return <WebcamAR movies={posters} />;
  }

  if (showLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'white'
      }}>
        <h2>Chargement de tes films...</h2>
        <div style={{
          width: '80%',
          height: '20px',
          background: '#333',
          borderRadius: '10px',
          overflow: 'hidden',
          marginTop: '20px'
        }}>
          <div style={{
            width: `${Math.round(loadingProgress)}%`,
            height: '100%',
            background: '#00d543',
            transition: 'width 0.05s linear'
          }} />
        </div>
        <p>{Math.round(loadingProgress)}%</p>
      </div>
    );
  }

  return (
    <div className="form-container">
      <div className="logo">
        <img src="/public/img/Cacaboxdlogo.png" alt="Logo" />
        <hr />
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Nom d'utilisateur Letterboxd"
        />
        <button type="submit">Charger mes films</button>
      </form>
    </div>
  );
}
