#!/usr/bin/env npx tsx
/**
 * Operator Parity Test
 *
 * Validates that operators.json is aligned with:
 * - almadar-core/types/operators.ts
 * - almadar-std/registry.ts (STD_OPERATORS)
 * - orbital-rust/evaluator/operators.rs
 *
 * Run: npx tsx tests/parity-check.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..', '..');

// Load canonical operators
const operatorsPath = join(__dirname, '..', 'operators.json');
const canonical = JSON.parse(readFileSync(operatorsPath, 'utf-8'));

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

const canonicalOps = canonical.operators as Record<string, OperatorMeta>;
const categories = canonical.categories as Record<string, CategoryMeta>;

// Get operators by target platform
function getOperatorsForTarget(target: string): string[] {
    return Object.entries(canonicalOps)
        .filter(([_, meta]) => {
            const cat = categories[meta.category];
            return cat?.target.includes(target);
        })
        .map(([name]) => name)
        .sort();
}

// Extract operators from almadar-core
function getCoreOperators(): string[] {
    const corePath = join(rootDir, 'packages/almadar-core/src/types/operators.ts');
    if (!existsSync(corePath)) {
        console.error('⚠️ almadar-core operators.ts not found');
        return [];
    }
    const content = readFileSync(corePath, 'utf-8');
    const matches = content.matchAll(/^\s+['"]([^'"]+)['"]\s*:\s*\{/gm);
    return [...matches].map(m => m[1]).sort();
}

// Extract operators from orbital-rust
function getRustOperators(): string[] {
    const rustPath = join(rootDir, 'orbital-rust/crates/orbital-core/src/evaluator/operators.rs');
    if (!existsSync(rustPath)) {
        console.error('⚠️ orbital-rust operators.rs not found');
        return [];
    }
    const content = readFileSync(rustPath, 'utf-8');
    // Match all operators in the dispatch: "operator" => or "op" | "alias" =>
    // Captures: +, -, *, /, %, =, !=, <, >, <=, >=, and, or, not, array/map, etc.
    const matches = content.matchAll(/"([^"]+)"\s*(?:=>|\|)/g);
    return [...new Set([...matches].map(m => m[1]))].sort();
}

// Compare arrays
function findMissing(canonical: string[], actual: string[]): string[] {
    const actualSet = new Set(actual);
    return canonical.filter(op => !actualSet.has(op));
}

function findExtra(canonical: string[], actual: string[]): string[] {
    const canonicalSet = new Set(canonical);
    return actual.filter(op => !canonicalSet.has(op));
}

// Main
console.log('=== Operator Parity Check ===\n');
console.log(`Canonical operators.json: ${Object.keys(canonicalOps).length} operators\n`);

// TypeScript target
const tsOps = getOperatorsForTarget('ts');
console.log(`TypeScript target: ${tsOps.length} operators`);

// Rust target
const rustTargetOps = getOperatorsForTarget('rust');
console.log(`Rust target: ${rustTargetOps.length} operators`);

// Python target (nn/tensor/train)
const pythonOps = getOperatorsForTarget('python');
console.log(`Python target: ${pythonOps.length} operators\n`);

// Check almadar-core
console.log('--- almadar-core/types/operators.ts ---');
const coreOps = getCoreOperators();
console.log(`Found: ${coreOps.length} operators`);

// Core should have non-std operators (no / in name)
const coreTargetOps = tsOps.filter(op => !op.includes('/'));
const coreMissing = findMissing(coreTargetOps, coreOps);
const coreExtra = findExtra(coreTargetOps, coreOps);

if (coreMissing.length > 0) {
    console.log(`❌ Missing in almadar-core (${coreMissing.length}):`, coreMissing.slice(0, 10).join(', '));
}
if (coreExtra.length > 0) {
    console.log(`⚠️ Extra in almadar-core (not in canonical):`, coreExtra.slice(0, 10).join(', '));
}
if (coreMissing.length === 0 && coreExtra.length === 0) {
    console.log('✅ Fully aligned with canonical');
}

// Check orbital-rust
console.log('\n--- orbital-rust/evaluator/operators.rs ---');
const rustOps = getRustOperators();
console.log(`Found: ${rustOps.length} operators`);

const rustMissing = findMissing(rustTargetOps, rustOps);
const rustExtra = findExtra(rustTargetOps, rustOps);

if (rustMissing.length > 0) {
    console.log(`❌ Missing in Rust (${rustMissing.length}):`);
    // Group by category
    const byCategory: Record<string, string[]> = {};
    for (const op of rustMissing) {
        const cat = canonicalOps[op]?.category || 'unknown';
        byCategory[cat] = byCategory[cat] || [];
        byCategory[cat].push(op);
    }
    for (const [cat, ops] of Object.entries(byCategory)) {
        console.log(`  ${cat}: ${ops.join(', ')}`);
    }
}
if (rustExtra.length > 0) {
    console.log(`⚠️ Extra in Rust (not in canonical): ${rustExtra.slice(0, 10).join(', ')}`);
}
if (rustMissing.length === 0) {
    console.log('✅ Fully aligned with canonical');
}

// Summary
console.log('\n=== Summary ===');
console.log(`almadar-core: ${coreMissing.length === 0 ? '✅' : '❌'} ${coreOps.length}/${coreTargetOps.length} operators`);
console.log(`orbital-rust: ${rustMissing.length === 0 ? '✅' : '❌'} ${rustOps.length}/${rustTargetOps.length} operators`);

if (rustMissing.length > 0) {
    console.log(`\n🔧 To reach Rust parity, implement these ${rustMissing.length} operators in orbital-rust.`);
}
