
/**
 * MATH_ALIASES
 * 
 * Central mapping of alternative mathematical notations to their primary 
 * Canonical representation in the engine.
 */
export const MATH_ALIASES: Record<string, string> = {
    // Trigonometric & Inverse
    'sgn': 'sign',
    'arctan': 'atan',
    'arctg': 'atan',
    'tg': 'tan',
    'ctg': 'cot',
    'arcctg': 'acot',

    // Hyperbolic (Russian/German/International)
    'sh': 'sinh',
    'ch': 'cosh',
    'th': 'tanh',
    'cth': 'coth',

    // Logarithms
    'ln': 'log',
    'lg': 'log10',

    // Others
    'arcsin': 'asin',
    'arccos': 'acos'
};

