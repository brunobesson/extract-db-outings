/**
 * Openlayers is not using imports the right way for node. This is an extract to handle WKT parser.
 * https://github.com/openlayers/openlayers
 */

/**
 * @const
 * @type {string}
 */
const EMPTY = 'EMPTY';

/**
 * @const
 * @type {string}
 */
const Z = 'Z';

/**
 * @const
 * @type {string}
 */
const M = 'M';

/**
 * @const
 * @type {string}
 */
const ZM = 'ZM';

/**
 * @const
 * @enum {number}
 */
enum TokenType {
  START = 0,
  TEXT = 1,
  LEFT_PAREN = 2,
  RIGHT_PAREN = 3,
  NUMBER = 4,
  COMMA = 5,
  EOF = 6,
}

type GeometryLayout = 'XY' | 'XYZ' | 'XYM' | 'XYZM';

interface Token {
  position: number;
  type: TokenType;
  value?: string | number;
}

/**
 * Class to tokenize a WKT string.
 */
class Lexer {
  index_: number;

  constructor(readonly wkt: string) {
    this.index_ = -1;
  }

  /**
   * @param {string} c Character.
   * @return {boolean} Whether the character is alphabetic.
   * @private
   */
  isAlpha_(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
  }

  /**
   * @param {string} c Character.
   * @param {boolean} [opt_decimal] Whether the string number
   *     contains a dot, i.e. is a decimal number.
   * @return {boolean} Whether the character is numeric.
   * @private
   */
  isNumeric_(c: string, opt_decimal?: boolean): boolean {
    const decimal = opt_decimal !== undefined ? opt_decimal : false;
    return (c >= '0' && c <= '9') || (c == '.' && !decimal);
  }

  /**
   * @param {string} c Character.
   * @return {boolean} Whether the character is whitespace.
   * @private
   */
  isWhiteSpace_(c: string): boolean {
    return c == ' ' || c == '\t' || c == '\r' || c == '\n';
  }

  /**
   * @return {string} Next string character.
   * @private
   */
  nextChar_(): string {
    return this.wkt.charAt(++this.index_);
  }

  /**
   * Fetch and return the next token.
   * @return {Token} Next string token.
   */
  nextToken(): Token {
    const c = this.nextChar_();
    const position = this.index_;
    /** @type {number|string} */
    let value: number | string = c;
    let type;

    if (c == '(') {
      type = TokenType.LEFT_PAREN;
    } else if (c == ',') {
      type = TokenType.COMMA;
    } else if (c == ')') {
      type = TokenType.RIGHT_PAREN;
    } else if (this.isNumeric_(c) || c == '-') {
      type = TokenType.NUMBER;
      value = this.readNumber_();
    } else if (this.isAlpha_(c)) {
      type = TokenType.TEXT;
      value = this.readText_();
    } else if (this.isWhiteSpace_(c)) {
      return this.nextToken();
    } else if (c === '') {
      type = TokenType.EOF;
    } else {
      throw new Error('Unexpected character: ' + c);
    }

    return { position, value, type };
  }

  /**
   * @return {number} Numeric token value.
   * @private
   */
  readNumber_(): number {
    let c;
    const index = this.index_;
    let decimal = false;
    let scientificNotation = false;
    do {
      if (c == '.') {
        decimal = true;
      } else if (c == 'e' || c == 'E') {
        scientificNotation = true;
      }
      c = this.nextChar_();
    } while (
      this.isNumeric_(c, decimal) ||
      // if we haven't detected a scientific number before, 'e' or 'E'
      // hint that we should continue to read
      (!scientificNotation && (c == 'e' || c == 'E')) ||
      // once we know that we have a scientific number, both '-' and '+'
      // are allowed
      (scientificNotation && (c == '-' || c == '+'))
    );
    return parseFloat(this.wkt.substring(index, this.index_--));
  }

  /**
   * @return {string} String token value.
   * @private
   */
  readText_(): string {
    let c;
    const index = this.index_;
    do {
      c = this.nextChar_();
    } while (this.isAlpha_(c));
    return this.wkt.substring(index, this.index_--).toUpperCase();
  }
}

/**
 * Class to parse the tokens from the WKT string.
 */
