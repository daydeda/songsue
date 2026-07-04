export type OXBoard = [
  number, number, number,
  number, number, number,
  number, number, number
];

export type OXState = {
  board: OXBoard;
};

export type OXMove = {
  cell: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
};

export const WIN_PATTERNS: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],  // Horizontal
  [0, 3, 6], [1, 4, 7], [2, 5, 8],  // Vertical
  [0, 4, 8], [2, 4, 6],             // Diagonal
];

export function createInitialState(): OXState {
  return {
    board: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  };
}

export function validateMove(state: OXState, move: OXMove): boolean {
  const cellIndex = move.cell - 1;
  
  // Cell index out of bounds
  if (cellIndex < 0 || cellIndex > 8) {
    return false;
  }

  // Cell already occupied
  if (state.board[cellIndex] !== 0) {
    return false;
  }

  return true;
}

export function applyMove(state: OXState, move: OXMove, currentTurn: 1 | 2): OXState {
  const cellIndex = move.cell - 1;
  const newBoard = [...state.board] as OXBoard;
  
  // currentTurn 1 = X (Host), 2 = O (Guest)
  newBoard[cellIndex] = currentTurn;

  return {
    board: newBoard,
  };
}

export function checkWin(board: OXBoard, player: 1 | 2): boolean {
  return WIN_PATTERNS.some(([a, b, c]) =>
    board[a] === player && board[b] === player && board[c] === player
  );
}

export function checkDraw(board: OXBoard): boolean {
  return board.every(cell => cell !== 0);
}

export function checkResult(state: OXState): {
  status: "ongoing" | "win" | "draw";
  winner?: 1 | 2;
  winningLine?: [number, number, number];
} {
  if (checkWin(state.board, 1)) {
    const winningLine = WIN_PATTERNS.find(([a, b, c]) =>
      state.board[a] === 1 && state.board[b] === 1 && state.board[c] === 1
    );
    return { status: "win", winner: 1, winningLine };
  }

  if (checkWin(state.board, 2)) {
    const winningLine = WIN_PATTERNS.find(([a, b, c]) =>
      state.board[a] === 2 && state.board[b] === 2 && state.board[c] === 2
    );
    return { status: "win", winner: 2, winningLine };
  }

  if (checkDraw(state.board)) {
    return { status: "draw" };
  }

  return { status: "ongoing" };
}
