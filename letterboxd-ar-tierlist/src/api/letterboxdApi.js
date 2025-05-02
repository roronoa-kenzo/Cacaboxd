import axios from 'axios';

export async function fetchMovies(profileUrl) {
  const res = await axios.post('http://localhost:3001/api/scrape', { profileUrl });
  return res.data.movies;
}
