import { useState } from 'react';
import ProfileForm from './components/ProfileForm';
import WebcamAR from './components/WebcamAR';
import TierList from './components/TierList';

function App() {
  const [step, setStep] = useState(0); // 0: form, 1: webcam, 2: tier list
  const [movies, setMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);

  return (
    <div>
      {step === 0 && <ProfileForm setMovies={setMovies} setStep={setStep} />}
      {step === 1 && <WebcamAR movies={movies} setSelectedMovie={setSelectedMovie} setStep={setStep} />}
      {step === 2 && <TierList selectedMovie={selectedMovie} />}
    </div>
  );
}

export default App;
