/**
 * Almadar Operators - Single Source of Truth
 *
 * This package defines all S-expression operators used across:
 * - almadar-core (TypeScript types)
 * - almadar-evaluator (TypeScript runtime)
 * - almadar-std (TypeScript metadata)
 * - orbital-rust (Rust evaluator)
 *
 * @packageDocumentation
 */

import operators from '../operators.json' with { type: 'json' };

// ============================================================================
// Types
// ============================================================================

export type OperatorCategory =
    | 'arithmetic'
    | 'comparison'
    | 'logic'
    | 'control'
    | 'effect'
    | 'collection'
    | 'std-math'
    | 'std-str'
    | 'std-array'
    | 'std-object'
    | 'std-time'
    | 'std-validate'
    | 'std-format'
    | 'std-async'
    | 'std-nn'
    | 'std-tensor'
    | 'std-train'
    | 'std-prob'
    | 'std-os'
    | 'std-agent';

export type TargetPlatform = 'ts' | 'rust' | 'python';

export interface CategoryMeta {
    description: string;
    target: TargetPlatform[];
}

export interface OperatorMeta {
    category: OperatorCategory;
    minArity: number;
    maxArity: number | null;
    returnType: string;
    description: string;
    hasSideEffects?: boolean;
}

export interface OperatorsSchema {
    version: string;
    description: string;
    categories: Record<string, CategoryMeta>;
    operators: Record<string, OperatorMeta>;
}

// ============================================================================
// Exports
// ============================================================================

/** The canonical operators schema */
export const OPERATORS_SCHEMA = operators as OperatorsSchema;

/** All operator definitions */
export const OPERATORS = OPERATORS_SCHEMA.operators;

/** All category definitions */
export const CATEGORIES = OPERATORS_SCHEMA.categories;

/** All operator names */
export const OPERATOR_NAMES = Object.keys(OPERATORS);

/** Get operator metadata */
export function getOperatorMeta(name: string): OperatorMeta | undefined {
    return OPERATORS[name];
}

/** Check if operator exists */
export function isKnownOperator(name: string): boolean {
    return name in OPERATORS;
}

/** Check if operator has side effects */
export function isEffectOperator(name: string): boolean {
    const meta = OPERATORS[name];
    return meta?.hasSideEffects === true;
}

/** Check if operator can be used in guards (no side effects) */
export function isGuardOperator(name: string): boolean {
    const meta = OPERATORS[name];
    return meta !== undefined && !meta.hasSideEffects;
}

/** Get all operators in a category */
export function getOperatorsByCategory(category: OperatorCategory): string[] {
    return Object.entries(OPERATORS)
        .filter(([_, meta]) => meta.category === category)
        .map(([name]) => name);
}

/** Get operators for a target platform */
export function getOperatorsForTarget(target: TargetPlatform): string[] {
    return Object.entries(OPERATORS)
        .filter(([_, meta]) => {
            const cat = CATEGORIES[meta.category];
            return cat?.target.includes(target);
        })
        .map(([name]) => name);
}

/** Validate operator arity */
export function validateOperatorArity(
    name: string,
    argCount: number
): string | null {
    const meta = OPERATORS[name];
    if (!meta) return `Unknown operator: ${name}`;

    if (argCount < meta.minArity) {
        return `Operator '${name}' requires at least ${meta.minArity} argument(s), got ${argCount}`;
    }

    if (meta.maxArity !== null && argCount > meta.maxArity) {
        return `Operator '${name}' accepts at most ${meta.maxArity} argument(s), got ${argCount}`;
    }

    return null;
}

// ============================================================================
// Stats
// ============================================================================

export interface OperatorStats {
    total: number;
    byCategory: Record<string, number>;
    byTarget: Record<TargetPlatform, number>;
    withSideEffects: number;
}

export function getOperatorStats(): OperatorStats {
    const byCategory: Record<string, number> = {};
    const byTarget: Record<TargetPlatform, number> = { ts: 0, rust: 0, python: 0 };
    let withSideEffects = 0;

    for (const [name, meta] of Object.entries(OPERATORS)) {
        // By category
        byCategory[meta.category] = (byCategory[meta.category] || 0) + 1;

        // By target
        const cat = CATEGORIES[meta.category];
        if (cat) {
            for (const target of cat.target) {
                byTarget[target]++;
            }
        }

        // Side effects
        if (meta.hasSideEffects) withSideEffects++;
    }

    return {
        total: OPERATOR_NAMES.length,
        byCategory,
        byTarget,
        withSideEffects,
    };
}
