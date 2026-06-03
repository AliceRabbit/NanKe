import fs from 'node:fs';
import path from 'node:path';
import { AssetStore } from '$lib/storage/assets/AssetStore';

function contentTypeFor(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

export function GET({ params }) {
  const asset = new AssetStore().get(params.id);
  if (!asset) return new Response('Asset not found.', { status: 404 });

  const bytes = fs.readFileSync(asset.path);
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': contentTypeFor(asset.originalName),
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}
