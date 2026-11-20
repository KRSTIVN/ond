import type { AngleUnit } from '../types';

export type EvalResult =
  | { readonly ok: true; readonly value: number; readonly formatted: string }
  | { readonly ok: false; readonly error: string };

type Token =
  | { readonly type: 'number'; readonly value: number }
  | { readonly type: 'ident'; readonly value: string }
  | { readonly type: 'op'; readonly value: string }
  | { readonly type: 'lparen' }
  | { readonly type: 'rparen' }
  | { readonly type: 'percent' };

const MAX_EXPRESSION_LENGTH = 512;
const MAX_NESTING_DEPTH = 64;

const CONSTANTS: Readonly<Record<string, number>> = {
  pi: Math.PI,
  π: Math.PI,
  e: Math.E,
};

const FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sqrt',
  'ln',
  'log',
  'abs',
]);

function normalizeOperator(ch: string): string | null {
  if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') return ch;
  if (ch === '×') return '*';
  if (ch === '÷') return '/';
  if (ch === '−') return '-';
  return null;
}

function tokenize(input: string): Token[] | string {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const ch = input[index]!;
    if (/\s/.test(ch)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      const start = index;
      let dotCount = 0;
      while (index < input.length && /[0-9.]/.test(input[index]!)) {
        if (input[index] === '.') dotCount += 1;
        index += 1;
      }
      if (dotCount > 1) return 'Malformed decimal number';
      const raw = input.slice(start, index);
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return 'Number out of range';
      tokens.push({ type: 'number', value: parsed });
      continue;
    }

    if (/[a-zA-Zπ√]/.test(ch)) {
      if (ch === '√') {
        tokens.push({ type: 'ident', value: 'sqrt' });
        index += 1;
        continue;
      }
      const start = index;
      while (index < input.length && /[a-zA-Zπ]/.test(input[index]!)) {
        index += 1;
      }
      tokens.push({ type: 'ident', value: input.slice(start, index).toLowerCase() });
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      index += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      index += 1;
      continue;
    }
    if (ch === '%') {
      tokens.push({ type: 'percent' });
      index += 1;
      continue;
    }

    const normalizedOp = normalizeOperator(ch);
    if (normalizedOp !== null) {
      tokens.push({ type: 'op', value: normalizedOp });
      index += 1;
      continue;
    }

    return `Unexpected character "${ch}"`;
  }

  return tokens;
}

function applyFunction(name: string, arg: number, angleUnit: AngleUnit): number {
  const toRad = angleUnit === 'deg' ? Math.PI / 180 : 1;
  const fromRad = angleUnit === 'deg' ? 180 / Math.PI : 1;

  switch (name) {
    case 'sin':
      return Math.sin(arg * toRad);
    case 'cos':
      return Math.cos(arg * toRad);
    case 'tan':
      if (Math.abs(Math.cos(arg * toRad)) < 1e-12) {
        throw new Error('Tangent is undefined at this angle');
      }
      return Math.tan(arg * toRad);
    case 'asin':
      return Math.asin(arg) * fromRad;
    case 'acos':
      return Math.acos(arg) * fromRad;
    case 'atan':
      return Math.atan(arg) * fromRad;
    case 'sqrt':
      if (arg < 0) throw new Error('Square root requires non-negative input');
      return Math.sqrt(arg);
    case 'ln':
      if (arg <= 0) throw new Error('Logarithm requires positive input');
      return Math.log(arg);
    case 'log':
      if (arg <= 0) throw new Error('Logarithm requires positive input');
      return Math.log10(arg);
    case 'abs':
      return Math.abs(arg);
    default:
      throw new Error(`Unknown function "${name}"`);
  }
}

