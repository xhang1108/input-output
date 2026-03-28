import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
    try {
        const templatesDir = path.join(process.cwd(), 'src/templates');
        
        // Ensure directory exists
        try {
            await fs.access(templatesDir);
        } catch {
            return NextResponse.json({ success: true, templates: [] });
        }

        const files = await fs.readdir(templatesDir);
        const ioglFiles = files.filter(f => f.endsWith('.iogl'));
        
        const templates = await Promise.all(
            ioglFiles.map(async (filename) => {
                const filePath = path.join(templatesDir, filename);
                const content = await fs.readFile(filePath, 'utf-8');
                const name = filename.replace(/\.iogl$/i, '');
                return { name, content };
            })
        );

        return NextResponse.json({ success: true, templates });
    } catch (error) {
        console.error('[API] Failed to read templates:', error);
        return NextResponse.json({ success: false, error: 'Failed to read templates' }, { status: 500 });
    }
}
