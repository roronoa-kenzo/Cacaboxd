import React, { useEffect } from 'react';

export default function LoadingScreen({ progress, onComplete }) {
  useEffect(() => {
    if (progress >= 100) {
      const timeout = setTimeout(onComplete, 500); // Petite pause avant transition
      return () => clearTimeout(timeout);
    }
  }, [progress, onComplete]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#14181c',
      color: 'white'
    }}>
      <h2>Chargement des films...</h2>
      <div style={{
        width: '80%',
        height: '20px',
        background: '#00d543',
        borderRadius: '10px',
        overflow: 'hidden',
        marginTop: '20px'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: '#00d543',
          transition: 'width 0.05s linear'
        }} />
      </div>
      <p>{progress}%</p>
    </div>
  );
}
