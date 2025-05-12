import React, { useState, useEffect } from 'react';
import WebcamAR from './WebcamAR';

export default function ProfileForm() {
  const [username, setUsername] = useState('');
  const [posters, setPosters] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showLoading, setShowLoading] = useState(false);
  const [readyForWebcam, setReadyForWebcam] = useState(false);
  const [listName, setListName] = useState('');
  const [error, setError] = useState(null);


  const handleSubmit = async (e) => {
  e.preventDefault();
  setShowLoading(true);
  setError(null);

  try {
    const response = await fetch('http://localhost:3000/api/fetchMovies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, listName}),
    });

    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error || 'Erreur inconnue');
    }

    const data = await response.json();
    setPosters(data);
    setShowLoading(true);
  } catch (err) {
    console.error(err);
    setShowLoading(false);
    setError(err.message);
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
          return prev + 0.3; // vitesse de chargement
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [showLoading]);

  if (error) {
  setTimeout(() => setError(''), 5000); // Disparaît après 5s
}

  if (readyForWebcam) {
    return <WebcamAR movies={posters} />;
  }

  if (showLoading) {

    let loadingMessage = "Chargement de tes films...";
    const lowerUsername = username.toLowerCase();

    if (lowerUsername === 'terracid') {
      loadingMessage = "Salut Patron, optimisation de vos films et de vos impôts...";
    } else if (lowerUsername === 'grimkujow') {
      loadingMessage = "Chargement des films du mec de Zen là...";
    } else if (lowerUsername === 'potatoze') {
      loadingMessage = "Salut Pota, Chargement de tes films..";
    } else if (lowerUsername === 'regelegorila') {
      loadingMessage = "Chargement des films sans Kaizen";
    } else if (lowerUsername === 'hugodelire') {
      loadingMessage = "Chargement CRAZYYYYYYY des films du GOAT de la CCB...";
    } else if (lowerUsername === 'theorus_') {
      loadingMessage = "Chargement des films du mec qui fait de la 3D la ...";
    } else if (lowerUsername === 'mnkway') {
      loadingMessage = "Salut Jean, joue à Kingdom Hearts stp...";
    } else if (lowerUsername === 'botkz') {
      loadingMessage = "As salam alaykoum Botkz, c'est le pain d'epice...";
    } else if (lowerUsername === 'kamet0') {
      loadingMessage = "MY CEOOOOOOOOOO !";
    } else if (lowerUsername === 'diegobrando7') {
      loadingMessage = "Change de pp letterbox par pitié";
    } else if (lowerUsername === 'hamzakerdaloco') {
      loadingMessage = "Reviens vers la rue stp Hamza";
    }

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'white'
      }}>
        <h2>{loadingMessage}</h2>
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
      {error && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#ff4d4f',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          zIndex: 1000,
          transition: 'opacity 0.3s ease-in-out',
          }}>
          <strong>Erreur :</strong> {error}
        </div>
      )}

      <div className="logo">
        <img src="/img/Cacaboxdlogo.png" alt="Logo" />
        <hr />
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
        <div className='input-form'>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Nom d'utilisateur Letterboxd"
          required
        />
        <input
          type="text"
          value={listName}
          onChange={(e) => setListName(e.target.value)}
          placeholder="(Optionnel) Ajoute une liste"
        />
        </div>
        <button type="submit">Charger mes films</button>
      </form>
    </div>
  );
}
