
export type TokenType =
  | 'LBRACKET' | 'RBRACKET'  // []
  | 'LBRACE' | 'RBRACE'      // {}
  | 'ID'                     // Labels, Node IDs, Handle IDs
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

      // 1. Comments (Starts with # followed by space OR at start of line followed by space)
      // Special case: If # is followed by a hex digit [0-9A-Fa-f], it's an ID (color hex), not a comment.
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

      // Single-character tokens
      const singles: Record<string, TokenType> = {
        '[': 'LBRACKET', ']': 'RBRACKET',
        '{': 'LBRACE', '}': 'RBRACE',
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

      // Numbers (Scientific notation support)
      if (/[0-9]/.test(char) || (char === '-' && /[0-9]/.test(this.input[this.pos + 1] || ''))) {
        this.tokens.push(this.readNumber());
        continue;
      }

      // Identifiers
      if (/[a-zA-Z_\-\.#]/.test(char)) {
        this.tokens.push(this.readIdentifier());
        continue;
      }

      // Skip unknown
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

  private skipComment() {
    while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
      this.advanceChars(1);
    }
  }

  private readQuotedString(): Token {
    const startLine = this.line;
    const startCol = this.col;
    this.advanceChars(1); // skip "
    let val = '';
    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      if (this.input[this.pos] === '\\' && this.input[this.pos + 1] === '"') {
        val += '"';
        this.advanceChars(2);
      } else {
        val += this.input[this.pos];
        this.advanceChars(1);
      }
    }
    if (this.input[this.pos] === '"') this.advanceChars(1);
    return { type: 'RAW_VALUE', value: val, line: startLine, col: startCol };
  }

  private readIdentifier(): Token {
    const startLine = this.line;
    const startCol = this.col;
    let val = '';
    // Identifiers can contain numbers, but not START with them (handled by tokenizeAll)
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
        val += char; // Consume 'e'
        this.advanceChars(1);
        if (/[-\+]/.test(this.input[this.pos])) {
          val += this.input[this.pos]; // Consume +/-
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
