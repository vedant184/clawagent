"use client";

interface Props {
  seed: string;
  size?: number;
  emoji?: string;
}

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const GRADIENTS = [
  ["#1f6bff", "#3d83ff"],
  ["#8b5cf6", "#c084fc"],
  ["#06b6d4", "#22d3ee"],
  ["#10b981", "#34d399"],
  ["#f59e0b", "#fbbf24"],
  ["#ec4899", "#f472b6"],
  ["#ef4444", "#f87171"],
  ["#6366f1", "#818cf8"],
];

export default function BotAvatar({ seed, size = 40, emoji }: Props) {
  const h = hashString(seed);
  const [a, b] = GRADIENTS[h % GRADIENTS.length];
  const initial = seed.trim().charAt(0).toUpperCase() || "B";
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${a}, ${b})`,
        fontSize: size * 0.45,
      }}
      className="rounded-full flex items-center justify-center font-semibold text-white shadow-lg shrink-0 relative"
    >
      {emoji ? (
        <span style={{ fontSize: size * 0.55 }}>{emoji}</span>
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
