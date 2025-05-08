const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { extractFavorites, extractReviews, extractRatings, extractWatchlist } = require('./scraper.cjs');
 // utilise la fonction du scraper

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/api/fetchMovies', async (req, res) => {
    const { username } = req.body;
    try {
        const favorites = await extractFavorites(username);
        const ratings = await extractRatings(username);
        const reviews = await extractReviews(username);

        //fusionne tout en un seul tableau
        const allPosters = [
            ...favorites.map(f => f.poster),
            ...ratings.map(r => r.poster),
            ...reviews.map(r => r.poster)
        ].filter(p => p); // enlève les vides/null

        res.json(allPosters);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/fetchAll', async (req, res) => {
  const { username } = req.body;
  try {
      const [favorites, reviews, ratings, watchlist] = await Promise.all([
          extractFavorites(username),
          extractReviews(username),
          extractRatings(username),
          extractWatchlist(username),
      ]);
      res.json({ favorites, reviews, ratings, watchlist });
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la récupération des films' });
  }
});


app.listen(3000, () => console.log('Backend running on http://localhost:3000'));