class Parser {
  layout_: GeometryLayout;
  token_: Token;

  /**
   * @param {Lexer} lexer The lexer.
   */
  constructor(private readonly lexer_: Lexer) {
    /**
     * @type {Token}
     * @private
     */
    this.token_ = {
      position: 0,
      type: TokenType.START,
    };

    /**
     * @type {import("../geom/GeometryLayout.js").default}
     * @private
     */
    this.layout_ = 'XY';
  }

  /**
   * Fetch the next token form the lexer and replace the active token.
   * @private
   */
  consume_(): void {
    this.token_ = this.lexer_.nextToken();
  }

  /**
   * Tests if the given type matches the type of the current token.
   * @param {TokenType} type Token type.
   * @return {boolean} Whether the token matches the given type.
   */
  isTokenType(type: TokenType): boolean {
    return this.token_.type == type;
  }

  /**
   * If the given type matches the current token, consume it.
   * @param {TokenType} type Token type.
   * @return {boolean} Whether the token matches the given type.
   */
  match(type: TokenType): boolean {
    const isMatch = this.isTokenType(type);
    if (isMatch) {
      this.consume_();
    }
    return isMatch;
  }

  /**
   * Try to parse the tokens provided by the lexer.
   * @return {import("../geom/Geometry.js").default} The geometry.
   */
  parse(): number[][] | number[][][] {
    this.consume_();
    return this.parseGeometry_();
  }

  /**
   * Try to parse the dimensional info.
   * @return {import("../geom/GeometryLayout.js").default} The layout.
   * @private
   */
  parseGeometryLayout_(): GeometryLayout {
    let layout: GeometryLayout = 'XY';
    const dimToken = this.token_;
    if (this.isTokenType(TokenType.TEXT)) {
      const dimInfo = dimToken.value;
      if (dimInfo === Z) {
        layout = 'XYZ';
      } else if (dimInfo === M) {
        layout = 'XYM';
      } else if (dimInfo === ZM) {
        layout = 'XYZM';
      }
      if (layout !== 'XY') {
        this.consume_();
      }
    }
    return layout;
  }

  /**
   * @return {Array<number>} All values in a point.
   * @private
   */
  parsePointText_(): number[] {
    if (this.match(TokenType.LEFT_PAREN)) {
      const coordinates = this.parsePoint_();
      if (this.match(TokenType.RIGHT_PAREN)) {
        return coordinates;
      }
    }
    throw new Error(this.formatErrorMessage_());
  }

  /**
   * @return {Array<Array<number>>} All points in a linestring.
   * @private
   */
  parseLineStringText_(): number[][] {
    if (this.match(TokenType.LEFT_PAREN)) {
      const coordinates = this.parsePointList_();
      if (this.match(TokenType.RIGHT_PAREN)) {
        return coordinates;
      }
    }
    throw new Error(this.formatErrorMessage_());
  }

  /**
   * @return {Array<Array<Array<number>>>} All points in a polygon.
   * @private
   */
  parsePolygonText_(): number[][][] {
    if (this.match(TokenType.LEFT_PAREN)) {
      const coordinates = this.parseLineStringTextList_();
      if (this.match(TokenType.RIGHT_PAREN)) {
        return coordinates;
      }
    }
    throw new Error(this.formatErrorMessage_());
  }

  /**
   * @return {Array<Array<number>>} All points in a multipoint.
   * @private
   */
  parseMultiPointText_(): number[][] {
    if (this.match(TokenType.LEFT_PAREN)) {
      let coordinates;
      if (this.token_.type == TokenType.LEFT_PAREN) {
        coordinates = this.parsePointTextList_();
      } else {
        coordinates = this.parsePointList_();
      }
      if (this.match(TokenType.RIGHT_PAREN)) {
        return coordinates;
      }
    }
    throw new Error(this.formatErrorMessage_());
  }

  /**
   * @return {Array<Array<Array<number>>>} All linestring points
   *                                          in a multilinestring.
   * @private
   */
  parseMultiLineStringText_(): number[][][] {
    if (this.match(TokenType.LEFT_PAREN)) {
      const coordinates = this.parseLineStringTextList_();
      if (this.match(TokenType.RIGHT_PAREN)) {
        return coordinates;
      }
    }
    throw new Error(this.formatErrorMessage_());
  }

