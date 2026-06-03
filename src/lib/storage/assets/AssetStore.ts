import fs from 'node:fs';
import path from 'node:path';
import { resolveDataDir } from '../db';

export type StoredAsset = {
  id: string;
  path: string;
  originalName: string;
};

export class AssetStore {
  constructor(private readonly root = path.join(resolveDataDir(), 'assets')) {}

  save(bytes: Uint8Array, originalName: string): StoredAsset {
    const id = crypto.randomUUID();
    const safeName = originalName.replace(/[^\w.-]+/g, '_') || 'asset.bin';
    const directory = path.join(this.root, id.slice(0, 2));
    fs.mkdirSync(directory, { recursive: true });
    const filePath = path.join(directory, `${id}-${safeName}`);
    fs.writeFileSync(filePath, bytes);
    return { id, path: filePath, originalName };
  }

  get(id: string): StoredAsset | undefined {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) return undefined;

    const directory = path.join(this.root, id.slice(0, 2));
    if (!fs.existsSync(directory)) return undefined;

    const fileName = fs.readdirSync(directory).find((item) => item.startsWith(`${id}-`));
    if (!fileName) return undefined;

    return {
      id,
      path: path.join(directory, fileName),
      originalName: fileName.slice(id.length + 1)
    };
  }
}
