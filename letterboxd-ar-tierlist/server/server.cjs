const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const { extractFavorites, extractReviews, extractRatings, extractWatchlist, extractListByName, shuffleArray } = require('./scraper.cjs');

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

app.post('/api/fetchMovies', async (req, res) => {
    console.log('Received request to /api/fetchMovies with body:', req.body);
    console.log('Request headers:', req.headers);
    
    const { username, listName } = req.body;
    console.log(`Processing request for username: ${username}, listName: ${listName || 'none'}`);

    try {
        let posters = [];
        
        if (listName) {
            // Pour les listes nommées, utiliser la pagination aléatoire
            posters = await extractListByName(username, listName);
        } else {
            // Pour les données générales, récupérer depuis des pages aléatoires
            console.log(`Début du scraping pour ${username}...`);
            
            const [favorites, ratings, reviews] = await Promise.all([
                extractFavorites(username).catch(err => {
                    console.log(`Pas de favoris pour ${username}:`, err.message);
                    return [];
                }),
                extractRatings(username).catch(err => {
                    console.log(`Pas de ratings pour ${username}:`, err.message);
                    return [];
                }),
                extractReviews(username).catch(err => {
                    console.log(`Pas de reviews pour ${username}:`, err.message);
                    return [];
                })
            ]);

            console.log(`Résultats pour ${username}: ${favorites.length} favoris, ${ratings.length} ratings, ${reviews.length} reviews`);

            // Combiner tous les posters - filtrer les posters vides
            const allPosters = [
                ...favorites.map(f => f.poster).filter(p => p),
                ...ratings.map(r => r.poster).filter(p => p),
                ...reviews.map(r => r.poster).filter(p => p)
            ];
            
            // Un dernier mélange pour s'assurer d'une bonne distribution
            posters = shuffleArray(allPosters);
        }

        if (!posters.length) {
            const errorMsg = listName 
              ? `Aucun film trouvé dans la liste "${listName}" de ${username}` 
              : `Aucun film trouvé pour l'utilisateur ${username}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        
        console.log(`Films récupérés avec pagination aléatoire: ${posters.length} films pour ${username}`);
        res.json(posters);
        
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
