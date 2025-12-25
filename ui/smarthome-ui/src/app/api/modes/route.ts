import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import Ajv, { type ValidateFunction } from 'ajv';

// Load and compile JSON schema once at module level
let validateModes: ValidateFunction | null = null;

function getValidator(): ValidateFunction {
  if (!validateModes) {
    const ajv = new Ajv({ allErrors: true });
    const schemaPath = path.join(process.cwd(), '../..', 'config', 'modes.schema.json');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaContent);
    validateModes = ajv.compile(schema);
  }
  return validateModes;
}

/**
 * GET /api/modes
 * Vráti aktuálny modes.yaml config
 */
export async function GET(request: NextRequest) {
  try {
    const configPath = path.join(process.cwd(), '../..', 'config', 'modes.yaml');
    const content = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(content);
    
    // Validate against schema
    const validate = getValidator();
    const isValid = validate(config);
    
    if (!isValid) {
      return NextResponse.json(
        { 
          error: 'Config validation failed', 
          errors: validate.errors 
        },
        { status: 500 }
      );
    }
    
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
 * Aktualizuje modes.yaml s validáciou cez JSON schema
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate against schema
    const validate = getValidator();
    const isValid = validate(body);
    
    if (!isValid) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          errors: validate.errors 
        },
        { status: 400 }
      );
    }
    
    // Write to file (in production, consider atomic writes)
    const configPath = path.join(process.cwd(), '../..', 'config', 'modes.yaml');
    const yamlContent = yaml.dump(body, { indent: 2, lineWidth: 120 });
    fs.writeFileSync(configPath, yamlContent, 'utf8');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Config updated successfully. Changes will be picked up by config-watcher.' 
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Invalid request', message: error.message },
      { status: 400 }
    );
  }
}
