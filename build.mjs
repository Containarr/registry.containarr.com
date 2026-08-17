import fs from 'fs/promises';
import path from 'path';

import Ajv2020 from 'ajv/dist/2020.js';

const appsDirectory = path.join(process.cwd(), 'apps');
const serviceSchema = JSON.parse(await fs.readFile(path.join(appsDirectory, 'service.schema.json'), 'utf-8'));
const validateService = new Ajv2020({ allErrors: true }).compile(serviceSchema);

// Read and validate every app before replacing the last successful build.
const appsIndex = {};
const apps = await fs.readdir(appsDirectory, { withFileTypes: true });

for (const app of apps) {
  if (!app.isDirectory() || app.name.startsWith('.')) continue;

  const appId = app.name;
  const appFile = path.join(appsDirectory, appId, `${appId}.json`);
  let appJson;

  try {
    appJson = JSON.parse(await fs.readFile(appFile, 'utf-8'));
  } catch (error) {
    throw new Error(`Unable to parse apps/${appId}/${appId}.json: ${error.message}`);
  }

  if (!validateService(appJson)) {
    const errors = validateService.errors
      .map(error => `  ${error.instancePath || '/'} ${error.message}`)
      .join('\n');
    throw new Error(`Schema validation failed for apps/${appId}/${appId}.json:\n${errors}`);
  }

  appsIndex[appId] = appJson;
}

// Ensure ./build
await fs.rm(path.join(process.cwd(), 'build'), { recursive: true, force: true });
await fs.mkdir(path.join(process.cwd(), 'build'), { recursive: true });

// Build Apps
await fs.copyFile(path.join(appsDirectory, 'service.schema.json'), path.join(process.cwd(), 'build', 'service.schema.json'));

for (const appId of Object.keys(appsIndex)) {
  await fs.copyFile(path.join(process.cwd(), 'apps', appId, `${appId}.png`), path.join(process.cwd(), 'build', `${appId}.png`));
}

await fs.writeFile(path.join(process.cwd(), 'build', 'index.json'), JSON.stringify(appsIndex, null, 2), 'utf-8');
await fs.writeFile(path.join(process.cwd(), 'build', 'CNAME'), 'registry.containarr.com\n', 'utf-8');
