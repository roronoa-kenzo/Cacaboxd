const axios = require('axios');
const cheerio = require('cheerio');


async function scrapeLetterboxd(username) {
  try {
    const { data } = await axios.get(`https://letterboxd.com/${username}`);
    const $ = cheerio.load(data);
    const movies = [];
    console.log($.html());

    // Ici, on extrait les informations des films, par exemple les titres et les images
    $('.td-film-details').each((index, element) => {
      const title = $(element).find('a').text().trim();
      const image = $(element).find('img').attr('src') || '';
      movies.push({ title, image });
    });
    
    return movies;
  } catch (err) {
    console.error('Erreur de scraping:', err);
    throw new Error('Erreur de scraping Letterboxd');
  }
}

module.exports = { scrapeLetterboxd };
