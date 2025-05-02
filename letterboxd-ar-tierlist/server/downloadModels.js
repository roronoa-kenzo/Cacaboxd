// downloadModels.js
import { createWriteStream } from 'fs';
import { mkdirSync } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { get } from 'https';
const streamPipeline = promisify(pipeline);

const urls = [
  'https://justadudewhohacks.github.io/face-api.js/models/tiny_face_detector_model-weights_manifest.json',
  'https://justadudewhohacks.github.io/face-api.js/models/tiny_face_detector_model-shard1',
  'https://justadudewhohacks.github.io/face-api.js/models/face_landmark_68_model-weights_manifest.json',
  'https://justadudewhohacks.github.io/face-api.js/models/face_landmark_68_model-shard1',
  'https://justadudewhohacks.github.io/face-api.js/models/face_expression_model-weights_manifest.json',
  'https://justadudewhohacks.github.io/face-api.js/models/face_expression_model-shard1',
  'https://justadudewhohacks.github.io/face-api.js/models/face_recognition_model-weights_manifest.json',
  'https://justadudewhohacks.github.io/face-api.js/models/face_recognition_model-shard1'
];

async function downloadFiles() {
  mkdirSync('./public/models', { recursive: true });

  for (const url of urls) {
    const filename = url.split('/').pop();
    const filePath = `./public/models/${filename}`;
    console.log(`Downloading ${filename}...`);

    await new Promise((resolve, reject) => {
      get(url, (response) => {
        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        }
        streamPipeline(response, createWriteStream(filePath))
          .then(resolve)
          .catch(reject);
      }).on('error', reject);
    });

    console.log(`Downloaded ${filename}`);
  }
}

downloadFiles().catch(err => {
  console.error('Error downloading models', err);
});
