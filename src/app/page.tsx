"use client";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import {
  BOARD_SIZE,
  countCapturedStones,
  findBoardDiff,
  handleFileUpload,
  LINE_RATIO,
  OFFSET_RATIO,
  saveSgf,
} from "./utils";
import { BoardState } from "./types/types";

export default function PreciseGoban() {
  const boardRef = useRef<HTMLDivElement>(null);
  const prevBoardsRef = useRef<BoardState[]>([]); // 패(ko) 규칙을 위한 이전 보드 상태 기록

  const [board, setBoard] = useState<BoardState>(
    Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null))
  );
  const [prevBoards, setPrevBoards] = useState<BoardState[]>([
    Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null)),
  ]);
  const [isBlackTurn, setIsBlackTurn] = useState(true);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [stoneSize, setStoneSize] = useState(60);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [lastMove, setLastMove] = useState<{ x: number; y: number } | null>(
    null
  );
  const [rectWidth, setRectWidth] = useState(0);
  const [cellWidth, setCellWidth] = useState(0);
  const [lineWidth, setLineWidth] = useState(0);

  useEffect(() => {
    const updateStoneSize = () => {
      if (boardRef.current) {
        const rect = boardRef.current.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(boardRef.current);
        const borderLeft = parseFloat(computedStyle.borderLeftWidth || "0");
        const borderRight = parseFloat(computedStyle.borderRightWidth || "0");

        const totalBorder = borderLeft + borderRight;
        const usableRectWidth = rect.width - totalBorder;
        setRectWidth(usableRectWidth);

        const offsetX = usableRectWidth * OFFSET_RATIO;
        const oneLine = usableRectWidth * LINE_RATIO;
        const usableWidth =
          usableRectWidth - 2 * offsetX - BOARD_SIZE * oneLine;
        const cellWidth = usableWidth / (BOARD_SIZE - 1);
        setCellWidth(cellWidth);
        setLineWidth(oneLine);

        console.log(usableRectWidth);
        console.log(cellWidth);

        setStoneSize(cellWidth);
      }
    };

    updateStoneSize();

    const node = boardRef.current;
    const resizeObserver = new ResizeObserver(updateStoneSize);

    if (node) {
      resizeObserver.observe(node);
    }

    return () => {
      if (node) {
        resizeObserver.unobserve(node);
      }
    };
  }, []);

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
    setPrevBoards((prev) => {
      const updated = [
        newBoard,
        ...prev.slice(-(prev.length - currentMoveIndex)),
      ];
      setIsBlackTurn(!isBlackTurn); // 다음 턴 색상 전환

      return updated;
    });

    setCurrentMoveIndex(0);
    setErrorMessage("");
    setLastMove({ x, y });
  };

  // 공통 좌표 계산 함수
  const updateHoverAndPlace = (
    clientX: number,
    clientY: number,
    shouldPlace = false
  ) => {
    if (!boardRef.current) return;

    const rect = boardRef.current.getBoundingClientRect();
    const offsetX = rect.width * OFFSET_RATIO;
    const offsetY = rect.height * OFFSET_RATIO;
    const usableWidth = rect.width - 2 * offsetX;
    const usableHeight = rect.height - 2 * offsetY;

    const relX = clientX - rect.left - offsetX;
    const relY = clientY - rect.top - offsetY;

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
    if (shouldPlace) {
      handlePlaceStone(x, y);
    }
  };

  const nextSu = useCallback(() => {
    const nextIndex = currentMoveIndex - 1;
    if (nextIndex >= 0) {
      const nextBoard = prevBoards[nextIndex];
      setBoard(nextBoard);
      setCurrentMoveIndex(nextIndex);

      // 최신 수 위치 찾기
      const diff = findBoardDiff(prevBoards[nextIndex + 1], nextBoard);
      if (diff) setLastMove(diff);

      setIsBlackTurn((prevBoards.length - nextIndex) % 2 == 0);
    }
  }, [currentMoveIndex, prevBoards]);

  const prevSu = useCallback(() => {
    const nextIndex = currentMoveIndex + 1;
    if (nextIndex < prevBoards.length) {
      const nextBoard = prevBoards[nextIndex];
      setBoard(nextBoard);
      setCurrentMoveIndex(nextIndex);

      if (nextIndex + 1 < prevBoards.length) {
        const diff = findBoardDiff(prevBoards[nextIndex + 1], nextBoard);
        if (diff) setLastMove(diff);
      }

      setIsBlackTurn((prevBoards.length - nextIndex) % 2 == 0);
    }
  }, [currentMoveIndex, prevBoards]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        // 왼쪽 화살표 누름 → 이전 수로 이동
        prevSu();
      } else if (e.key === "ArrowRight") {
        // 오른쪽 화살표 누름 → 다음 수로 이동
        nextSu();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [prevSu, nextSu]);

  const { blackCaptured, whiteCaptured } = useMemo(
    () => countCapturedStones(prevBoards.slice(currentMoveIndex)),
    [prevBoards, currentMoveIndex]
  );

  return (
    <div className="w-full flex justify-center items-center">
      <div className="flex flex-col items-center w-full max-w-[100vmin] md:max-w-[600px]">
        {errorMessage && (
          <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-sm z-10">
            {errorMessage}
          </div>
        )}
        <div
          ref={boardRef}
          onMouseMove={(e) => updateHoverAndPlace(e.clientX, e.clientY)}
          onClick={() => {
            if (hoverPos) handlePlaceStone(hoverPos.x, hoverPos.y);
          }}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            updateHoverAndPlace(touch.clientX, touch.clientY, true); // 즉시 착수
          }}
          className="relative w-full max-w-[90vmin] aspect-square select-none"
        >
          <Image
            src="/go_ban.svg"
            alt="바둑판"
            fill
            priority
            draggable={false}
            style={{ objectFit: "contain" }}
          />

          {/* 기존 돌들 렌더링 */}
          {board.map((row, x) =>
            row.map(
              (color, y) =>
                color && (
                  <Image
                    key={`${x}-${y}`}
                    src={
                      color === "black"
                        ? "/black_stone.png"
                        : "/white_stone.png"
                    }
                    alt={`${color} stone`}
                    width={1000} // 실제 크기는 style에서 %로 제어
                    height={1000}
                    draggable={false}
                    style={{
                      position: "absolute",
                      left: `${
                        rectWidth * OFFSET_RATIO +
                        x * (cellWidth + lineWidth) +
                        lineWidth -
                        stoneSize / 2
                      }px`,
                      top: `${
                        rectWidth * OFFSET_RATIO +
                        y * (cellWidth + lineWidth) +
                        lineWidth -
                        stoneSize / 2
                      }px`,
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
                left: `${
                  rectWidth * OFFSET_RATIO +
                  hoverPos.x * (cellWidth + lineWidth) +
                  lineWidth -
                  stoneSize / 2
                }px`,
                top: `${
                  rectWidth * OFFSET_RATIO +
                  hoverPos.y * (cellWidth + lineWidth) +
                  lineWidth -
                  stoneSize / 2
                }px`,
                opacity: 0.5,
                pointerEvents: "none",
                width: `${stoneSize}px`,
                height: `${stoneSize}px`,
              }}
            />
          )}

          {lastMove && board[lastMove.x][lastMove.y] && (
            <div
              style={{
                position: "absolute",
                left: `${
                  rectWidth * OFFSET_RATIO +
                  lastMove.x * (cellWidth + lineWidth) +
                  lineWidth -
                  stoneSize / 4
                }px`,
                top: `${
                  rectWidth * OFFSET_RATIO +
                  lastMove.y * (cellWidth + lineWidth) +
                  lineWidth -
                  stoneSize / 4
                }px`,
                width: 0,
                height: 0,
                borderLeft: `${stoneSize / 4}px solid transparent`,
                borderRight: `${stoneSize / 4}px solid transparent`,
                borderTop: `${stoneSize / 2}px solid blue`, // 세모의 색상과 방향
                pointerEvents: "none",
                zIndex: 10,
              }}
            />
          )}
        </div>
        <br></br>
        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          <button
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            onClick={prevSu}
            disabled={currentMoveIndex >= prevBoards.length - 1}
          >
            ◀ 이전 수
          </button>

          <span>
            {prevBoards.length - 1 - currentMoveIndex} / {prevBoards.length - 1}
          </span>

          <button
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            onClick={nextSu}
            disabled={currentMoveIndex <= 0}
          >
            다음 수 ▶
          </button>
        </div>

        <br></br>

        <div className="mt-4 flex gap-4 text-sm text-gray-800">
          <div>⚪ 백 사석: {whiteCaptured}</div>
          <div>⚫ 흑 사석: {blackCaptured}</div>
        </div>

        <br></br>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => saveSgf(prevBoards)}
            className="px-3 py-1 bg-green-600 text-white rounded"
          >
            SGF 저장
          </button>

          <label className="px-3 py-1 bg-blue-600 text-white rounded cursor-pointer">
            SGF 불러오기
            <input
              type="file"
              accept=".sgf"
              onChange={(e) =>
                handleFileUpload(
                  e,
                  setPrevBoards,
                  setBoard,
                  setCurrentMoveIndex
                )
              }
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
