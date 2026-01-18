// Pure TypeScript chess engine - no dependencies

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Color = 'w' | 'b';
export type Piece = { type: PieceType; color: Color };
export type Square = Piece | null;
export type Board = Square[][];

export interface CastlingRights {
  whiteKingside: boolean;
  whiteQueenside: boolean;
  blackKingside: boolean;
  blackQueenside: boolean;
}

export interface GameState {
  board: Board;
  turn: Color;
  castling: CastlingRights;
  enPassant: [number, number] | null; // Target square for en passant
  halfmoveClock: number;
  fullmoveNumber: number;
  lastMove: { from: [number, number]; to: [number, number] } | null;
}

export interface Move {
  from: [number, number];
  to: [number, number];
  promotion?: PieceType;
}

// Starting position
export function createInitialState(): GameState {
  const board: Board = [
    [{ type: 'r', color: 'b' }, { type: 'n', color: 'b' }, { type: 'b', color: 'b' }, { type: 'q', color: 'b' }, { type: 'k', color: 'b' }, { type: 'b', color: 'b' }, { type: 'n', color: 'b' }, { type: 'r', color: 'b' }],
    [{ type: 'p', color: 'b' }, { type: 'p', color: 'b' }, { type: 'p', color: 'b' }, { type: 'p', color: 'b' }, { type: 'p', color: 'b' }, { type: 'p', color: 'b' }, { type: 'p', color: 'b' }, { type: 'p', color: 'b' }],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [{ type: 'p', color: 'w' }, { type: 'p', color: 'w' }, { type: 'p', color: 'w' }, { type: 'p', color: 'w' }, { type: 'p', color: 'w' }, { type: 'p', color: 'w' }, { type: 'p', color: 'w' }, { type: 'p', color: 'w' }],
    [{ type: 'r', color: 'w' }, { type: 'n', color: 'w' }, { type: 'b', color: 'w' }, { type: 'q', color: 'w' }, { type: 'k', color: 'w' }, { type: 'b', color: 'w' }, { type: 'n', color: 'w' }, { type: 'r', color: 'w' }],
  ];

  return {
    board,
    turn: 'w',
    castling: {
      whiteKingside: true,
      whiteQueenside: true,
      blackKingside: true,
      blackQueenside: true,
    },
    enPassant: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
    lastMove: null,
  };
}

export function cloneState(state: GameState): GameState {
  return {
    board: state.board.map(row => row.map(sq => sq ? { ...sq } : null)),
    turn: state.turn,
    castling: { ...state.castling },
    enPassant: state.enPassant ? [...state.enPassant] as [number, number] : null,
    halfmoveClock: state.halfmoveClock,
    fullmoveNumber: state.fullmoveNumber,
    lastMove: state.lastMove ? { from: [...state.lastMove.from] as [number, number], to: [...state.lastMove.to] as [number, number] } : null,
  };
}

function getPiece(board: Board, row: number, col: number): Square {
  if (row < 0 || row > 7 || col < 0 || col > 7) return null;
  return board[row][col];
}

function isEnemy(piece: Square, color: Color): boolean {
  return piece !== null && piece.color !== color;
}

function isEmpty(board: Board, row: number, col: number): boolean {
  return getPiece(board, row, col) === null;
}

function isValidSquare(row: number, col: number): boolean {
  return row >= 0 && row <= 7 && col >= 0 && col <= 7;
}

// Find king position
function findKing(board: Board, color: Color): [number, number] {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'k' && piece.color === color) {
        return [r, c];
      }
    }
  }
  throw new Error(`King not found for ${color}`);
}

// Check if a square is attacked by any piece of the given color
function isSquareAttacked(board: Board, row: number, col: number, byColor: Color): boolean {
  // Check pawn attacks
  const pawnDir = byColor === 'w' ? 1 : -1;
  for (const dc of [-1, 1]) {
    const pr = row + pawnDir;
    const pc = col + dc;
    if (isValidSquare(pr, pc)) {
      const piece = board[pr][pc];
      if (piece && piece.type === 'p' && piece.color === byColor) {
        return true;
      }
    }
  }

  // Check knight attacks
  const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  for (const [dr, dc] of knightMoves) {
    const nr = row + dr;
    const nc = col + dc;
    if (isValidSquare(nr, nc)) {
      const piece = board[nr][nc];
      if (piece && piece.type === 'n' && piece.color === byColor) {
        return true;
      }
    }
  }

  // Check king attacks (for adjacent squares)
  const kingMoves = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  for (const [dr, dc] of kingMoves) {
    const kr = row + dr;
    const kc = col + dc;
    if (isValidSquare(kr, kc)) {
      const piece = board[kr][kc];
      if (piece && piece.type === 'k' && piece.color === byColor) {
        return true;
      }
    }
  }

  // Check sliding pieces (bishop, rook, queen)
  const directions = [
    { dirs: [[-1, 0], [1, 0], [0, -1], [0, 1]], types: ['r', 'q'] as PieceType[] }, // Rook/queen
    { dirs: [[-1, -1], [-1, 1], [1, -1], [1, 1]], types: ['b', 'q'] as PieceType[] }, // Bishop/queen
  ];

  for (const { dirs, types } of directions) {
    for (const [dr, dc] of dirs) {
      let r = row + dr;
      let c = col + dc;
      while (isValidSquare(r, c)) {
        const piece = board[r][c];
        if (piece) {
          if (piece.color === byColor && types.includes(piece.type)) {
            return true;
          }
          break;
        }
        r += dr;
        c += dc;
      }
    }
  }

  return false;
}

