const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const { extractFavorites, extractReviews, extractRatings, extractWatchlist, extractListByName } = require('./scraper.cjs');

const app = express();

// Correctly configure CORS using environment variables
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS 
  ? process.env.CORS_ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:5173', 'http://31.56.58.171', 'http://localhost'];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(bodyParser.json());

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

        console.log(`Successfully returning ${posters.length} posters`);
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

const PORT = process.env.PORT || 3000;
const HOST = process.env.SERVER_HOST || '0.0.0.0';

// Log what host and port we're using to make debugging easier
console.log(`Starting server on ${HOST}:${PORT}`);
app.listen(PORT, HOST, () => console.log(`Backend running on http://${HOST}:${PORT}`));