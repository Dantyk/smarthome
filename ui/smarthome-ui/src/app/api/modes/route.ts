import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * GET /api/modes
 * Vráti aktuálny modes.yaml config
 */
export async function GET(request: NextRequest) {
  try {
    const configPath = path.join(process.cwd(), '../..', 'config', 'modes.yaml');
    const content = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(content);
    
    return NextResponse.json(config);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to load modes config', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/modes
 * Aktualizuje modes.yaml (vyžaduje opatrnosť - validácia cez JSON schema)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // TODO: Validate against config/modes.schema.json
    // For now, return not implemented
    return NextResponse.json(
      { error: 'Config updates not yet implemented - use file editing' },
      { status: 501 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Invalid request', message: error.message },
      { status: 400 }
    );
  }
}
