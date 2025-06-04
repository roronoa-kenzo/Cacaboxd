const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { extractFavorites, extractReviews, extractRatings, extractWatchlist, extractListByName, shuffleArray } = require('./scraper.cjs');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/api/fetchMovies', async (req, res) => {
    const { username, listName} = req.body;

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
            throw new Error(listName 
              ? `Aucun film trouvé dans la liste "${listName}" de ${username}` 
              : `Aucun film trouvé pour l'utilisateur ${username}. Vérifiez que le profil existe et contient des films.`);
        }
        
        console.log(`Films récupérés avec pagination aléatoire: ${posters.length} films pour ${username}`);
        res.json(posters);
        
    } catch (err) {
        console.error('Erreur complète:', err);
        res.status(404).json({ error: err.message });
    }
});

app.listen(3000, () => console.log('Backend running on http://localhost:3000/'));