import "../../styles/TrackMap.css";
import { memo } from "react";
import type { Driver } from "../../types";
import type { TrackPoint, LivePosition } from "../../hooks/useTrackMap";
import { SVG_W, SVG_H } from "../../hooks/useTrackMap";
import { teamHex } from "../../utils/format";

const SINGAPORE_PATH =
  "m791.8 7.5007c-2.7435 0.036122-5.6028 1.2785-9.0274 3.5469-7.5862 5.0249-9.1617 10.044-10.9 34.719-2.3657 33.574-2.3604 33.609 17.818 97.752 17.455 55.484 20.43 91.368 8.6602 104.46-12.416 13.81-16.25 14.216-94.637 10.027-10.02-0.54-48.59-2.55-85.71-4.48-83.415-4.3297-79.842-4.0301-95.262-8.0293-25.008-6.486-42.472-16.45-172.72-98.545-28.216-17.784-34.614-18.317-42.611-3.5547-1.5254 2.8157-8.6803 15.469-15.9 28.119-7.22 12.65-18.724 33.739-25.564 46.865-18.82 36.115-11.012 38.713-77.938-25.922-22.612-21.838-29.195-24.703-44.594-19.414-0.25968 0.0892-0.48898 0.17701-0.74219 0.26562-1.0048 0.29088-2.0109 0.65321-3.0176 1.1133-0.0139 0.008-0.0271 0.0172-0.041 0.0254-13.393 5.293-18.208 12.812-44.65 62.443-12.783 23.993-36.17 66.123-51.971 93.623-37.559 65.33-35.085 60.19-35.314 73.34l-0.18555 10.654 4.6836 7.5273c5.2719 8.4716 7.294 10.265 24.633 21.859 12.937 8.651 19.728 12.107 23.787 12.107 3.2593 0 4.0198 2.1817 5.3965 15.5 3.7093 35.883 4.5412 37.564 29.266 59.174 6.1792 5.4008 11.684 10.301 12.234 10.889 0.55 0.58762 5.3283 4.7644 10.619 9.2832 11.839 10.112 14.53 13.286 29.369 34.654 15.219 21.916 14.677 21.203 17.012 22.367 6.0713 3.0261 10.398-0.64515 13.395-11.367 1.0661-3.8149 13.967-75.437 21.615-120 20.276-118.14 35.299-189.12 43.18-204 7.7524-14.637 13.512-12.666 41.811 14.309 43.81 41.761 92.519 76.914 111.21 80.262 19.456 3.4844 25.736 5.1091 29.463 7.6211 4.3916 2.9604 3.9275 1.8686 9.2773 21.852 9.0477 33.796 6.9638 32.853 84.047 37.984l53 3.5293 6.1426-2.5957c8.1607-3.4474 9.7622-6.6614 15.404-30.92 6.3022-27.097 4.4331-26.12 44.723-23.389 41.077 2.7844 44.156 4.6191 44.213 26.348 0.0585 22.301 14.838 30.508 57.559 31.965 10.428 0.35572 25.709 1.0404 33.959 1.5215 112.24 6.5453 105.87 7.8395 124.84-25.371 18.631-32.619 18.522-22.916 1.5625-139.51-10.03-68.93-21.65-166.6-24.51-205.99-1.4-19.239-7.82-27.04-21.08-25.619-15.76 1.688-33.13-7.105-44.93-22.752-7.54-9.989-12.36-14.317-17.59-14.248z";

interface Props {
  outline: TrackPoint[];
  livePositions: LivePosition[];
  drivers: Driver[];
  selectedDriver: number | null;
  onSelectDriver: (dn: number) => void;
  sessionName: string;
  ready: boolean;
}

