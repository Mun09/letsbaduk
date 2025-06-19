export const BOARD_SIZE = 19;
export const OFFSET_RATIO = 0.031;

export const saveSgf = (prevBoards: BoardState[]) => {
  const moves = [...prevBoards].reverse(); // 처음 수부터 재생하기 위해 역순
  let sgf = `(;FF[4]GM[1]SZ[${BOARD_SIZE}]`;

  for (let i = 1; i < moves.length; i++) {
    const prev = moves[i - 1];
    const curr = moves[i];

    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        if (prev[x][y] !== curr[x][y]) {
          const color = curr[x][y] === "black" ? "B" : "W";
          const sgfX = String.fromCharCode(97 + x);
          const sgfY = String.fromCharCode(97 + y);
          sgf += `;${color}[${sgfX}${sgfY}]`;
        }
      }
    }
  }

  sgf += ")";
  const blob = new Blob([sgf], { type: "application/x-go-sgf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "game.sgf";
  a.click();
  URL.revokeObjectURL(url);
};

const loadSgf = (
  sgf: string,
  setPrevBoards: Function,
  setBoard: Function,
  setCurrentMoveIndex: Function
) => {
  const regex = /;(B|W)\[([a-s])([a-s])\]/g;
  const empty = Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null));

  const boards: BoardState[] = [JSON.parse(JSON.stringify(empty))];
  let currentBoard: BoardState = JSON.parse(JSON.stringify(empty));

  let match;
  while ((match = regex.exec(sgf)) !== null) {
    const [, color, xChar, yChar] = match;
    const x = xChar.charCodeAt(0) - 97;
    const y = yChar.charCodeAt(0) - 97;

    currentBoard = currentBoard.map((row) => [...row]);
    currentBoard[x][y] = color === "B" ? "black" : "white";
    boards.unshift(currentBoard); // 최신 수가 앞으로 오게
  }

  setPrevBoards(boards);
  setBoard(boards[0]);
  setCurrentMoveIndex(0);
};

export const handleFileUpload = (
  e: React.ChangeEvent<HTMLInputElement>,
  setPrevBoards: Function,
  setBoard: Function,
  setCurrentMoveIndex: Function
) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const sgf = reader.result as string;
    loadSgf(sgf, setPrevBoards, setBoard, setCurrentMoveIndex);
  };
  reader.readAsText(file);
};

export const countCapturedStones = (boards: BoardState[]) => {
  let blackCaptured = 0;
  let whiteCaptured = 0;

  for (let i = 1; i < boards.length; i++) {
    const before = boards[i]; // 과거 상태
    const after = boards[i - 1]; // 그 직후 상태

    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        const prev = before[x][y];
        const curr = after[x][y];

        if (prev && !curr) {
          if (prev === "black") blackCaptured++;
          else if (prev === "white") whiteCaptured++;
        }
      }
    }
  }

  return { blackCaptured, whiteCaptured };
};