// Check if the given color's king is in check
export function isInCheck(board: Board, color: Color): boolean {
  const [kingRow, kingCol] = findKing(board, color);
  const enemyColor = color === 'w' ? 'b' : 'w';
  return isSquareAttacked(board, kingRow, kingCol, enemyColor);
}

// Generate pseudo-legal moves (doesn't check if king is left in check)
function generatePseudoLegalMoves(state: GameState, row: number, col: number): Move[] {
  const piece = state.board[row][col];
  if (!piece || piece.color !== state.turn) return [];

  const moves: Move[] = [];
  const color = piece.color;
  const board = state.board;

  const addMove = (toRow: number, toCol: number, promotion?: PieceType) => {
    moves.push({ from: [row, col], to: [toRow, toCol], promotion });
  };

  const addMovesInDirection = (dr: number, dc: number, maxDist: number = 7) => {
    let r = row + dr;
    let c = col + dc;
    let dist = 0;
    while (isValidSquare(r, c) && dist < maxDist) {
      const target = board[r][c];
      if (target) {
        if (target.color !== color) {
          addMove(r, c);
        }
        break;
      }
      addMove(r, c);
      r += dr;
      c += dc;
      dist++;
    }
  };

  switch (piece.type) {
    case 'p': {
      const dir = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      const promoRow = color === 'w' ? 0 : 7;

      // Forward move
      const oneAhead = row + dir;
      if (isValidSquare(oneAhead, col) && isEmpty(board, oneAhead, col)) {
        if (oneAhead === promoRow) {
          for (const promo of ['q', 'r', 'b', 'n'] as PieceType[]) {
            addMove(oneAhead, col, promo);
          }
        } else {
          addMove(oneAhead, col);
        }

        // Double move from start
        if (row === startRow) {
          const twoAhead = row + 2 * dir;
          if (isEmpty(board, twoAhead, col)) {
            addMove(twoAhead, col);
          }
        }
      }

      // Captures
      for (const dc of [-1, 1]) {
        const captureCol = col + dc;
        if (isValidSquare(oneAhead, captureCol)) {
          const target = board[oneAhead][captureCol];
          const isEnPassant = state.enPassant && state.enPassant[0] === oneAhead && state.enPassant[1] === captureCol;

          if ((target && target.color !== color) || isEnPassant) {
            if (oneAhead === promoRow) {
              for (const promo of ['q', 'r', 'b', 'n'] as PieceType[]) {
                addMove(oneAhead, captureCol, promo);
              }
            } else {
              addMove(oneAhead, captureCol);
            }
          }
        }
      }
      break;
    }

    case 'n': {
      const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
      for (const [dr, dc] of knightMoves) {
        const nr = row + dr;
        const nc = col + dc;
        if (isValidSquare(nr, nc)) {
          const target = board[nr][nc];
          if (!target || target.color !== color) {
            addMove(nr, nc);
          }
        }
      }
      break;
    }

    case 'b': {
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        addMovesInDirection(dr, dc);
      }
      break;
    }

    case 'r': {
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        addMovesInDirection(dr, dc);
      }
      break;
    }

    case 'q': {
      for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
        addMovesInDirection(dr, dc);
      }
      break;
    }

    case 'k': {
      // Regular king moves
      for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
        const nr = row + dr;
        const nc = col + dc;
        if (isValidSquare(nr, nc)) {
          const target = board[nr][nc];
          if (!target || target.color !== color) {
            addMove(nr, nc);
          }
        }
      }

      // Castling
      const enemyColor = color === 'w' ? 'b' : 'w';
      const kingRow = color === 'w' ? 7 : 0;

      if (row === kingRow && col === 4 && !isSquareAttacked(board, row, col, enemyColor)) {
        // Kingside
        const canKingside = color === 'w' ? state.castling.whiteKingside : state.castling.blackKingside;
        if (canKingside && isEmpty(board, row, 5) && isEmpty(board, row, 6)) {
          const rook = board[row][7];
          if (rook && rook.type === 'r' && rook.color === color) {
            if (!isSquareAttacked(board, row, 5, enemyColor) && !isSquareAttacked(board, row, 6, enemyColor)) {
              addMove(row, 6);
            }
          }
        }

        // Queenside
        const canQueenside = color === 'w' ? state.castling.whiteQueenside : state.castling.blackQueenside;
        if (canQueenside && isEmpty(board, row, 3) && isEmpty(board, row, 2) && isEmpty(board, row, 1)) {
          const rook = board[row][0];
          if (rook && rook.type === 'r' && rook.color === color) {
            if (!isSquareAttacked(board, row, 3, enemyColor) && !isSquareAttacked(board, row, 2, enemyColor)) {
              addMove(row, 2);
            }
          }
        }
      }
      break;
    }
  }

  return moves;
}

