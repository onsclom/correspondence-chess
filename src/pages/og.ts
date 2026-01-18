// OG Image generation endpoint
// Generates an SVG image of the current board state

import type { APIRoute } from 'astro';
import { decodeGameState } from '../lib/encoding';
import type { Board, Color, PieceType } from '../lib/chess';

// Simple SVG piece paths (simplified for smaller file size)
const piecePaths: Record<PieceType, string> = {
  k: 'M22.5 11.6V6M20 8h5M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10v7zM11.5 30c5.5-3 15.5-3 21 0M11.5 33.5c5.5-3 15.5-3 21 0M11.5 37c5.5-3 15.5-3 21 0',
  q: 'M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5 9 26zM9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0zM11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0M6 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM14 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM22.5 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM31 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM39 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  r: 'M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5M34 14l-3 3H14l-3-3M31 17v12.5H14V17M31 29.5l1.5 2.5h-20l1.5-2.5M11 14h23',
  b: 'M9 36c3.4-1 10.1.4 13.5-2 3.4 2.4 10.1 1 13.5 2 0 0 1.6.5 3 2-.7 1-1.6 1-3 .5-3.4-1-10.1.5-13.5-1-3.4 1.5-10.1 0-13.5 1-1.4.5-2.3.5-3-.5 1.4-1.9 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM17.5 26h10M15 30h15M20 18h5M22.5 15.5v5',
  n: 'M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21M24 18c.4 2.9-5.5 7.4-8 9-3 2-2.8 4.3-5 4-1-.9 1.4-3 0-3-1 0 .2 1.2-1 2-1 0-4 1-4-4 0-2 6-12 6-12s1.9-1.9 2-3.5c-.7-1-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.8-2 2.5-3c1 0 1 3 1 3M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z',
  p: 'M22.5 9c-2.2 0-4 1.8-4 4 0 .9.3 1.7.8 2.4-2 1.1-3.3 3.2-3.3 5.6 0 2 .9 3.8 2.4 5-3 1.1-7.4 5.6-7.4 13.5h23c0-7.9-4.4-12.4-7.4-13.5 1.5-1.2 2.4-3 2.4-5 0-2.4-1.3-4.5-3.3-5.6.5-.7.8-1.5.8-2.4 0-2.2-1.8-4-4-4z',
};

function renderPiece(type: PieceType, color: Color, x: number, y: number, size: number): string {
  const fill = color === 'w' ? '#ffffff' : '#000000';
  const stroke = color === 'w' ? '#000000' : '#000000';
  const strokeWidth = color === 'w' ? 1.5 : 1.5;

  // Scale and translate the piece path
  const scale = size / 45;
  const tx = x;
  const ty = y;

  return `<g transform="translate(${tx}, ${ty}) scale(${scale})">
    <path d="${piecePaths[type]}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

function generateBoardSVG(board: Board, lastMove: { from: [number, number]; to: [number, number] } | null): string {
  const squareSize = 60;
  const boardSize = squareSize * 8;
  const padding = 20;
  const totalSize = boardSize + padding * 2;

  const lightColor = '#f0d9b5';
  const darkColor = '#b58863';
  const highlightColor = 'rgba(155, 199, 0, 0.5)';

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}">`;

  // Background
  svg += `<rect width="${totalSize}" height="${totalSize}" fill="#302e2c"/>`;

  // Board squares
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const x = padding + col * squareSize;
      const y = padding + row * squareSize;
      const isLight = (row + col) % 2 === 0;
      let color = isLight ? lightColor : darkColor;

      // Highlight last move
      if (lastMove) {
        if ((lastMove.from[0] === row && lastMove.from[1] === col) ||
            (lastMove.to[0] === row && lastMove.to[1] === col)) {
          svg += `<rect x="${x}" y="${y}" width="${squareSize}" height="${squareSize}" fill="${color}"/>`;
          svg += `<rect x="${x}" y="${y}" width="${squareSize}" height="${squareSize}" fill="${highlightColor}"/>`;
          continue;
        }
      }

      svg += `<rect x="${x}" y="${y}" width="${squareSize}" height="${squareSize}" fill="${color}"/>`;
    }
  }

  // Pieces
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const x = padding + col * squareSize + squareSize * 0.08;
        const y = padding + row * squareSize + squareSize * 0.08;
        svg += renderPiece(piece.type, piece.color, x, y, squareSize * 0.84);
      }
    }
  }

  // Coordinates
  const coordColor = '#888';
  const fontSize = 10;

  // Files (a-h)
  for (let col = 0; col < 8; col++) {
    const x = padding + col * squareSize + squareSize / 2;
    const y = totalSize - 6;
    svg += `<text x="${x}" y="${y}" text-anchor="middle" font-family="sans-serif" font-size="${fontSize}" fill="${coordColor}">${'abcdefgh'[col]}</text>`;
  }

  // Ranks (1-8)
  for (let row = 0; row < 8; row++) {
    const x = 8;
    const y = padding + row * squareSize + squareSize / 2 + 3;
    svg += `<text x="${x}" y="${y}" text-anchor="middle" font-family="sans-serif" font-size="${fontSize}" fill="${coordColor}">${8 - row}</text>`;
  }

  svg += '</svg>';
  return svg;
}

export const GET: APIRoute = async ({ url }) => {
  const gameParam = url.searchParams.get('g') || '';
  const { state } = decodeGameState(gameParam);

  const svg = generateBoardSVG(state.board, state.lastMove);

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
