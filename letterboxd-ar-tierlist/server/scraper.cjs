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
    const text = await response.text();
    const $ = cheerio.load(text);
    return $('img').attr('src') || '';
}

async function extractReviews(username) {
    const reviews = [];
    for (let i = 1; i <= 10; i++) {
        try {
            const response = await fetch(`https://letterboxd.com/${username}/films/reviews/page/${i}/`);
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
    const html = await response.text();
    const $ = cheerio.load(html);
    const content = $('meta[name="twitter:data2"]').attr('content');
    if (!content) throw new Error('No rating found');
    let rating = +(content.split(' ')[0]);
    rating = Math.round(rating * 2);
    return rating;
}

module.exports = {
    extractProfile,
    extractPoster,
    extractReviews,
    extractFavorites,
    extractRatings,
    extractWatchlist,
    extractAverageRating
};
