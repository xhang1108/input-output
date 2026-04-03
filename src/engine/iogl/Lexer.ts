import { IOGLUtils } from './IOGLUtils';

export type TokenType =
  | 'LBRACKET' | 'RBRACKET'  // []
  | 'LBRACE' | 'RBRACE'      // {}
  | 'LPAREN' | 'RPAREN'      // ()
  | 'ID'                     // Labels, Node IDs, Handle IDs
  | 'BRACKETED_ID'           // [Label with spaces] or [[Matrix]]
  | 'COLON'                  // :
  | 'AT'                     // @
  | 'COMMA'                  // ,
  | 'EQUALS'                 // =
  | 'ARROW'                  // ->
  | 'NUMBER'                 // Numeric literals
  | 'RAW_VALUE'              // Values inside {} or after =
  | 'NEWLINE'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

export class Lexer {
  private pos = 0;
  private line = 1;
  private col = 1;
  private tokens: Token[] = [];
  private currentTokenIdx = 0;

  constructor(private input: string) {
    this.tokenizeAll();
  }

  private tokenizeAll() {
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      const char = this.input[this.pos];

      if (char === '\n') {
        this.tokens.push({ type: 'NEWLINE', value: '\n', line: this.line, col: this.col });
        this.advanceChars(1);
        continue;
      }

      // 1. Comments
      if (char === '#' && (this.pos === 0 || /[ \t\n\r]/.test(this.input[this.pos - 1]))) {
        const next = this.input[this.pos + 1];
        const isHex = next && /[0-9A-Fa-f]/.test(next);
        
        if (!isHex) {
            while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
                this.pos++;
            }
            continue;
        }
      }

      // Arrows
      if (this.input.startsWith('->', this.pos)) {
        this.tokens.push({ type: 'ARROW', value: '->', line: this.line, col: this.col });
        this.advanceChars(2);
        continue;
      }

      // 2. Bracketed Identifier
      if (char === '[') {
        this.tokens.push(this.readBracketedID());
        continue;
      }

      // Single-character tokens
      const singles: Record<string, TokenType> = {
        ']': 'RBRACKET',
        '{': 'LBRACE', '}': 'RBRACE',
        '(': 'LPAREN', ')': 'RPAREN',
        ':': 'COLON', '@': 'AT',
        ',': 'COMMA', '=': 'EQUALS'
      };

      if (singles[char]) {
        this.tokens.push({ type: singles[char], value: char, line: this.line, col: this.col });
        this.advanceChars(1);
        continue;
      }

      // Quoted Strings
      if (char === '"') {
        this.tokens.push(this.readQuotedString());
        continue;
      }

      // Numbers
      if (/[0-9]/.test(char) || (char === '-' && /[0-9]/.test(this.input[this.pos + 1] || ''))) {
        this.tokens.push(this.readNumber());
        continue;
      }

      // 3. Dot-prefixed identifiers (shorthands like .a, .out)
      if (char === '.') {
        this.tokens.push(this.readIdentifier());
        continue;
      }

      // 4. Identifiers
      if (/[a-zA-Z_\-\.#]/.test(char)) {
        this.tokens.push(this.readIdentifier());
        continue;
      }

      this.advanceChars(1);
    }
    this.tokens.push({ type: 'EOF', value: '', line: this.line, col: this.col });
  }

  private advanceChars(n: number) {
    for (let i = 0; i < n; i++) {
      if (this.input[this.pos] === '\n') {
        this.line++;
        this.col = 1;
      } else {
        this.col++;
      }
      this.pos++;
    }
  }

  private skipWhitespace() {
    while (this.pos < this.input.length && /[ \t\r]/.test(this.input[this.pos])) {
      this.advanceChars(1);
    }
  }

  private readQuotedString(): Token {
    const startLine = this.line;
    const startCol = this.col;
    const startPos = this.pos;
    
    // 1. Find the closing quote, respecting escapes
    this.advanceChars(1); // Skip opening "
    while (this.pos < this.input.length) {
      if (this.input[this.pos] === '"') {
        // Count preceding backslashes to check if this quote is escaped
        let backslashes = 0;
        let i = this.pos - 1;
        while (i >= 0 && this.input[i] === '\\') {
          backslashes++;
          i--;
        }
        if (backslashes % 2 === 0) break; // Even number = quote is NOT escaped (or escape is double-escaped)
      }
      this.advanceChars(1);
    }
    
    if (this.pos < this.input.length) {
      this.advanceChars(1); // Skip closing "
    } else {
      // Unclosed string: return what we have (parser will handle)
      console.warn(`[Lexer] Unclosed quoted string at ${startLine}:${startCol}`);
    }
    
    const raw = this.input.substring(startPos, this.pos);
    
    // 2. Unescape using centralized utility (JSON Standard compliant)
    const val = IOGLUtils.unescapeString(raw);
    return { type: 'RAW_VALUE', value: val, line: startLine, col: startCol };
  }

  private readBracketedID(): Token {
    const startLine = this.line;
    const startCol = this.col;
    let val = '';
    let depth = 0;
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      val += char;
      if (char === '[') depth++;
      else if (char === ']') depth--;
      this.advanceChars(1);
      if (depth === 0) break;
    }
    return { type: 'BRACKETED_ID', value: val, line: startLine, col: startCol };
  }

  private readIdentifier(): Token {
    const startLine = this.line;
    const startCol = this.col;
    let val = '';
    // If it starts with a dot, consume it first
    if (this.input[this.pos] === '.') {
      val += '.';
      this.advanceChars(1);
    }
    while (this.pos < this.input.length && /[a-zA-Z0-9_\-\.\$#]/.test(this.input[this.pos])) {
      val += this.input[this.pos];
      this.advanceChars(1);
    }
    return { type: 'ID', value: val, line: startLine, col: startCol };
  }

  private readNumber(): Token {
    const startLine = this.line;
    const startCol = this.col;
    let val = '';
    if (this.input[this.pos] === '-') {
      val += '-';
      this.advanceChars(1);
    }
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      const next = this.input[this.pos + 1] || '';
      if (/[0-9\.]/.test(char)) {
        val += char;
        this.advanceChars(1);
      } else if (/[eE]/.test(char) && /[0-9\-\+]/.test(next)) {
        val += char;
        this.advanceChars(1);
        if (/[-\+]/.test(this.input[this.pos])) {
          val += this.input[this.pos];
          this.advanceChars(1);
        }
      } else {
        break;
      }
    }
    return { type: 'NUMBER', value: val, line: startLine, col: startCol };
  }

  public nextToken(): Token {
    return this.tokens[this.currentTokenIdx++] || this.tokens[this.tokens.length - 1];
  }

  public peek(n: number = 0): Token {
    return this.tokens[this.currentTokenIdx + n] || this.tokens[this.tokens.length - 1];
  }

  public backtrack(n: number = 1) {
    this.currentTokenIdx -= n;
  }
}