export default memo(function TrackMap({
  outline,
  livePositions,
  drivers,
  selectedDriver,
  onSelectDriver,
  sessionName,
  ready,
}: Props) {
  const driverMap = new Map(drivers.map((d) => [d.driver_number, d]));
  const pts = outline
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: "#06070a" }}
    >
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
          `,
          backgroundSize: "72px 72px",
        }}
      />

      {/* Radial vignette — darkens edges so panels blend better */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.72) 100%)",
        }}
      />

      {/* SVG map */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="glow-track" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-dot" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track layers */}
        {outline.length > 1 && (
          <>
            <g id="circuit-layout">
              {/* Wide soft halo */}
              <path
                d={SINGAPORE_PATH}
                fill="none"
                stroke="rgba(255,255,255,1)"
                strokeWidth="28"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Track body */}
              <path
                d={SINGAPORE_PATH}
                fill="none"
                stroke="#181c28"
                strokeWidth="15"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Track surface */}
              <path
                d={SINGAPORE_PATH}
                fill="none"
                stroke="#22273a"
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Edge highlight */}
              <path
                d={SINGAPORE_PATH}
                fill="none"
                stroke="rgba(255,255,255,1.055)"
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Center dashes */}
              <path
                d={SINGAPORE_PATH}
                fill="none"
                stroke="rgba(255,255,255,1.14)"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="9 7"
              />
            </g>{" "}
          </>
        )}

        {!ready && !outline.length && (
          <text
            x={SVG_W / 2}
            y={SVG_H / 2}
            fill="rgba(255,255,255,0.12)"
            fontSize="13"
            textAnchor="middle"
            fontFamily="'Barlow Condensed', sans-serif"
            letterSpacing="5"
          >
            ACQUIRING POSITION DATA
          </text>
        )}

        {/* Driver dots — cx/cy CSS transitions for smooth movement */}
        {livePositions.map((lp) => {
          const driver = driverMap.get(lp.driverNumber);
          const color = teamHex(driver?.team_colour);
          const isSelected = lp.driverNumber === selectedDriver;
          const acronym = driver?.name_acronym ?? String(lp.driverNumber);
          const TRANSITION =
            "cx 0.75s cubic-bezier(0.25,0.46,0.45,0.94), cy 0.75s cubic-bezier(0.25,0.46,0.45,0.94)";

          return (
            <g
              key={lp.driverNumber}
              onClick={() => onSelectDriver(lp.driverNumber)}
              className="cursor-pointer"
            >
              {/* Soft outer glow halo */}
              <circle
                cx={lp.x}
                cy={lp.y}
                r={isSelected ? 20 : 13}
                fill={color}
                opacity={isSelected ? 0.22 : 0.1}
                style={{ transition: TRANSITION }}
              />

              {/* Expanding pulse ring on selected driver */}
              {isSelected && (
                <circle
                  cx={lp.x}
                  cy={lp.y}
                  r="13"
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                  className="driver-pulse-ring"
                  style={{ transition: TRANSITION }}
                />
              )}

              {/* Inner solid ring (selected only) */}
              {isSelected && (
                <circle
                  cx={lp.x}
                  cy={lp.y}
                  r="11"
                  fill="none"
                  stroke={color}
                  strokeWidth="0.8"
                  opacity="0.5"
                  style={{ transition: TRANSITION }}
                />
              )}

              {/* Main driver dot */}
              <circle
                cx={lp.x}
                cy={lp.y}
                r={isSelected ? 9 : 5.5}
                fill={color}
                stroke={
                  isSelected ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.5)"
                }
                strokeWidth={isSelected ? 2 : 0.7}
                filter={isSelected ? "url(#glow-dot)" : undefined}
                style={{ transition: `${TRANSITION}, r 0.3s ease` }}
              />

              {/* White center pip on selected */}
              {isSelected && (
                <circle
                  cx={lp.x}
                  cy={lp.y}
                  r="2.5"
                  fill="rgba(255,255,255,0.95)"
                  style={{ transition: TRANSITION }}
                />
              )}

              {/* Driver acronym */}
              <text
                x={lp.x}
                y={lp.y - (isSelected ? 16 : 10)}
                fill={isSelected ? "#ffffff" : color}
                fontSize={isSelected ? "10" : "7.5"}
                fontWeight="700"
                textAnchor="middle"
                fontFamily="'Barlow Condensed', sans-serif"
                letterSpacing="0.8"
                opacity={isSelected ? 1 : 0.88}
                style={{
                  transition: `x 0.75s cubic-bezier(0.25,0.46,0.45,0.94), y 0.75s cubic-bezier(0.25,0.46,0.45,0.94)`,
                }}
              >
                {acronym}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Corner bracket decorations — broadcast TV style */}
      <div
        className="absolute top-0 left-0 w-14 h-14 pointer-events-none"
        style={{
          borderTop: "2px solid rgba(232,0,45,0.55)",
          borderLeft: "2px solid rgba(232,0,45,0.55)",
        }}
      />
      <div
        className="absolute top-0 right-0 w-14 h-14 pointer-events-none"
        style={{
          borderTop: "2px solid rgba(232,0,45,0.55)",
          borderRight: "2px solid rgba(232,0,45,0.55)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-14 h-14 pointer-events-none"
        style={{
          borderBottom: "2px solid rgba(232,0,45,0.55)",
          borderLeft: "2px solid rgba(232,0,45,0.55)",
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-14 h-14 pointer-events-none"
        style={{
          borderBottom: "2px solid rgba(232,0,45,0.55)",
          borderRight: "2px solid rgba(232,0,45,0.55)",
        }}
      />

      {/* LIVE badge — top right */}
      <div
        className="absolute top-5 right-5 flex items-center gap-2 pointer-events-none"
        style={{
          padding: "4px 12px 4px 8px",
          background: "rgba(232,0,45,0.12)",
          border: "1px solid rgba(232,0,45,0.45)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: "#e8002d",
            animation: "flag-pulse 1.4s ease-in-out infinite",
          }}
        />
        <span
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11,
            fontWeight: 800,
            color: "#e8002d",
            letterSpacing: "0.25em",
          }}
        >
          LIVE
        </span>
      </div>

      {/* Session name — bottom center */}
      <div
        className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          padding: "3px 14px",
          background: "rgba(6,7,10,0.7)",
          border: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(8px)",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          {sessionName}
        </span>
      </div>

      {/* Car count — bottom right */}
      {livePositions.length > 0 && (
        <div
          className="absolute bottom-5 right-5 pointer-events-none"
          style={{
            padding: "3px 10px",
            background: "rgba(6,7,10,0.6)",
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(6px)",
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: "rgba(255,255,255,0.3)",
              letterSpacing: "0.1em",
            }}
          >
            {livePositions.length} CARS
          </span>
        </div>
      )}

      {/* Loading indicator */}
      {!ready && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
          <div className="w-1 h-1 rounded-full bg-[#6b7280] animate-pulse" />
          <span
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10,
              color: "#4b5563",
              letterSpacing: "0.22em",
            }}
          >
            LOADING TRACK DATA
          </span>
        </div>
      )}
    </div>
  );
});
