"use client";
import { useState, useRef } from "react";
import Image from "next/image";

const BOARD_SIZE = 19;
const OFFSET_RATIO = 0.031;

export default function PreciseGoban() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [stones, setStones] = useState<Record<string, "black" | "white">>({});
  const [isBlackTurn, setIsBlackTurn] = useState(true);

  // 미리보기용 현재 마우스 위치
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(
    null
  );

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!boardRef.current) return;
    if (!hoverPos) return;

    const key = `${hoverPos.x}-${hoverPos.y}`;
    if (stones[key]) return;

    setStones((prev) => ({ ...prev, [key]: isBlackTurn ? "black" : "white" }));
    setIsBlackTurn(!isBlackTurn);
  };

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

  const handleMouseLeave = () => {
    setHoverPos(null);
  };

  return (
    <div
      ref={boardRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
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

      {/* 기존 돌들 */}
      {Object.entries(stones).map(([key, color]) => {
        const [x, y] = key.split("-").map(Number);
        const usableRatio = 1 - 2 * OFFSET_RATIO;
        const leftPercent = OFFSET_RATIO + (x / (BOARD_SIZE - 1)) * usableRatio;
        const topPercent = OFFSET_RATIO + (y / (BOARD_SIZE - 1)) * usableRatio;

        return (
          <Image
            key={key}
            src={color === "black" ? "/black_stone.png" : "/white_stone.png"}
            alt={`${color} stone`}
            width={60}
            height={60}
            draggable={false}
            style={{
              position: "absolute",
              left: `calc(${leftPercent * 100}% - 30px)`,
              top: `calc(${topPercent * 100}% - 30px)`,
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* 마우스 오버 시 미리보기 돌 */}
      {hoverPos && !stones[`${hoverPos.x}-${hoverPos.y}`] && (
        <Image
          src={isBlackTurn ? "/black_stone.png" : "/white_stone.png"}
          alt="preview stone"
          width={60}
          height={60}
          draggable={false}
          style={{
            position: "absolute",
            left: `calc(${
              (OFFSET_RATIO +
                (hoverPos.x / (BOARD_SIZE - 1)) * (1 - 2 * OFFSET_RATIO)) *
              100
            }% - 30px)`,
            top: `calc(${
              (OFFSET_RATIO +
                (hoverPos.y / (BOARD_SIZE - 1)) * (1 - 2 * OFFSET_RATIO)) *
              100
            }% - 30px)`,
            opacity: 0.5,
            pointerEvents: "none",
            transition: "left 0.1s ease, top 0.1s ease",
          }}
        />
      )}
    </div>
  );
}
