const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const { extractFavorites, extractReviews, extractRatings, extractWatchlist, extractListByName } = require('./scraper.cjs');
 // utilise la fonction du scraper

const app = express();

// Configuration CORS avec les origines autorisées
app.use(cors({
  origin: process.env.CORS_ALLOWED_ORIGINS.split(',')
}));
app.use(bodyParser.json());

app.post('/api/fetchMovies', async (req, res) => {
    const { username, listName} = req.body;

    try {
        let posters;
        if (listName) {
            posters = await extractListByName(username, listName);
        } else {
            const favorites = await extractFavorites(username);
            const ratings = await extractRatings(username);
            const reviews = await extractReviews(username);

            posters = [
                ...favorites.map(f => f.poster),
                ...ratings.map(r => r.poster),
                ...reviews.map(r => r.poster)
            ].filter(p => p);
        }

        if (!posters.length) {
            throw new Error(listName 
              ? `Aucun film trouvé dans la liste "${listName}" de ${username}` 
              : `Aucun film trouvé pour l'utilisateur ${username}`);
        }

        res.json(posters);
    } catch (err) {
        console.error(err);
        res.status(404).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.SERVER_HOST || 'localhost';

app.listen(PORT, '0.0.0.0', () => console.log(`Backend running on http://0.0.0.0:${PORT}`));