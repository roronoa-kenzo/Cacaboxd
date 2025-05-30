
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { extractFavorites, extractReviews, extractRatings, extractWatchlist, extractListByName } = require('./scraper.cjs');

const app = express();
app.use(cors());
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

        // Mélange aléatoire des films pour éviter les patterns chronologiques
        const shuffledPosters = shuffleArray(posters);
        
        console.log(`Films mélangés: ${shuffledPosters.length} films pour ${username}`);
        res.json(shuffledPosters);
    } catch (err) {
        console.error(err);
        res.status(404).json({ error: err.message });
    }
});




app.listen(3000, () => console.log('Backend running on http://localhost:3000/'));