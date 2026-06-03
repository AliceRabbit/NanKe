import path from 'node:path';
import { resolveDataDir } from '../db';

export function assetsRoot(): string {
  return path.join(resolveDataDir(), 'assets');
}
