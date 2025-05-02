import React, { useState } from 'react';

function TierList({ movies = [] }) {
  const [tierList, setTierList] = useState([]);

  const handleTierChange = (movie, tier) => {
    setTierList((prevTierList) => {
      const updatedTierList = [...prevTierList];
      updatedTierList.push({ movie, tier });
      return updatedTierList;
    });
  };

  if (!Array.isArray(movies) || movies.length === 0) {
    return <div>Chargement des films ou aucun film trouvé...</div>;
  }

  return (
    <div>
      {movies.map((movie, index) => (
        <div key={index}>
          <img src={movie.image} alt={movie.title || "Film"} />
          <p>{movie.title || "Titre inconnu"}</p>
          <button onClick={() => handleTierChange(movie, 1)}>Placer en Tier 1</button>
          <button onClick={() => handleTierChange(movie, 2)}>Placer en Tier 2</button>
          {/* Tu peux ajouter d'autres boutons tiers ici */}
        </div>
      ))}
    </div>
  );
}

export default TierList;
