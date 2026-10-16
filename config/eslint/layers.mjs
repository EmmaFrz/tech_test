import { readdirSync } from 'node:fs';

const featureNames = readdirSync(new URL('../../src/features/', import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

export const layerZones = [
  { target: './src/domain', from: './src', except: ['./domain', './lib'] },
  { target: './src/lib', from: './src', except: ['./lib'] },
  { target: './src/ui', from: './src', except: ['./ui', './lib'] },
  { target: './src/data', from: './src', except: ['./data', './domain', './lib'] },
  { target: './src/store', from: './src', except: ['./store', './domain', './lib'] },
  { target: './src/features', from: ['./src/app', './src/data'] },
  { target: './shared', from: ['./src', './mock-server'] },
  { target: './mock-server', from: './src' },
  { target: './src', from: './mock-server' },
  ...featureNames.flatMap((target) =>
    featureNames
      .filter((source) => source !== target)
      .map((source) => ({
        target: `./src/features/${target}`,
        from: `./src/features/${source}`,
        except: ['./index.ts'],
        message: 'Import a feature through its index.ts public API.',
      })),
  ),
];
