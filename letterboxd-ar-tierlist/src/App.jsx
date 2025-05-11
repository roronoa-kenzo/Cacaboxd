import { useState } from 'react';
import ProfileForm from './components/ProfileForm';
import WebcamAR from './components/WebcamAR';
import LoadingScreen from './components/LoadingScreen';

function App() {
  const [step, setStep] = useState(0); // 0: form, 1: loading, 2: webcam
  const [movies, setMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header style={{ width: '100%', backgroundColor: '#14181c', color: 'red', padding: '20px 0' }}>
        <nav style={{ maxWidth: '1200px', margin: '10px auto', padding: '0 20px' }}>
          <img style={{ padding: '0 30px', height: '40px' }} src="/public/img/Cacaboxdlogo.png" alt="Cacaboxd" />
        </nav>
      </header>

      <main style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px'
      }}>

       

        {step === 0 && <ProfileForm setMovies={setMovies} setStep={setStep} />}
        {step === 1 && <LoadingScreen onComplete={() => setStep(2)} />}
        {step === 2 && <WebcamAR movies={movies} setSelectedMovie={setSelectedMovie} />}
      </main>

      <footer style={{ width: '100%', backgroundColor: '#131313', textAlign: 'center', padding: '10px' }}>
        <small>Web Design & Development by Tanougast Kenzo</small>
      </footer>
    </div>
  );
}

export default App;
