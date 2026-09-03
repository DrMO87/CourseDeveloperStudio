import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const orgSlug = formData.get('orgSlug') as string;
    const logoType = (formData.get('logoType') as string) || 'primary'; // 'university' | 'faculty' | 'department' | 'primary'

    if (!file || !orgSlug) {
      return NextResponse.json({ success: false, error: 'Missing file or orgSlug' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const safeFileName = `${orgSlug}-${logoType}-logo.${ext}`;

    // 1. Save to Next.js public directory for instant web preview
    const publicDir = path.join(process.cwd(), 'public', 'logos', orgSlug);
    fs.mkdirSync(publicDir, { recursive: true });
    const publicFilePath = path.join(publicDir, safeFileName);
    fs.writeFileSync(publicFilePath, buffer);
    const webUrl = `/logos/${orgSlug}/${safeFileName}`;

    // 2. Save to Obsidian Vault Template Area assets
    const vaultTemplateAssetDir = path.join(process.cwd(), '..', 'obsidian-vault-template', '02_Areas', orgSlug, '_assets');
    fs.mkdirSync(vaultTemplateAssetDir, { recursive: true });
    fs.writeFileSync(path.join(vaultTemplateAssetDir, safeFileName), buffer);

    // 3. Save to any active cloned project vaults
    const vaultsBaseDir = path.join(process.cwd(), '..', 'vaults');
    if (fs.existsSync(vaultsBaseDir)) {
      const activeVaults = fs.readdirSync(vaultsBaseDir);
      for (const v of activeVaults) {
        const vAssetDir = path.join(vaultsBaseDir, v, '02_Areas', orgSlug, '_assets');
        if (fs.existsSync(path.join(vaultsBaseDir, v))) {
          fs.mkdirSync(vAssetDir, { recursive: true });
          fs.writeFileSync(path.join(vAssetDir, safeFileName), buffer);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      url: webUrl,
      fileName: safeFileName,
      path: publicFilePath 
    });
  } catch (err: any) {
    console.error('Logo upload error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
  
