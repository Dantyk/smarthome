/**
 * Config Validator pre modes.yaml
 * 
 * Validuje modes.yaml konfiguráciu pri štarte.
 * Zabezpečuje, že:
 * - Všetky režimy majú platné názvy
 * - Priority sú správne čísla
 * - Miestnosti majú target_temp v rozsahu 10-30°C
 * - Dátumové rozsahy sú platné
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const yaml = require('js-yaml');

// Load schema
const schemaPath = path.join(__dirname, '../../../config/modes.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

// Load config
const configPath = path.join(__dirname, '../../../config/modes.yaml');
const config = yaml.load(fs.readFileSync(configPath, 'utf-8'));

// Validate
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);
const valid = validate(config);

if (!valid) {
  console.error('❌ modes.yaml validation failed:');
  validate.errors.forEach(err => {
    console.error(`  - ${err.instancePath}: ${err.message}`);
  });
  process.exit(1);
}

console.log('✅ modes.yaml validated successfully');

// Additional semantic validations
const modes = config.modes || [];
const modeNames = modes.map(m => m.name);

// Check for duplicate mode names
const duplicates = modeNames.filter((name, i) => modeNames.indexOf(name) !== i);
if (duplicates.length > 0) {
  console.error(`❌ Duplicate mode names found: ${duplicates.join(', ')}`);
  process.exit(1);
}

// Check priority conflicts (same priority and overlapping dates)
for (let i = 0; i < modes.length; i++) {
  for (let j = i + 1; j < modes.length; j++) {
    if (modes[i].priority === modes[j].priority) {
      console.warn(`⚠️  Modes "${modes[i].name}" and "${modes[j].name}" have same priority ${modes[i].priority}`);
    }
  }
}

console.log(`✅ Validated ${modes.length} modes`);