// Apply a move and return new state (doesn't validate legality)
export function applyMove(state: GameState, move: Move): GameState {
  const newState = cloneState(state);
  const [fromRow, fromCol] = move.from;
  const [toRow, toCol] = move.to;
  const piece = newState.board[fromRow][fromCol];

  if (!piece) throw new Error('No piece at from square');

  const captured = newState.board[toRow][toCol];

  // Handle en passant capture
  if (piece.type === 'p' && state.enPassant && toRow === state.enPassant[0] && toCol === state.enPassant[1]) {
    const capturedPawnRow = piece.color === 'w' ? toRow + 1 : toRow - 1;
    newState.board[capturedPawnRow][toCol] = null;
  }

  // Move the piece
  newState.board[toRow][toCol] = move.promotion
    ? { type: move.promotion, color: piece.color }
    : piece;
  newState.board[fromRow][fromCol] = null;

  // Handle castling rook movement
  if (piece.type === 'k' && Math.abs(toCol - fromCol) === 2) {
    if (toCol === 6) { // Kingside
      newState.board[fromRow][5] = newState.board[fromRow][7];
      newState.board[fromRow][7] = null;
    } else { // Queenside
      newState.board[fromRow][3] = newState.board[fromRow][0];
      newState.board[fromRow][0] = null;
    }
  }

  // Update castling rights
  if (piece.type === 'k') {
    if (piece.color === 'w') {
      newState.castling.whiteKingside = false;
      newState.castling.whiteQueenside = false;
    } else {
      newState.castling.blackKingside = false;
      newState.castling.blackQueenside = false;
    }
  }
  if (piece.type === 'r') {
    if (fromRow === 7 && fromCol === 0) newState.castling.whiteQueenside = false;
    if (fromRow === 7 && fromCol === 7) newState.castling.whiteKingside = false;
    if (fromRow === 0 && fromCol === 0) newState.castling.blackQueenside = false;
    if (fromRow === 0 && fromCol === 7) newState.castling.blackKingside = false;
  }
  // Rook captured
  if (toRow === 7 && toCol === 0) newState.castling.whiteQueenside = false;
  if (toRow === 7 && toCol === 7) newState.castling.whiteKingside = false;
  if (toRow === 0 && toCol === 0) newState.castling.blackQueenside = false;
  if (toRow === 0 && toCol === 7) newState.castling.blackKingside = false;

  // Set en passant square
  if (piece.type === 'p' && Math.abs(toRow - fromRow) === 2) {
    const epRow = piece.color === 'w' ? fromRow - 1 : fromRow + 1;
    newState.enPassant = [epRow, fromCol];
  } else {
    newState.enPassant = null;
  }

  // Update clocks
  if (piece.type === 'p' || captured) {
    newState.halfmoveClock = 0;
  } else {
    newState.halfmoveClock++;
  }

  if (state.turn === 'b') {
    newState.fullmoveNumber++;
  }

  newState.turn = state.turn === 'w' ? 'b' : 'w';
  newState.lastMove = { from: move.from, to: move.to };

  return newState;
}

// Check if a move is legal (doesn't leave own king in check)
export function isLegalMove(state: GameState, move: Move): boolean {
  const piece = state.board[move.from[0]][move.from[1]];
  if (!piece || piece.color !== state.turn) return false;

  // Check if move is in pseudo-legal moves
  const pseudoLegal = generatePseudoLegalMoves(state, move.from[0], move.from[1]);
  const isInPseudoLegal = pseudoLegal.some(m =>
    m.from[0] === move.from[0] && m.from[1] === move.from[1] &&
    m.to[0] === move.to[0] && m.to[1] === move.to[1] &&
    m.promotion === move.promotion
  );

  if (!isInPseudoLegal) return false;

  // Apply move and check if king is in check
  const newState = applyMove(state, move);
  return !isInCheck(newState.board, state.turn);
}

// Get all legal moves for a piece
export function getLegalMoves(state: GameState, row: number, col: number): Move[] {
  const pseudoLegal = generatePseudoLegalMoves(state, row, col);
  return pseudoLegal.filter(move => {
    const newState = applyMove(state, move);
    return !isInCheck(newState.board, state.turn);
  });
}

