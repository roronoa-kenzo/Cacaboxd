const cheerio = require('cheerio');
const fetch = require('node-fetch');

// Fonction utilitaire pour mélanger un tableau (algorithme Fisher-Yates)
function shuffleArray(array) {
    const shuffled = [...array]; // Créer une copie pour ne pas modifier l'original
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function extractProfile(html) {
    const regex = /https:\/\/a\.ltrbxd\.com\/resized\/avatar\/upload.+\.jpg/;
    const pp = html.match(regex);
    return pp ? pp[0] : '';
}

async function extractPoster(title) {
    const uri = `https://letterboxd.com/ajax/poster/film/${title}/std/150x210/`;
    const response = await fetch(uri);
    if (response.status === 404) {
        throw new Error(`Le profil "${username}" n'existe pas.`);
    }
    const text = await response.text();
    const $ = cheerio.load(text);
    return $('img').attr('src') || '';
}

async function extractReviews(username, shuffle = true) {
    const reviews = [];
    for (let i = 1; i <= 10; i++) {
        try {
            const response = await fetch(`https://letterboxd.com/${username}/films/reviews/page/${i}/`);
            if (response.status === 404) {
                throw new Error(`Le profil "${username}" n'existe pas.`);
            }
            const html = await response.text();
            const $ = cheerio.load(html);
            const profile = $('.avatar img').attr('src') || '';

            $('li.film-detail').each(async (_, element) => {
                const item = cheerio.load(element);
                const fulltitle = item('h2.headline-2.prettify a').text();
                const title = fulltitle.slice(0, -4);
                const date = fulltitle.slice(-4);
                const rating = item('span.rating').text();
                const review = item('div.body-text.-prose.collapsible-text p').text();
                const slug = item('.linked-film-poster').attr('data-film-slug') || '';
                const poster = await extractPoster(slug);

                reviews.push({ title, rating, review, poster, date, username, profile, slug });
            });
        } catch (err) {
            console.error(err);
        }
    }
    
    console.log(`Extracted ${reviews.length} reviews for ${username}`);
    
    // Mélanger les reviews si demandé
    return shuffle ? shuffleArray(reviews) : reviews;
}

async function extractFavorites(username, shuffle = true) {
    const response = await fetch(`https://letterboxd.com/${username}`);
    if (response.status === 404) {
        throw new Error(`Le profil "${username}" n'existe pas.`);
    }
    if (response.status !== 200) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const favorites = [];

    $('#favourites .film-poster').each(async (i, el) => {
        const title = $(el).find('img').attr('alt') || '';
        const slug = $(el).attr('data-film-slug') || '';
        const poster = await extractPoster(slug);
        favorites.push({ title, poster });
    });

    console.log(`Extracted ${favorites.length} favorites for ${username}`);
    
    // Mélanger les favoris si demandé
    return shuffle ? shuffleArray(favorites) : favorites;
}

async function extractRatings(username, shuffle = true) {
    const ratings = [];
    for (let i = 1; i <= 10; i++) {
        try {
            const response = await fetch(`https://letterboxd.com/${username}/films/rated/.5-5/page/${i}/`);
            if (response.status === 404) {
                throw new Error(`Le profil "${username}" n'existe pas.`);
            }
            const html = await response.text();
            const $ = cheerio.load(html);
            const profile = $('.avatar img').attr('src') || '';

            $('li.poster-container').each(async (_, element) => {
                const item = cheerio.load(element);
                const title = item('.image').attr('alt') || '';
                const rating = item('.rating').text();
                const slug = item('.linked-film-poster').attr('data-film-slug') || '';
                const poster = await extractPoster(slug);

                ratings.push({ title, rating, poster, username, profile, slug });
            });
        } catch (err) {
            console.error(err);
        }
    }
    
    console.log(`Extracted ${ratings.length} ratings for ${username}`);
    
    // Mélanger les ratings si demandé
    return shuffle ? shuffleArray(ratings) : ratings;
}

async function extractWatchlist(username, shuffle = true) {
    const watchlist = [];
    for (let i = 1; i <= 10; i++) {
        try {
            const response = await fetch(`https://letterboxd.com/${username}/watchlist/page/${i}/`);
            if (response.status === 404) {
                throw new Error(`Le profil "${username}" n'existe pas.`);
            }
            const html = await response.text();
            const $ = cheerio.load(html);
            const profile = $('.avatar img').attr('src') || '';

            $('li.poster-container').each(async (_, element) => {
                const item = cheerio.load(element);
                const title = item('.image').attr('alt') || '';
                const slug = item('.linked-film-poster').attr('data-film-slug') || '';
                const poster = await extractPoster(slug);

                watchlist.push({ title, poster, username, profile });
            });
        } catch (err) {
            console.error(err);
        }
    }
    
    console.log(`Extracted ${watchlist.length} watchlist for ${username}`);
    
    // Mélanger la watchlist si demandé
    return shuffle ? shuffleArray(watchlist) : watchlist;
}

async function extractAverageRating(slug) {
    const response = await fetch(`https://letterboxd.com/film/${slug}/`);
    if (response.status === 404) {
        throw new Error(`Le profil "${username}" n'existe pas.`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    const content = $('meta[name="twitter:data2"]').attr('content');
    if (!content) throw new Error('No rating found');
    let rating = +(content.split(' ')[0]);
    rating = Math.round(rating * 2);
    return rating;
}

async function extractListByName(username, listName, shuffle = true) {
    const formattedList = listName.toLowerCase().replace(/\s+/g, '-');
    const uri = `https://letterboxd.com/${username}/list/${formattedList}/`;

    const response = await fetch(uri);

    if (response.status === 404) {
        throw new Error(`Le profil ou la liste "${listName}" n'existe pas.`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const films = [];

    $('li.poster-container').each((_, element) => {
        const title = $(element).find('.image').attr('alt') || '';
        const slug = $(element).find('.linked-film-poster').attr('data-film-slug') || '';
        films.push({ title, slug });
    });

    if (films.length < 10) {
        throw new Error(`La liste "${listName}" contient moins de 10 films.`);
    }

    // Mélanger les films avant d'extraire les posters si demandé
    const filmsToProcess = shuffle ? shuffleArray(films) : films;
    const posters = await Promise.all(filmsToProcess.map(film => extractPoster(film.slug)));
    return posters;
}

// Fonction utilitaire pour mélanger plusieurs listes ensemble
function combineAndShuffle(...arrays) {
    const combined = arrays.flat();
    return shuffleArray(combined);
}

// Fonction pour obtenir un échantillon diversifié de plusieurs sources
async function getDiversifiedSample(username, sampleSize = 20) {
    try {
        const [reviews, ratings, watchlist] = await Promise.all([
            extractReviews(username, false), // Ne pas mélanger individuellement
            extractRatings(username, false),
            extractWatchlist(username, false)
        ]);

        // Combiner toutes les sources et mélanger
        const allFilms = combineAndShuffle(reviews, ratings, watchlist);
        
        // Prendre un échantillon de la taille souhaitée
        return allFilms.slice(0, sampleSize);
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'échantillon diversifié:', error);
        return [];
    }
}

module.exports = {
    extractProfile,
    extractPoster,
    extractReviews,
    extractFavorites,
    extractRatings,
    extractWatchlist,
    extractAverageRating,
    extractListByName,
    shuffleArray,
    combineAndShuffle,
    getDiversifiedSample
};