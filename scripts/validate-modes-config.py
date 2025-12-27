#!/usr/bin/env python3
"""
Config Validation Script
Validates modes.yaml against modes.schema.json
"""

import json
import sys
import yaml
from pathlib import Path
from jsonschema import validate, ValidationError, Draft7Validator

def main():
    """Validate modes.yaml against schema"""
    repo_root = Path(__file__).parent.parent
    
    # Load schema
    schema_path = repo_root / "config" / "modes.schema.json"
    with open(schema_path) as f:
        schema = json.load(f)
    
    # Load and convert modes.yaml
    modes_path = repo_root / "config" / "modes.yaml"
    with open(modes_path) as f:
        modes_data = yaml.safe_load(f)
    
    # Validate
    try:
        validator = Draft7Validator(schema)
        errors = list(validator.iter_errors(modes_data))
        
        if errors:
            print("❌ Validation FAILED:")
            for error in errors:
                path = ".".join(str(p) for p in error.path)
                print(f"  • {path}: {error.message}")
            sys.exit(1)
        else:
            print("✅ modes.yaml is valid against schema")
            sys.exit(0)
            
    except ValidationError as e:
        print(f"❌ Validation error: {e.message}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(2)

if __name__ == "__main__":
    main()