// Get all legal moves for the current player
export function getAllLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (piece && piece.color === state.turn) {
        moves.push(...getLegalMoves(state, r, c));
      }
    }
  }
  return moves;
}

// Check game status
export type GameStatus = 'ongoing' | 'checkmate' | 'stalemate' | 'draw_50_move' | 'draw_insufficient';

export function getGameStatus(state: GameState): GameStatus {
  const legalMoves = getAllLegalMoves(state);

  if (legalMoves.length === 0) {
    if (isInCheck(state.board, state.turn)) {
      return 'checkmate';
    }
    return 'stalemate';
  }

  if (state.halfmoveClock >= 100) {
    return 'draw_50_move';
  }

  // Check insufficient material
  const pieces: Piece[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p) pieces.push(p);
    }
  }

  // K vs K
  if (pieces.length === 2) return 'draw_insufficient';

  // K+B vs K or K+N vs K
  if (pieces.length === 3) {
    const nonKing = pieces.find(p => p.type !== 'k');
    if (nonKing && (nonKing.type === 'b' || nonKing.type === 'n')) {
      return 'draw_insufficient';
    }
  }

  // K+B vs K+B same color bishops
  if (pieces.length === 4) {
    const bishops = pieces.filter(p => p.type === 'b');
    if (bishops.length === 2 && bishops[0].color !== bishops[1].color) {
      // Find bishop positions
      const bishopPositions: [number, number][] = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (state.board[r][c]?.type === 'b') {
            bishopPositions.push([r, c]);
          }
        }
      }
      if (bishopPositions.length === 2) {
        const [r1, c1] = bishopPositions[0];
        const [r2, c2] = bishopPositions[1];
        // Same color squares
        if ((r1 + c1) % 2 === (r2 + c2) % 2) {
          return 'draw_insufficient';
        }
      }
    }
  }

  return 'ongoing';
}

// Convert coordinates to algebraic notation
export function squareToAlgebraic(row: number, col: number): string {
  const file = 'abcdefgh'[col];
  const rank = (8 - row).toString();
  return file + rank;
}

export function algebraicToSquare(sq: string): [number, number] {
  const col = 'abcdefgh'.indexOf(sq[0]);
  const row = 8 - parseInt(sq[1]);
  return [row, col];
}

// Convert move to standard algebraic notation
export function moveToSAN(state: GameState, move: Move): string {
  const piece = state.board[move.from[0]][move.from[1]];
  if (!piece) return '';

  const [fromRow, fromCol] = move.from;
  const [toRow, toCol] = move.to;
  const target = state.board[toRow][toCol];
  const isCapture = target !== null || (piece.type === 'p' && state.enPassant && toRow === state.enPassant[0] && toCol === state.enPassant[1]);

  // Castling
  if (piece.type === 'k' && Math.abs(toCol - fromCol) === 2) {
    return toCol === 6 ? 'O-O' : 'O-O-O';
  }

  let san = '';

  // Piece letter (not for pawns)
  if (piece.type !== 'p') {
    san += piece.type.toUpperCase();

    // Disambiguation
    const allMoves = getAllLegalMoves(state);
    const samePieceMoves = allMoves.filter(m => {
      const p = state.board[m.from[0]][m.from[1]];
      return p && p.type === piece.type && m.to[0] === toRow && m.to[1] === toCol &&
        (m.from[0] !== fromRow || m.from[1] !== fromCol);
    });

    if (samePieceMoves.length > 0) {
      const sameFile = samePieceMoves.some(m => m.from[1] === fromCol);
      const sameRank = samePieceMoves.some(m => m.from[0] === fromRow);

      if (!sameFile) {
        san += 'abcdefgh'[fromCol];
      } else if (!sameRank) {
        san += (8 - fromRow).toString();
      } else {
        san += 'abcdefgh'[fromCol] + (8 - fromRow).toString();
      }
    }
  }

  // Capture
  if (isCapture) {
    if (piece.type === 'p') {
      san += 'abcdefgh'[fromCol];
    }
    san += 'x';
  }

  // Destination
  san += squareToAlgebraic(toRow, toCol);

  // Promotion
  if (move.promotion) {
    san += '=' + move.promotion.toUpperCase();
  }

  // Check or checkmate
  const newState = applyMove(state, move);
  if (isInCheck(newState.board, newState.turn)) {
    const status = getGameStatus(newState);
    san += status === 'checkmate' ? '#' : '+';
  }

  return san;
}

// Get winner
export function getWinner(state: GameState): Color | null {
  const status = getGameStatus(state);
  if (status === 'checkmate') {
    return state.turn === 'w' ? 'b' : 'w';
  }
  return null;
}
