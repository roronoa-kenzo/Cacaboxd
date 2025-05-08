import React, { useState } from 'react';
import WebcamAR from './WebcamAR';

export default function ProfileForm() {
  const [username, setUsername] = useState('');
  const [posters, setPosters] = useState([]);

  const handleSubmit = async (e) => {
      e.preventDefault();
      try {
          const response = await fetch('http://localhost:3000/api/fetchMovies', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username }),
          });
          const data = await response.json();
          setPosters(data);
      } catch (err) {
          console.error(err);
      }
  };

  return (
      <div>
          <form onSubmit={handleSubmit}>
              <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nom d'utilisateur Letterboxd"
              />
              <button type="submit">Charger mes films</button>
          </form>

          {posters.length > 0 && <WebcamAR movies={posters} />}



          {/*<div className="posters-grid" style={{ display: 'flex', flexWrap: 'wrap', marginTop: '20px' }}>
              {posters.map((poster, idx) => (
                  <img
                      key={idx}
                      src={poster}
                      alt="Poster"
                      style={{ width: '150px', height: '210px', margin: '5px', objectFit: 'cover' }}
                  />
              ))}
          </div>*/}
      </div>
  );
}


