import { useCallback } from "react";

interface Props {
  side: "left" | "right";
  currentWidth: number;
  onResize: (w: number) => void;
  minWidth?: number;
  maxWidth?: number;
}

export default function ResizeHandle({
  side,
  currentWidth,
  onResize,
  minWidth = 180,
  maxWidth = 600,
}: Props) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = currentWidth;

      const onMove = (ev: MouseEvent) => {
        const delta =
          side === "left" ? ev.clientX - startX : startX - ev.clientX;
        onResize(Math.min(maxWidth, Math.max(minWidth, startWidth + delta)));
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [side, currentWidth, onResize, minWidth, maxWidth],
  );

  const edgeStyle = side === "left" ? { right: -4 } : { left: -4 };

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute top-0 bottom-0 group cursor-col-resize z-10 flex items-center justify-center"
      style={{ ...edgeStyle, width: 10 }}
    >
      {/* Thin red line — appears on hover */}
      <div
        className="w-[5px] h-90 z-200 transition-all duration-150 opacity-0 group-hover:opacity-100"
        style={{
          background: "rgba(232,0,45,0.7)",
          boxShadow: "0 0 16px rgba(232,0,45,1.6)",
        }}
      />
    </div>
  );
}
