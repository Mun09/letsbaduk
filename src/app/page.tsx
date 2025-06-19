"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { BOARD_SIZE, OFFSET_RATIO } from "./utils";

export default function PreciseGoban() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState<BoardState>(
    Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null))
  );
  const [isBlackTurn, setIsBlackTurn] = useState(true);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [stoneSize, setStoneSize] = useState(60);

  useEffect(() => {
    // Function to update stone size based on current board width
    const updateStoneSize = () => {
      if (boardRef.current) {
        const rect = boardRef.current.getBoundingClientRect();

        const offsetX = rect.width * OFFSET_RATIO;
        const offsetY = rect.height * OFFSET_RATIO;
        const usableWidth = rect.width - 2 * offsetX;
        const usableHeight = rect.height - 2 * offsetY;
        const cellWidth = usableWidth / (BOARD_SIZE - 1);
        const cellHeight = usableHeight / (BOARD_SIZE - 1);

        setStoneSize(Math.round(cellWidth * 1.2));
      }
    };

    // Initial calculation
    updateStoneSize();

    // Set up resize observer to detect changes in element size
    const resizeObserver = new ResizeObserver(updateStoneSize);
    if (boardRef.current) {
      resizeObserver.observe(boardRef.current);
    }

    // Clean up observer on unmount
    return () => {
      if (boardRef.current) {
        resizeObserver.unobserve(boardRef.current);
      }
    };
  }, []);
  const prevBoardsRef = useRef<BoardState[]>([]); // 패(ko) 규칙을 위한 이전 보드 상태 기록

  // 돌의 호석(liberty) 계산
  const countLiberties = (
    x: number,
    y: number,
    visited: boolean[][] = []
  ): number => {
    if (!visited.length) {
      visited = Array(BOARD_SIZE)
        .fill(null)
        .map(() => Array(BOARD_SIZE).fill(false));
    }
    if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE || visited[x][y])
      return 0;
    visited[x][y] = true;
    if (board[x][y] === null) return 1;

    const color = board[x][y];
    let liberties = 0;
    const directions = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ];
    for (const [dx, dy] of directions) {
      const nx = x + dx,
        ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < BOARD_SIZE && ny < BOARD_SIZE) {
        if (board[nx][ny] === color) {
          liberties += countLiberties(nx, ny, visited);
        } else if (board[nx][ny] === null) {
          liberties++;
        }
      }
    }
    return liberties;
  };

  // 돌 그룹과 호석 찾기
  const getGroupAndLiberties = (x: number, y: number, newBoard: BoardState) => {
    const color = newBoard[x][y];
    const group: { x: number; y: number }[] = [];
    const visited = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(false));
    let liberties = 0;

    const dfs = (x: number, y: number) => {
      if (
        x < 0 ||
        y < 0 ||
        x >= BOARD_SIZE ||
        y >= BOARD_SIZE ||
        visited[x][y] ||
        newBoard[x][y] !== color
      )
        return;
      visited[x][y] = true;
      group.push({ x, y });
      const directions = [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ];
      for (const [dx, dy] of directions) {
        const nx = x + dx,
          ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < BOARD_SIZE && ny < BOARD_SIZE) {
          if (newBoard[nx][ny] === null) liberties++;
          dfs(nx, ny);
        }
      }
    };

    dfs(x, y);
    return { group, liberties };
  };

  // 돌 놓기 + 규칙 검증
  const handlePlaceStone = (x: number, y: number) => {
    if (board[x][y] !== null) return;

    const newBoard = board.map((row) => [...row]);
    newBoard[x][y] = isBlackTurn ? "black" : "white";
    const currentColor = newBoard[x][y];

    // 2. 상대 돌 따내기
    const directions = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ];
    let capturedStones = false;
    for (const [dx, dy] of directions) {
      const nx = x + dx,
        ny = y + dy;
      if (
        nx >= 0 &&
        ny >= 0 &&
        nx < BOARD_SIZE &&
        ny < BOARD_SIZE &&
        newBoard[nx][ny] &&
        newBoard[nx][ny] !== currentColor
      ) {
        const { group, liberties } = getGroupAndLiberties(nx, ny, newBoard);
        if (liberties === 0) {
          capturedStones = true;
          for (const stone of group) {
            newBoard[stone.x][stone.y] = null;
          }
        }
      }
    }

    // 3. 패(ko) 규칙 검증 (무한 반복 금지)
    const isKo = prevBoardsRef.current.some(
      (prevBoard) => JSON.stringify(prevBoard) == JSON.stringify(newBoard)
    );

    if (isKo && capturedStones) {
      setErrorMessage("패(ko) 규칙에 따라 둘 수 없습니다.");
      return;
    }

    // 3. 자충수 검증

    const { liberties } = getGroupAndLiberties(x, y, newBoard);
    if (!capturedStones && liberties === 0) {
      setErrorMessage("자충수는 둘 수 없습니다.");
      return;
    }

    // 4. 상태 업데이트
    prevBoardsRef.current = [newBoard, ...prevBoardsRef.current].slice(0, 2); // 최근 2개 보드 저장
    setBoard(newBoard);
    setIsBlackTurn(!isBlackTurn);
    setErrorMessage("");
  };

  // 마우스 이벤트 핸들러
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const offsetX = rect.width * OFFSET_RATIO;
    const offsetY = rect.height * OFFSET_RATIO;
    const usableWidth = rect.width - 2 * offsetX;
    const usableHeight = rect.height - 2 * offsetY;
    const relX = e.clientX - rect.left - offsetX;
    const relY = e.clientY - rect.top - offsetY;

    if (relX < 0 || relY < 0 || relX > usableWidth || relY > usableHeight) {
      setHoverPos(null);
      return;
    }

    const cellWidth = usableWidth / (BOARD_SIZE - 1);
    const cellHeight = usableHeight / (BOARD_SIZE - 1);
    const x = Math.round(relX / cellWidth);
    const y = Math.round(relY / cellHeight);

    if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) {
      setHoverPos(null);
      return;
    }
    setHoverPos({ x, y });
  };

  return (
    <>
      {errorMessage && (
        <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-sm z-10">
          {errorMessage}
        </div>
      )}
      <div
        ref={boardRef}
        onClick={() => hoverPos && handlePlaceStone(hoverPos.x, hoverPos.y)}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverPos(null)}
        className="relative w-full max-w-[90vmin] aspect-square border-2 border-gray-800 select-none"
      >
        <Image
          src="/go_ban.svg"
          alt="바둑판"
          layout="fill"
          objectFit="contain"
          priority
          draggable={false}
        />

        {/* 기존 돌들 렌더링 */}
        {board.map((row, x) =>
          row.map(
            (color, y) =>
              color && (
                <Image
                  key={`${x}-${y}`}
                  src={
                    color === "black" ? "/black_stone.png" : "/white_stone.png"
                  }
                  alt={`${color} stone`}
                  width={1000} // 실제 크기는 style에서 %로 제어
                  height={1000}
                  draggable={false}
                  style={{
                    position: "absolute",
                    left: `calc(${
                      (OFFSET_RATIO +
                        (x / (BOARD_SIZE - 1)) * (1 - 2 * OFFSET_RATIO)) *
                      100
                    }% - ${stoneSize / 2}px)`, // 중앙 정렬
                    top: `calc(${
                      (OFFSET_RATIO +
                        (y / (BOARD_SIZE - 1)) * (1 - 2 * OFFSET_RATIO)) *
                      100
                    }% - ${stoneSize / 2}px)`, // 중앙 정렬
                    width: `${stoneSize}px`,
                    height: `${stoneSize}px`,
                    pointerEvents: "none",
                  }}
                />
              )
          )
        )}

        {/* 미리보기 돌 */}
        {hoverPos && !board[hoverPos.x][hoverPos.y] && (
          <Image
            src={isBlackTurn ? "/black_stone.png" : "/white_stone.png"}
            alt="preview stone"
            width={1000} // 실제 크기는 style에서 %로 제어
            height={1000}
            draggable={false}
            style={{
              position: "absolute",
              left: `calc(${
                (OFFSET_RATIO +
                  (hoverPos.x / (BOARD_SIZE - 1)) * (1 - 2 * OFFSET_RATIO)) *
                100
              }% - ${stoneSize / 2}px)`,
              top: `calc(${
                (OFFSET_RATIO +
                  (hoverPos.y / (BOARD_SIZE - 1)) * (1 - 2 * OFFSET_RATIO)) *
                100
              }% - ${stoneSize / 2}px)`,
              opacity: 0.5,
              pointerEvents: "none",
              width: `${stoneSize}px`,
              height: `${stoneSize}px`,
            }}
          />
        )}
      </div>
    </>
  );
}
