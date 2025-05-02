const express = require('express');
const cors = require('cors');
const { scrapeLetterboxd } = require('./scraper.cjs');

const app = express();
const PORT = 3001;

// Ajoute CORS ici
app.use(cors());
app.use(express.json());

app.post('/api/scrape', async (req, res) => {
  const { username } = req.body;
  try {
    const movies = await scrapeLetterboxd(username);
    res.json(movies);
  } catch (error) {
    console.error('Erreur scraping Letterboxd:', error);
    res.status(500).send('Erreur scraping Letterboxd');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
