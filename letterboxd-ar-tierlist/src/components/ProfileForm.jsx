import React, { useState } from 'react';
import { fetchMovies } from '../api/letterboxdApi';
import TierList from './TierList';
import WebcamAR from './WebcamAR';

function ProfileForm() {
  const [username, setUsername] = useState('');
  const [movies, setMovies] = useState([]);
  const [step, setStep] = useState(1); // 1 = Formulaire, 2 = Interface webcam+films

  const handleSubmit = async (e) => {
    e.preventDefault();
    const scrapedMovies = await fetchMovies(username);
    setMovies(scrapedMovies);
    setStep(2); // Passer à l'étape 2
  };

  if (step === 1) {
    return (
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Ton pseudo Letterboxd"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button type="submit">Valider</button>
      </form>
    );
  }

  return (
    <div>
      <WebcamAR />
      <TierList movies={movies} />
    </div>
  );
}

export default ProfileForm;
