const cheerio = require('cheerio');
const fetch = require('node-fetch');

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

async function extractReviews(username) {
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
    return reviews;
}

async function extractFavorites(username) {
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
    return favorites;
}

async function extractRatings(username) {
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
    return ratings;
}

async function extractWatchlist(username) {
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
    return watchlist;
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

async function extractListByName(username, listName) {
    const formattedList = listName.toLowerCase().replace(/\s+/g, '-');
    const uri = `https://letterboxd.com/${username}/list/${formattedList}/`;

    const response = await fetch(uri);

    if (response.status === 404) {
        throw new Error(`Le profil ou la liste "${listName}" n'existe pas.`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const films = [];
    const profile = $('.avatar img').attr('src') || '';

    $('li.poster-container').each((_, element) => {
        const title = $(element).find('.image').attr('alt') || '';
        const slug = $(element).find('.linked-film-poster').attr('data-film-slug') || '';
        films.push({ title, slug, profile });
    });

    if (films.length < 10) {
        throw new Error(`La liste "${listName}" contient moins de 10 films.`);
    }

    const posters = await Promise.all(films.map(film => extractPoster(film.slug)));
    return posters;
}



module.exports = {
    extractProfile,
    extractPoster,
    extractReviews,
    extractFavorites,
    extractRatings,
    extractWatchlist,
    extractAverageRating,
    extractListByName
};
