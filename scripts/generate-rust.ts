#!/usr/bin/env npx tsx
/**
 * Generate Rust operator definitions from operators.json
 *
 * This script generates Rust code that can be used to ensure
 * parity between the TypeScript and Rust evaluators.
 *
 * Usage: npx tsx scripts/generate-rust.ts > generated_operators.rs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const operatorsPath = join(__dirname, '..', 'operators.json');
const schema = JSON.parse(readFileSync(operatorsPath, 'utf-8'));

interface OperatorMeta {
    category: string;
    minArity: number;
    maxArity: number | null;
    returnType: string;
    description: string;
    hasSideEffects?: boolean;
}

interface CategoryMeta {
    description: string;
    target: string[];
}

// Filter to only Rust-targeted operators
const rustOperators: [string, OperatorMeta][] = Object.entries(
    schema.operators as Record<string, OperatorMeta>
).filter(([_, meta]) => {
    const cat = schema.categories[meta.category] as CategoryMeta;
    return cat?.target.includes('rust');
});

console.log(`// Auto-generated from operators.json
// DO NOT EDIT MANUALLY
// Generated: ${new Date().toISOString()}
// Total operators: ${rustOperators.length}

/// Operator metadata from the canonical operators.json
#[derive(Debug, Clone)]
pub struct OperatorMeta {
    pub name: &'static str,
    pub category: &'static str,
    pub min_arity: usize,
    pub max_arity: Option<usize>,
    pub return_type: &'static str,
    pub description: &'static str,
    pub has_side_effects: bool,
}

/// All operators that should be implemented in Rust
pub static CANONICAL_OPERATORS: &[OperatorMeta] = &[`);

for (const [name, meta] of rustOperators) {
    const maxArity = meta.maxArity === null ? 'None' : `Some(${meta.maxArity})`;
    const hasSideEffects = meta.hasSideEffects ? 'true' : 'false';
    console.log(`    OperatorMeta {
        name: "${name}",
        category: "${meta.category}",
        min_arity: ${meta.minArity},
        max_arity: ${maxArity},
        return_type: "${meta.returnType}",
        description: "${meta.description}",
        has_side_effects: ${hasSideEffects},
    },`);
}

console.log(`];

/// Check if an operator should be implemented in Rust
pub fn is_canonical_operator(name: &str) -> bool {
    CANONICAL_OPERATORS.iter().any(|op| op.name == name)
}

/// Get metadata for a canonical operator
pub fn get_canonical_operator(name: &str) -> Option<&'static OperatorMeta> {
    CANONICAL_OPERATORS.iter().find(|op| op.name == name)
}

/// Get all operators that are missing implementations
pub fn get_missing_operators(implemented: &[&str]) -> Vec<&'static str> {
    CANONICAL_OPERATORS
        .iter()
        .map(|op| op.name)
        .filter(|name| !implemented.contains(name))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_canonical_operators_count() {
        assert_eq!(CANONICAL_OPERATORS.len(), ${rustOperators.length});
    }

    #[test]
    fn test_all_categories_present() {
        let categories: std::collections::HashSet<_> = 
            CANONICAL_OPERATORS.iter().map(|op| op.category).collect();
        
        // Should have core categories
        assert!(categories.contains("arithmetic"));
        assert!(categories.contains("comparison"));
        assert!(categories.contains("logic"));
        assert!(categories.contains("control"));
        assert!(categories.contains("collection"));
    }
}
`);

// Print summary to stderr
console.error(`\n=== Rust Operator Generation Summary ===`);
console.error(`Total operators for Rust: ${rustOperators.length}`);

const byCategory: Record<string, number> = {};
for (const [_, meta] of rustOperators) {
    byCategory[meta.category] = (byCategory[meta.category] || 0) + 1;
}

console.error(`\nBy category:`);
for (const [cat, count] of Object.entries(byCategory).sort()) {
    console.error(`  ${cat}: ${count}`);
}