class Parser {
  private pos = 0;
  private depth = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly angleUnit: AngleUnit,
  ) {}

  parse(): number {
    const value = this.parseAddSub();
    if (this.pos < this.tokens.length) {
      throw new Error('Unexpected trailing input');
    }
    return value;
  }

  private enterDepth(): void {
    this.depth += 1;
    if (this.depth > MAX_NESTING_DEPTH) {
      throw new Error('Expression nesting is too deep');
    }
  }

  private leaveDepth(): void {
    this.depth -= 1;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    const token = this.tokens[this.pos]!;
    this.pos += 1;
    return token;
  }

  private parseAddSub(): number {
    let left = this.parseMulDiv();
    while (true) {
      const next = this.peek();
      if (next?.type !== 'op' || (next.value !== '+' && next.value !== '-')) break;
      this.consume();
      const right = this.parseMulDiv();
      left = next.value === '+' ? left + right : left - right;
    }
    return left;
  }

  private parseMulDiv(): number {
    let left = this.parsePower();
    while (true) {
      const next = this.peek();
      const isImplicitMul =
        next?.type === 'lparen' || next?.type === 'ident' || next?.type === 'number';
      if (isImplicitMul) {
        left *= this.parsePower();
        continue;
      }
      if (next?.type !== 'op' || (next.value !== '*' && next.value !== '/')) break;
      this.consume();
      const right = this.parsePower();
      if (next.value === '/') {
        if (right === 0) throw new Error('Cannot divide by zero');
        left /= right;
        continue;
      }
      left *= right;
    }
    return left;
  }

  private parsePower(): number {
    const base = this.parseUnary();
    const next = this.peek();
    if (next?.type === 'op' && next.value === '^') {
      this.consume();
      this.enterDepth();
      try {
        const exponent = this.parsePower();
        return Math.pow(base, exponent);
      } finally {
        this.leaveDepth();
      }
    }
    return base;
  }

  private parseUnary(): number {
    const next = this.peek();
    if (next?.type === 'op' && (next.value === '+' || next.value === '-')) {
      this.consume();
      this.enterDepth();
      try {
        const value = this.parseUnary();
        return next.value === '-' ? -value : value;
      } finally {
        this.leaveDepth();
      }
    }
    return this.parsePostfix();
  }

  private parsePostfix(): number {
    let value = this.parsePrimary();
    while (this.peek()?.type === 'percent') {
      this.consume();
      value /= 100;
    }
    return value;
  }

  private parsePrimary(): number {
    const token = this.peek();
    if (!token) throw new Error('Incomplete expression');

    if (token.type === 'number') {
      this.consume();
      return token.value;
    }

    if (token.type === 'lparen') {
      this.consume();
      this.enterDepth();
      try {
        const inner = this.parseAddSub();
        if (this.peek()?.type !== 'rparen') throw new Error('Missing closing parenthesis');
        this.consume();
        return inner;
      } finally {
        this.leaveDepth();
      }
    }

    if (token.type === 'ident') {
      this.consume();
      const constant = CONSTANTS[token.value];
      if (constant !== undefined) return constant;

      if (!FUNCTIONS.has(token.value)) {
        throw new Error(`Unknown symbol "${token.value}"`);
      }
      this.enterDepth();
      try {
        if (this.peek()?.type !== 'lparen') {
          const arg = this.parseUnary();
          return applyFunction(token.value, arg, this.angleUnit);
        }
        this.consume();
        const arg = this.parseAddSub();
        if (this.peek()?.type !== 'rparen') throw new Error('Missing closing parenthesis');
        this.consume();
        return applyFunction(token.value, arg, this.angleUnit);
      } finally {
        this.leaveDepth();
      }
    }

    throw new Error('Invalid expression syntax');
  }
}

export function formatCalcNumber(value: number): string {
  if (!Number.isFinite(value)) return 'Error';
  const cleaned = Number(value.toPrecision(12));
  const normalized = Object.is(cleaned, -0) ? 0 : cleaned;
  if (Math.abs(normalized) >= 1e12 || (normalized !== 0 && Math.abs(normalized) < 1e-9)) {
    return normalized.toExponential(6).replace(/\.?0+e/, 'e');
  }
  return String(normalized);
}

/** Safely evaluate a mathematical expression without eval or Function. */
export function evaluateExpression(raw: string, angleUnit: AngleUnit = 'deg'): EvalResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Enter an expression' };
  }
  if (trimmed.length > MAX_EXPRESSION_LENGTH) {
    return { ok: false, error: 'Expression exceeds maximum length' };
  }

  const tokenized = tokenize(trimmed);
  if (typeof tokenized === 'string') {
    return { ok: false, error: tokenized };
  }
  if (tokenized.length === 0) {
    return { ok: false, error: 'Enter an expression' };
  }

  try {
    const parser = new Parser(tokenized, angleUnit);
    const result = parser.parse();
    if (!Number.isFinite(result)) {
      return { ok: false, error: 'Result is undefined or infinite' };
    }
    const clean = Number(result.toPrecision(12));
    return {
      ok: true,
      value: Object.is(clean, -0) ? 0 : clean,
      formatted: formatCalcNumber(result),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid expression';
    return { ok: false, error: message };
  }
}
