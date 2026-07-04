import { describe, it, expect } from "vitest";
import { createInitialState, validateMove, applyMove, checkResult } from "./ox";

describe("OX (Tic-Tac-Toe) Game Engine", () => {
  it("should create an empty initial state", () => {
    const state = createInitialState();
    expect(state.board).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("should validate and apply correct moves", () => {
    let state = createInitialState();
    
    // Move is valid on an empty cell
    const valid = validateMove(state, { cell: 5 });
    expect(valid).toBe(true);

    // Apply the move
    state = applyMove(state, { cell: 5 }, 1);
    expect(state.board[4]).toBe(1); // X (Player 1) in the center

    // Cannot make move on already occupied cell
    const invalid = validateMove(state, { cell: 5 });
    expect(invalid).toBe(false);

    // Can make move on empty cell
    const valid2 = validateMove(state, { cell: 1 });
    expect(valid2).toBe(true);
    
    state = applyMove(state, { cell: 1 }, 2);
    expect(state.board[0]).toBe(2); // O (Player 2) in top-left
  });

  it("should detect win patterns", () => {
    // Horizontal win for Player 1 (X)
    let state = createInitialState();
    state = applyMove(state, { cell: 1 }, 1);
    state = applyMove(state, { cell: 4 }, 2);
    state = applyMove(state, { cell: 2 }, 1);
    state = applyMove(state, { cell: 5 }, 2);
    state = applyMove(state, { cell: 3 }, 1); // Win horizontal (0, 1, 2)

    const result = checkResult(state);
    expect(result.status).toBe("win");
    expect(result.winner).toBe(1);
    expect(result.winningLine).toEqual([0, 1, 2]);
  });

  it("should detect draw conditions", () => {
    const state = createInitialState();
    /*
      X | O | X
      X | O | O
      O | X | X
      board indices:
      0:1, 1:2, 2:1
      3:1, 4:2, 5:2
      6:2, 7:1, 8:1
    */
    state.board = [
      1, 2, 1,
      1, 2, 2,
      2, 1, 1
    ];

    const result = checkResult(state);
    expect(result.status).toBe("draw");
  });

  it("should report ongoing status for incomplete boards", () => {
    let state = createInitialState();
    state = applyMove(state, { cell: 5 }, 1);

    const result = checkResult(state);
    expect(result.status).toBe("ongoing");
  });
});
