
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const { extractFavorites, extractReviews, extractRatings, extractWatchlist, extractListByName } = require('./scraper.cjs');

const app = express();

// Configuration CORS simplifiée - autorise toutes les origines
app.use(cors({
  origin: true,  // Autorise toutes les origines
  credentials: true
}));

// Middleware pour logger l'origine des requêtes (pour le débogage)
app.use((req, res, next) => {
  console.log('Request origin:', req.headers.origin);
  next();
});

app.use(bodyParser.json());

// Fonction pour mélanger un tableau (Fisher-Yates shuffle)
function shuffleArray(array) {
    const shuffled = [...array]; // Copie pour ne pas modifier l'original
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

app.post('/api/fetchMovies', async (req, res) => {
    console.log('Received request to /api/fetchMovies with body:', req.body);
    console.log('Request headers:', req.headers);
    
    const { username, listName } = req.body;
    console.log(`Processing request for username: ${username}, listName: ${listName || 'none'}`);

    try {
        let posters;
        if (listName) {
            console.log(`Fetching list: ${listName}`);
            posters = await extractListByName(username, listName);
        } else {
            console.log('Fetching user favorites, ratings, and reviews');
            const favorites = await extractFavorites(username);
            console.log(`Found ${favorites.length} favorites`);
            
            const ratings = await extractRatings(username);
            console.log(`Found ${ratings.length} ratings`);
            
            const reviews = await extractReviews(username);
            console.log(`Found ${reviews.length} reviews`);

            posters = [
                ...favorites.map(f => f.poster),
                ...ratings.map(r => r.poster),
                ...reviews.map(r => r.poster)
            ].filter(p => p);
            
            console.log(`Total unique posters: ${posters.length}`);
        }

        if (!posters.length) {
            const errorMsg = listName 
              ? `Aucun film trouvé dans la liste "${listName}" de ${username}` 
              : `Aucun film trouvé pour l'utilisateur ${username}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        // Mélange aléatoire des films pour éviter les patterns chronologiques
        const shuffledPosters = shuffleArray(posters);
        
        console.log(`Films mélangés: ${shuffledPosters.length} films pour ${username}`);
        res.json(shuffledPosters);
    } catch (err) {
        console.error('Error in /api/fetchMovies endpoint:', err);
        res.status(404).json({ error: err.message });
    }
});

// Add a basic route to test if the server is running
app.get('/', (req, res) => {
  res.send('Server is running correctly');
});

// Add a test route for CORS verification
app.get('/api/test', (req, res) => {
  res.json({ message: 'CORS is working correctly' });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.SERVER_HOST || '0.0.0.0';

// Log what host and port we're using to make debugging easier
console.log(`Starting server on ${HOST}:${PORT}`);
app.listen(PORT, HOST, () => console.log(`Backend running on http://${HOST}:${PORT}`));
