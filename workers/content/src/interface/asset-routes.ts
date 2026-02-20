import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  createAsset,
  deleteAsset,
  findAllAssets,
  findAssetById,
  listAssetFolders,
} from '../infrastructure/repositories/asset-repository.js';

export const assetRoutes = new Hono<Env>();

// POST /api/v1/content/assets - Upload asset (multipart form data)
assetRoutes.post('/api/v1/content/assets', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;
    const folder = formData.get('folder') as string | null;

    if (!file) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'file is required' },
        400,
      );
    }

    const fileName = file.name;
    const mimeType = file.type || 'application/octet-stream';
    const size = file.size;
    const assetId = crypto.randomUUID();

    // R2 key pattern: {organizationId}/{assetId}/{fileName}
    const r2Key = `${tenant.organizationId}/${assetId}/${fileName}`;

    // Upload to R2
    const r2 = c.env.ASSETS;
    await r2.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: mimeType,
      },
      customMetadata: {
        organizationId: tenant.organizationId,
        assetId,
        originalName: fileName,
      },
    });

    // Store asset metadata in DB
    const asset = await createAsset(db, tenant.organizationId, {
      name: name ?? fileName,
      fileKey: r2Key,
      mimeType,
      sizeBytes: size,
      folder: folder ?? null,
      createdBy: tenant.userId,
    });

    return c.json(asset, 201);
  } catch (error) {
    console.error('Upload asset error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to upload asset' },
      500,
    );
  }
});

// GET /api/v1/content/assets - List assets
assetRoutes.get('/api/v1/content/assets', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '25', folder } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const result = await findAllAssets(db, tenant.organizationId, {
      page: pageNum,
      limit: limitNum,
      folder: folder || undefined,
    });

    return c.json({
      data: result.data,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (error) {
    console.error('List assets error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list assets' },
      500,
    );
  }
});

// GET /api/v1/content/assets/folders - List asset folders
assetRoutes.get('/api/v1/content/assets/folders', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const folders = await listAssetFolders(db, tenant.organizationId);
    return c.json(folders);
  } catch (error) {
    console.error('List asset folders error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list folders' },
      500,
    );
  }
});

// GET /api/v1/content/assets/:id - Get asset metadata
assetRoutes.get('/api/v1/content/assets/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const asset = await findAssetById(db, tenant.organizationId, id);
    if (!asset) {
      return c.json({ code: 'NOT_FOUND', message: 'Asset not found' }, 404);
    }
    return c.json(asset);
  } catch (error) {
    console.error('Get asset error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get asset' },
      500,
    );
  }
});

// DELETE /api/v1/content/assets/:id - Delete asset from R2 + DB
assetRoutes.delete('/api/v1/content/assets/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    // Get asset to find R2 key
    const asset = await findAssetById(db, tenant.organizationId, id);
    if (!asset) {
      return c.json({ code: 'NOT_FOUND', message: 'Asset not found' }, 404);
    }

    // Delete from R2
    const r2 = c.env.ASSETS;
    await r2.delete(asset.fileKey);

    // Delete from DB
    await deleteAsset(db, tenant.organizationId, id);

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete asset error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete asset' },
      500,
    );
  }
});

// GET /api/v1/content/assets/:id/download - Download asset (stream from R2)
assetRoutes.get('/api/v1/content/assets/:id/download', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const asset = await findAssetById(db, tenant.organizationId, id);
    if (!asset) {
      return c.json({ code: 'NOT_FOUND', message: 'Asset not found' }, 404);
    }

    // Get from R2
    const r2 = c.env.ASSETS;
    const object = await r2.get(asset.fileKey);

    if (!object) {
      return c.json(
        { code: 'NOT_FOUND', message: 'Asset file not found in storage' },
        404,
      );
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': asset.mimeType,
        'Content-Disposition': `attachment; filename="${asset.name}"`,
        'Content-Length': String(asset.sizeBytes),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Download asset error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to download asset' },
      500,
    );
  }
});
