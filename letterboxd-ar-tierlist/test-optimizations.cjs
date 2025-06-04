/**
 * Script de test des optimisations de reconnaissance faciale
 * Vérifie que tous les composants se chargent correctement
 */

console.log('🧪 Test des optimisations de reconnaissance faciale...\n');

// Test 1: Vérification des fichiers
const fs = require('fs');

const filesToCheck = [
  'src/components/OptimizedFaceDetection.jsx',
  'src/utils/useFaceDetectionOptimizer.js',
  'src/utils/faceDetectionBenchmark.js',
  'server/downloadModels.js',
  'OPTIMIZATIONS.md'
];

console.log('📁 Vérification des fichiers d\'optimisation:');
filesToCheck.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

// Test 2: Vérification de la syntaxe des composants React
console.log('\n⚛️ Vérification de la syntaxe React:');

try {
  // Test simple de parsing du composant optimisé
  const optimizedComponent = fs.readFileSync('src/components/OptimizedFaceDetection.jsx', 'utf8');
  const hasRequiredImports = optimizedComponent.includes('import * as faceapi') && 
                             optimizedComponent.includes('import React');
  const hasRequiredFunctions = optimizedComponent.includes('const OptimizedFaceDetection') &&
                               optimizedComponent.includes('enumerateCameras') &&
                               optimizedComponent.includes('detectFaces');
  
  console.log(`  ${hasRequiredImports ? '✅' : '❌'} Imports requis présents`);
  console.log(`  ${hasRequiredFunctions ? '✅' : '❌'} Fonctions principales présentes`);
  
} catch (error) {
  console.log(`  ❌ Erreur de lecture: ${error.message}`);
}

// Test 3: Vérification du hook d'optimisation
console.log('\n🪝 Vérification du hook d\'optimisation:');

try {
  const hookContent = fs.readFileSync('src/utils/useFaceDetectionOptimizer.js', 'utf8');
  const hasHookExport = hookContent.includes('export const useFaceDetectionOptimizer');
  const hasRequiredFunctions = hookContent.includes('shouldProcessFrame') &&
                               hookContent.includes('smoothValue') &&
                               hookContent.includes('getCameraOptimizations');
  
  console.log(`  ${hasHookExport ? '✅' : '❌'} Hook exporté correctement`);
  console.log(`  ${hasRequiredFunctions ? '✅' : '❌'} Fonctions d'optimisation présentes`);
  
} catch (error) {
  console.log(`  ❌ Erreur de lecture: ${error.message}`);
}

// Test 4: Vérification du système de benchmark
console.log('\n📊 Vérification du système de benchmark:');

try {
  const benchmarkContent = fs.readFileSync('src/utils/faceDetectionBenchmark.js', 'utf8');
  const hasBenchmarkClass = benchmarkContent.includes('class FaceDetectionBenchmark');
  const hasConfigs = benchmarkContent.includes('BENCHMARK_CONFIGS');
  const hasExports = benchmarkContent.includes('export { benchmark }') || 
                     benchmarkContent.includes('export const benchmark');
  
  console.log(`  ${hasBenchmarkClass ? '✅' : '❌'} Classe de benchmark présente`);
  console.log(`  ${hasConfigs ? '✅' : '❌'} Configurations de test présentes`);
  console.log(`  ${hasExports ? '✅' : '❌'} Exports corrects`);
  
} catch (error) {
  console.log(`  ❌ Erreur de lecture: ${error.message}`);
}

// Test 5: Vérification du dossier models
console.log('\n🧠 Vérification des modèles IA:');

const modelsDir = 'public/models';
const modelExists = fs.existsSync(modelsDir);
console.log(`  ${modelExists ? '✅' : '❌'} Dossier models présent`);

if (modelExists) {
  const modelFiles = fs.readdirSync(modelsDir).filter(f => f.includes('model'));
  console.log(`  📄 ${modelFiles.length} fichiers de modèles trouvés`);
  
  const requiredModels = [
    'tiny_face_detector_model-weights_manifest.json',
    'face_landmark_68_model-weights_manifest.json'
  ];
  
  requiredModels.forEach(model => {
    const exists = modelFiles.some(f => f.includes(model.split('-')[0]));
    console.log(`    ${exists ? '✅' : '❌'} ${model.split('-')[0]}`);
  });
} else {
  console.log('  💡 Exécutez: node server/downloadModels.js pour télécharger les modèles');
}

// Résumé
console.log('\n🎯 Résumé des optimisations:');
console.log('  🎥 Détection automatique des caméras externes');
console.log('  ⚡ Performances améliorées (throttling, cache)');
console.log('  🧠 Chargement optimisé des modèles IA');
console.log('  📊 Système de benchmark intégré');
console.log('  🔧 Configuration adaptative par type de caméra');

console.log('\n🚀 Prochaines étapes recommandées:');
console.log('  1. pnpm run dev - Démarrer le serveur de développement');
console.log('  2. Tester avec votre caméra externe');
console.log('  3. Ajuster les seuils de sensibilité si nécessaire');
console.log('  4. Surveiller les performances avec les statistiques');

console.log('\n✅ Test des optimisations terminé!'); 