// URL-safe encoding of game state
// Uses base64url encoding of a compact binary representation

import {
  type GameState,
  type Move,
  type PieceType,
  createInitialState,
  applyMove,
  isLegalMove,
} from './chess';

// Encode a single move as 2 bytes (with optional 3rd byte for promotion)
// Byte 1: from square (0-63) + capture flag (bit 7)
// Byte 2: to square (0-63) + promotion flag (bit 7) + promotion piece (bits 6-5)
// We actually simplify: just encode from (6 bits) + to (6 bits) + promotion (4 bits) = 16 bits

function encodeMove(move: Move): number {
  const from = move.from[0] * 8 + move.from[1];
  const to = move.to[0] * 8 + move.to[1];
  let promo = 0;
  if (move.promotion) {
    const promoMap: Record<PieceType, number> = { 'q': 1, 'r': 2, 'b': 3, 'n': 4, 'p': 0, 'k': 0 };
    promo = promoMap[move.promotion];
  }
  // 6 bits from + 6 bits to + 4 bits promo = 16 bits
  return (from << 10) | (to << 4) | promo;
}

function decodeMove(encoded: number): Move {
  const from = (encoded >> 10) & 0x3F;
  const to = (encoded >> 4) & 0x3F;
  const promo = encoded & 0xF;

  const move: Move = {
    from: [Math.floor(from / 8), from % 8],
    to: [Math.floor(to / 8), to % 8],
  };

  if (promo > 0) {
    const promoMap: PieceType[] = ['q', 'q', 'r', 'b', 'n'];
    move.promotion = promoMap[promo];
  }

  return move;
}

// Encode moves list to bytes
function encodeMoves(moves: Move[]): Uint8Array {
  const bytes: number[] = [];
  for (const move of moves) {
    const encoded = encodeMove(move);
    bytes.push((encoded >> 8) & 0xFF);
    bytes.push(encoded & 0xFF);
  }
  return new Uint8Array(bytes);
}

// Decode bytes to moves list
function decodeMoves(bytes: Uint8Array): Move[] {
  const moves: Move[] = [];
  for (let i = 0; i < bytes.length; i += 2) {
    const encoded = (bytes[i] << 8) | bytes[i + 1];
    moves.push(decodeMove(encoded));
  }
  return moves;
}

// Base64url encoding (URL-safe base64)
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromBase64Url(str: string): Uint8Array {
  // Pad the string if needed
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4 !== 0) {
    padded += '=';
  }
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Main encoding function: state -> URL parameter
export function encodeGameState(state: GameState): string {
  // We need to replay moves from initial position
  // Store the move history that got us here
  const moves = getMoveHistory(state);
  const bytes = encodeMoves(moves);
  return toBase64Url(bytes);
}

// Get move history from state by storing it in a way we can retrieve
// Since we want immutable URLs representing game states, we'll encode move sequences
// For now, we'll pass move history separately

export function encodeGameFromMoves(moves: Move[]): string {
  if (moves.length === 0) return '';
  const bytes = encodeMoves(moves);
  return toBase64Url(bytes);
}

// Decode URL parameter -> state
export function decodeGameState(encoded: string): { state: GameState; moves: Move[] } {
  if (!encoded || encoded === '') {
    return { state: createInitialState(), moves: [] };
  }

  try {
    const bytes = fromBase64Url(encoded);
    const moves = decodeMoves(bytes);

    let state = createInitialState();
    const validMoves: Move[] = [];

    for (const move of moves) {
      if (isLegalMove(state, move)) {
        state = applyMove(state, move);
        validMoves.push(move);
      } else {
        // Invalid move sequence - return what we have so far
        console.warn('Invalid move in sequence, stopping replay');
        break;
      }
    }

    return { state, moves: validMoves };
  } catch (e) {
    console.error('Failed to decode game state:', e);
    return { state: createInitialState(), moves: [] };
  }
}

// Helper to get move history - we pass it around with the state
function getMoveHistory(state: GameState): Move[] {
  // This is a placeholder - in practice we track moves separately
  return [];
}

// Create URL with game state
export function createGameUrl(baseUrl: string, moves: Move[]): string {
  const encoded = encodeGameFromMoves(moves);
  if (!encoded) return baseUrl;
  return `${baseUrl}?g=${encoded}`;
}

// Parse game from URL
export function parseGameFromUrl(url: string): { state: GameState; moves: Move[] } {
  try {
    const urlObj = new URL(url);
    const gameParam = urlObj.searchParams.get('g');
    return decodeGameState(gameParam || '');
  } catch {
    return { state: createInitialState(), moves: [] };
  }
}

// Encode a single move to add to existing moves
export function appendMoveToEncoded(existingEncoded: string, move: Move): string {
  const { moves } = decodeGameState(existingEncoded);
  moves.push(move);
  return encodeGameFromMoves(moves);
}
