import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';

const REPOS = [
  { name: 'nest', url: 'https://github.com/nestjs/nest.git', branch: 'master' },
  { name: 'express', url: 'https://github.com/expressjs/express.git', branch: 'master' },
  { name: 'axios', url: 'https://github.com/axios/axios.git', branch: 'v1.x' },
  { name: 'vite', url: 'https://github.com/vitejs/vite.git', branch: 'main' }
];

const TMP_DIR = '/tmp/architect-benchmarks';
const RESULTS_DIR = resolve('./benchmarks');

function run() {
  console.log('🚀 Starting OSS Benchmark Calibration...');

  if (!existsSync(TMP_DIR)) {
    mkdirSync(TMP_DIR, { recursive: true });
  }
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }

  // Ensure CLI is built
  console.log('📦 Compiling Architect CLI...');
  execSync('npm run build', { stdio: 'inherit' });

  const results: any[] = [];

  for (const repo of REPOS) {
    const repoPath = join(TMP_DIR, repo.name);
    
    // Clone or pull
    if (!existsSync(repoPath)) {
      console.log(`\n📥 Cloning ${repo.name}...`);
      execSync(`git clone --depth 1 --branch ${repo.branch} ${repo.url} ${repoPath}`, { stdio: 'inherit' });
    } else {
      console.log(`\n🔄 Updating ${repo.name}...`);
      execSync(`git -C ${repoPath} pull origin ${repo.branch}`, { stdio: 'inherit' });
    }

    // Run scanner
    const resultFile = join(RESULTS_DIR, `${repo.name}-report.json`);
    console.log(`\n🔍 Scanning ${repo.name} with Architect...`);
    
    try {
      execSync(`node ./dist/adapters/cli.js analyze ${repoPath} --format json --output ${resultFile}`, { stdio: 'inherit' });
      console.log(`✅ Scan complete for ${repo.name}`);
      
      const raw = readFileSync(resultFile, 'utf8');
      
      // The CLI outputs progress to stderr, and purely JSON to stdout when using -f json.
      // Let's parse the JSON.
      const report = JSON.parse(raw);
      results.push({ name: repo.name, report });
    } catch (e: any) {
      console.error(`❌ Failed to scan ${repo.name}:`, e.message);
    }
  }

  // Write aggregate
  writeFileSync(join(RESULTS_DIR, 'aggregate.json'), JSON.stringify(results, null, 2));
  console.log(`\n🎉 Benchmark scan complete! Run report generator to see results.`);
}

run();
