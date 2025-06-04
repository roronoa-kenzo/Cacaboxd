const cheerio = require('cheerio');
const fetch = require('node-fetch');

// Fonction utilitaire pour mélanger un tableau (algorithme Fisher-Yates)
function shuffleArray(array) {
    const shuffled = [...array]; 
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Fonction pour obtenir le nombre total de pages disponibles
async function getTotalPages(url) {
    try {
        const response = await fetch(url);
        if (response.status === 404) return 0;
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        // Chercher le dernier lien de pagination
        const lastPageLink = $('.paginate-pages li:last-child a').attr('href');
        if (!lastPageLink) return 1;
        
        // Extraire le numéro de page de l'URL
        const pageMatch = lastPageLink.match(/page\/(\d+)/);
        return pageMatch ? parseInt(pageMatch[1]) : 1;
    } catch (error) {
        console.error('Erreur lors de la récupération du nombre total de pages:', error);
        return 1;
    }
}

// Fonction pour générer des numéros de pages aléatoires
function getRandomPages(totalPages, maxPages = 8) { // Augmenter à 8 pages
    const availablePages = Array.from({ length: totalPages }, (_, i) => i + 1);
    const shuffledPages = shuffleArray(availablePages);
    return shuffledPages.slice(0, Math.min(maxPages, totalPages));
}

function extractProfile(html) {
    const regex = /https:\/\/a\.ltrbxd\.com\/resized\/avatar\/upload.+\.jpg/;
    const pp = html.match(regex);
    return pp ? pp[0] : '';
}

// Fonction optimisée pour récupérer les posters en batch
async function extractPostersInBatch(slugs, batchSize = 10) {
    const posters = [];
    
    for (let i = 0; i < slugs.length; i += batchSize) {
        const batch = slugs.slice(i, i + batchSize);
        const batchPromises = batch.map(async (slug) => {
            try {
                const uri = `https://letterboxd.com/ajax/poster/film/${slug}/std/150x210/`;
                const response = await fetch(uri);
                if (response.status === 200) {
                    const text = await response.text();
                    const $ = cheerio.load(text);
                    const poster = $('img').attr('src') || '';
                    return { slug, poster };
                }
                return { slug, poster: '' };
            } catch (error) {
                console.error(`Erreur poster pour ${slug}:`, error);
                return { slug, poster: '' };
            }
        });
        
        const batchResults = await Promise.all(batchPromises);
        posters.push(...batchResults);
        
        // Petite pause entre les batches pour éviter de surcharger le serveur
        if (i + batchSize < slugs.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    return posters;
}

async function extractReviews(username, shuffle = true, maxFilms = 300) { // Augmenter à 300
    const baseUrl = `https://letterboxd.com/${username}/films/reviews/`;
    
    try {
        const testResponse = await fetch(`${baseUrl}page/1/`);
        if (testResponse.status === 404) {
            throw new Error(`Le profil "${username}" n'existe pas.`);
        }
    } catch (error) {
        throw new Error(`Le profil "${username}" n'existe pas.`);
    }
    
    const totalPages = await getTotalPages(`${baseUrl}page/1/`);
    if (totalPages === 0) {
        return [];
    }
    
    // Augmenter à 5 pages max pour les reviews
    const pagesToScrape = Math.min(5, totalPages);
    const randomPages = getRandomPages(totalPages, pagesToScrape);
    console.log(`Scraping ${pagesToScrape} pages aléatoires pour les reviews de ${username}:`, randomPages, `(total: ${totalPages} pages)`);
    
    const reviewsData = [];
    
    for (const pageNum of randomPages) {
        try {
            const response = await fetch(`${baseUrl}page/${pageNum}/`);
            if (response.status !== 200) continue;
            
            const html = await response.text();
            const $ = cheerio.load(html);
            const profile = $('.avatar img').attr('src') || '';

            const reviewElements = $('li.film-detail').toArray();
            
            for (const element of reviewElements) {
                if (reviewsData.length >= maxFilms) break;
                
                const item = cheerio.load(element);
                const fulltitle = item('h2.headline-2.prettify a').text();
                const title = fulltitle.slice(0, -4);
                const date = fulltitle.slice(-4);
                const rating = item('span.rating').text();
                const review = item('div.body-text.-prose.collapsible-text p').text();
                const slug = item('.linked-film-poster').attr('data-film-slug') || '';
                
                if (slug) {
                    reviewsData.push({ title, rating, review, date, username, profile, slug });
                }
            }
            
        } catch (err) {
            console.error(`Erreur page ${pageNum}:`, err);
        }
    }
    
    // Récupérer tous les posters en batch
    const slugs = reviewsData.map(r => r.slug);
    const posterResults = await extractPostersInBatch(slugs);
    
    // Associer les posters aux reviews
    const posterMap = new Map(posterResults.map(p => [p.slug, p.poster]));
    const reviews = reviewsData
        .map(review => ({ ...review, poster: posterMap.get(review.slug) || '' }))
        .filter(review => review.poster); // Garder seulement ceux avec poster
    
    console.log(`Extracted ${reviews.length} reviews for ${username}`);
    
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
    const favoritesData = [];
    
    const favoriteElements = $('#favourites .film-poster').toArray();
    
    for (const el of favoriteElements) {
        const title = $(el).find('img').attr('alt') || '';
        const slug = $(el).attr('data-film-slug') || '';
        
        if (slug) {
            favoritesData.push({ title, slug });
        }
    }

    // Récupérer tous les posters en batch
    const slugs = favoritesData.map(f => f.slug);
    const posterResults = await extractPostersInBatch(slugs);
    
    // Associer les posters aux favoris
    const posterMap = new Map(posterResults.map(p => [p.slug, p.poster]));
    const favorites = favoritesData
        .map(fav => ({ ...fav, poster: posterMap.get(fav.slug) || '' }))
        .filter(fav => fav.poster);

    console.log(`Extracted ${favorites.length} favorites for ${username}`);
    
    return shuffle ? shuffleArray(favorites) : favorites;
}

async function extractRatings(username, shuffle = true, maxFilms = 400) { // Augmenter à 400
    const baseUrl = `https://letterboxd.com/${username}/films/rated/.5-5/`;
    
    try {
        const testResponse = await fetch(`${baseUrl}page/1/`);
        if (testResponse.status === 404) {
            throw new Error(`Le profil "${username}" n'existe pas.`);
        }
    } catch (error) {
        throw new Error(`Le profil "${username}" n'existe pas.`);
    }
    
    const totalPages = await getTotalPages(`${baseUrl}page/1/`);
    if (totalPages === 0) {
        return [];
    }
    
    // Augmenter à 6 pages max pour les ratings
    const pagesToScrape = Math.min(6, totalPages);
    const randomPages = getRandomPages(totalPages, pagesToScrape);
    console.log(`Scraping ${pagesToScrape} pages aléatoires pour les ratings de ${username}:`, randomPages, `(total: ${totalPages} pages)`);
    
    const ratingsData = [];
    
    for (const pageNum of randomPages) {
        try {
            const response = await fetch(`${baseUrl}page/${pageNum}/`);
            if (response.status !== 200) continue;
            
            const html = await response.text();
            const $ = cheerio.load(html);
            const profile = $('.avatar img').attr('src') || '';

            const ratingElements = $('li.poster-container').toArray();
            
            for (const element of ratingElements) {
                if (ratingsData.length >= maxFilms) break;
                
                const item = cheerio.load(element);
                const title = item('.image').attr('alt') || '';
                const rating = item('.rating').text();
                const slug = item('.linked-film-poster').attr('data-film-slug') || '';
                
                if (slug) {
                    ratingsData.push({ title, rating, username, profile, slug });
                }
            }
            
        } catch (err) {
            console.error(`Erreur page ${pageNum}:`, err);
        }
    }
    
    // Récupérer tous les posters en batch
    const slugs = ratingsData.map(r => r.slug);
    const posterResults = await extractPostersInBatch(slugs);
    
    // Associer les posters aux ratings
    const posterMap = new Map(posterResults.map(p => [p.slug, p.poster]));
    const ratings = ratingsData
        .map(rating => ({ ...rating, poster: posterMap.get(rating.slug) || '' }))
        .filter(rating => rating.poster);
    
    console.log(`Extracted ${ratings.length} ratings for ${username}`);
    
    return shuffle ? shuffleArray(ratings) : ratings;
}

async function extractWatchlist(username, shuffle = true, maxFilms = 200) { // Augmenter à 200
    const baseUrl = `https://letterboxd.com/${username}/watchlist/`;
    
    try {
        const testResponse = await fetch(`${baseUrl}page/1/`);
        if (testResponse.status === 404) {
            throw new Error(`Le profil "${username}" n'existe pas.`);
        }
    } catch (error) {
        throw new Error(`Le profil "${username}" n'existe pas.`);
    }
    
    const totalPages = await getTotalPages(`${baseUrl}page/1/`);
    if (totalPages === 0) {
        return [];
    }
    
    // Augmenter à 4 pages max pour la watchlist
    const pagesToScrape = Math.min(4, totalPages);
    const randomPages = getRandomPages(totalPages, pagesToScrape);
    console.log(`Scraping ${pagesToScrape} pages aléatoires pour la watchlist de ${username}:`, randomPages, `(total: ${totalPages} pages)`);
    
    const watchlistData = [];
    
    for (const pageNum of randomPages) {
        try {
            const response = await fetch(`${baseUrl}page/${pageNum}/`);
            if (response.status !== 200) continue;
            
            const html = await response.text();
            const $ = cheerio.load(html);
            const profile = $('.avatar img').attr('src') || '';

            const watchlistElements = $('li.poster-container').toArray();
            
            for (const element of watchlistElements) {
                if (watchlistData.length >= maxFilms) break;
                
                const item = cheerio.load(element);
                const title = item('.image').attr('alt') || '';
                const slug = item('.linked-film-poster').attr('data-film-slug') || '';
                
                if (slug) {
                    watchlistData.push({ title, username, profile, slug });
                }
            }
            
        } catch (err) {
            console.error(`Erreur page ${pageNum}:`, err);
        }
    }
    
    // Récupérer tous les posters en batch
    const slugs = watchlistData.map(w => w.slug);
    const posterResults = await extractPostersInBatch(slugs);
    
    // Associer les posters à la watchlist
    const posterMap = new Map(posterResults.map(p => [p.slug, p.poster]));
    const watchlist = watchlistData
        .map(item => ({ ...item, poster: posterMap.get(item.slug) || '' }))
        .filter(item => item.poster);
    
    console.log(`Extracted ${watchlist.length} watchlist items for ${username}`);
    
    return shuffle ? shuffleArray(watchlist) : watchlist;
}

async function extractAverageRating(slug) {
    const response = await fetch(`https://letterboxd.com/film/${slug}/`);
    if (response.status === 404) {
        throw new Error(`Le film "${slug}" n'existe pas.`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    const content = $('meta[name="twitter:data2"]').attr('content');
    if (!content) throw new Error('No rating found');
    let rating = +(content.split(' ')[0]);
    rating = Math.round(rating * 2);
    return rating;
}

async function extractListByName(username, listName, shuffle = true, maxFilms = 500) { // Augmenter à 500
    const formattedList = listName.toLowerCase().replace(/\s+/g, '-');
    const baseUrl = `https://letterboxd.com/${username}/list/${formattedList}/`;

    const totalPages = await getTotalPages(`${baseUrl}page/1/`);
    if (totalPages === 0) {
        throw new Error(`Le profil ou la liste "${listName}" n'existe pas.`);
    }
    
    // Pour les listes, augmenter à 6 pages max
    const randomPages = getRandomPages(totalPages, Math.min(totalPages, 6));
    console.log(`Scraping ${randomPages.length} pages aléatoires pour la liste "${listName}" de ${username}:`, randomPages, `(total: ${totalPages} pages)`);
    
    const filmsData = [];
    
    for (const pageNum of randomPages) {
        try {
            const response = await fetch(`${baseUrl}page/${pageNum}/`);
            if (response.status !== 200) continue;
            
            const html = await response.text();
            const $ = cheerio.load(html);
            
            const filmElements = $('li.poster-container').toArray();
            
            for (const element of filmElements) {
                if (filmsData.length >= maxFilms) break;
                
                const title = $(element).find('.image').attr('alt') || '';
                const slug = $(element).find('.linked-film-poster').attr('data-film-slug') || '';
                if (slug) {
                    filmsData.push({ title, slug });
                }
            }
            
        } catch (err) {
            console.error(`Erreur page ${pageNum}:`, err);
        }
    }

    if (filmsData.length < 10) {
        throw new Error(`La liste "${listName}" contient moins de 10 films.`);
    }

    // Mélanger avant de récupérer les posters
    const shuffledFilms = shuffle ? shuffleArray(filmsData) : filmsData;
    
    // Récupérer les posters en batch
    const slugs = shuffledFilms.map(f => f.slug);
    const posterResults = await extractPostersInBatch(slugs);
    
    // Retourner seulement les posters non vides
    const posters = posterResults
        .map(p => p.poster)
        .filter(p => p);
    
    console.log(`Extracted ${posters.length} films from list "${listName}"`);
    
    return posters;
}

// Fonction pour obtenir un échantillon vraiment diversifié
async function getDiversifiedSample(username, sampleSize = 20) {
    try {
        // Récupérer de manière aléatoire depuis différentes sources avec limites augmentées
        const [reviews, ratings, watchlist] = await Promise.all([
            extractReviews(username, true, 150), // Max 150 reviews
            extractRatings(username, true, 200), // Max 200 ratings
            extractWatchlist(username, true, 100) // Max 100 watchlist
        ]);

        // Combiner et mélanger une dernière fois
        const allFilms = shuffleArray([...reviews, ...ratings, ...watchlist]);
        
        return allFilms.slice(0, sampleSize);
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'échantillon diversifié:', error);
        return [];
    }
}

module.exports = {
    extractProfile,
    extractReviews,
    extractFavorites,
    extractRatings,
    extractWatchlist,
    extractAverageRating,
    extractListByName,
    shuffleArray,
    getDiversifiedSample,
    getTotalPages,
    getRandomPages,
    extractPostersInBatch
};