  /**
   * @return {Array<Array<Array<Array<number>>>>} All polygon points in a multipolygon.
   * @private
   */
  parseMultiPolygonText_(): number[][][][] {
    if (this.match(TokenType.LEFT_PAREN)) {
      const coordinates = this.parsePolygonTextList_();
      if (this.match(TokenType.RIGHT_PAREN)) {
        return coordinates;
      }
    }
    throw new Error(this.formatErrorMessage_());
  }

  /**
   * @return {Array<number>} A point.
   * @private
   */
  parsePoint_(): number[] {
    const coordinates: number[] = [];
    const dimensions = this.layout_.length;
    for (let i = 0; i < dimensions; ++i) {
      const token = this.token_;
      if (this.match(TokenType.NUMBER)) {
        coordinates.push(/** @type {number} */ token.value as number);
      } else {
        break;
      }
    }
    if (coordinates.length == dimensions) {
      return coordinates;
    }
    throw new Error(this.formatErrorMessage_());
  }

  /**
   * @return {Array<Array<number>>} An array of points.
   * @private
   */
  parsePointList_(): number[][] {
    const coordinates = [this.parsePoint_()];
    while (this.match(TokenType.COMMA)) {
      coordinates.push(this.parsePoint_());
    }
    return coordinates;
  }

  /**
   * @return {Array<Array<number>>} An array of points.
   * @private
   */
  parsePointTextList_(): number[][] {
    const coordinates = [this.parsePointText_()];
    while (this.match(TokenType.COMMA)) {
      coordinates.push(this.parsePointText_());
    }
    return coordinates;
  }

  /**
   * @return {Array<Array<Array<number>>>} An array of points.
   * @private
   */
  parseLineStringTextList_(): number[][][] {
    const coordinates = [this.parseLineStringText_()];
    while (this.match(TokenType.COMMA)) {
      coordinates.push(this.parseLineStringText_());
    }
    return coordinates;
  }

  /**
   * @return {Array<Array<Array<Array<number>>>>} An array of points.
   * @private
   */
  parsePolygonTextList_(): number[][][][] {
    const coordinates = [this.parsePolygonText_()];
    while (this.match(TokenType.COMMA)) {
      coordinates.push(this.parsePolygonText_());
    }
    return coordinates;
  }

  /**
   * @return {boolean} Whether the token implies an empty geometry.
   * @private
   */
  isEmptyGeometry_(): boolean {
    const isEmpty = this.isTokenType(TokenType.TEXT) && this.token_.value == EMPTY;
    if (isEmpty) {
      this.consume_();
    }
    return isEmpty;
  }

  /**
   * Create an error message for an unexpected token error.
   * @return {string} Error message.
   * @private
   */
  formatErrorMessage_(): string {
    return (
      'Unexpected `' + this.token_.value + '` at position ' + this.token_.position + ' in `' + this.lexer_.wkt + '`'
    );
  }

  /**
   * @return {import("../geom/Geometry.js").default} The geometry.
   * @private
   */
  parseGeometry_(): number[][] | number[][][] {
    const token = this.token_;
    if (this.match(TokenType.TEXT)) {
      const geomType = /** @type {string} */ token.value;
      this.layout_ = this.parseGeometryLayout_();
      const isEmpty = this.isEmptyGeometry_();
      if (geomType == 'GEOMETRYCOLLECTION') {
        throw new Error(`Not handled: ${geomType}`);
      } else {
        if (isEmpty) {
          return [];
        } else {
          switch (geomType) {
            case 'LINESTRING': {
              return this.parseLineStringText_();
            }
            case 'MULTILINESTRING': {
              return this.parseMultiLineStringText_();
            }
            case 'POLYGON':
            case 'MULTIPOINT':
            case 'MULTIPOLYGON':
            case 'POINT':
            default:
              throw new Error(`Not handled: ${geomType}`);
          }
        }
      }
    }
    throw new Error(this.formatErrorMessage_());
  }
}

const parse = function (wkt: string): number[][] | number[][][] {
  const lexer = new Lexer(wkt);
  const parser = new Parser(lexer);
  return parser.parse();
};

export default parse;
