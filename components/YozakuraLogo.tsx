// ============================================================
// YOZAKURA LOGO
// Vầng trăng khuyết vàng đan xen bông hoa anh đào hồng + sao
// ============================================================

import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Line,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

interface YozakuraLogoProps {
  size?: number;
  /** Màu nền phía sau logo — cần cho hiệu ứng trăng khuyết */
  bgColor?: string;
  style?: StyleProp<ViewStyle>;
}

// ── Hàm tạo path ngôi sao 4 cánh ────────────────────────────
function star4(x: number, y: number, outer: number): string {
  const inner = outer * 0.28;
  const o = outer, i = inner;
  return (
    `M ${x} ${y - o}` +
    ` L ${x + i} ${y - i} L ${x + o} ${y}` +
    ` L ${x + i} ${y + i} L ${x} ${y + o}` +
    ` L ${x - i} ${y + i} L ${x - o} ${y}` +
    ` L ${x - i} ${y - i} Z`
  );
}

// ── Vị trí cánh hoa (dùng chung) ─────────────────────────────
const PETAL_ANGLES = [0, 72, 144, 216, 288]; // 0 = thẳng lên (bắc)
const PETAL_DIST   = 14;   // khoảng cách tâm hoa → tâm cánh
const PETAL_RX     = 6.5;  // chiều ngang cánh hoa
const PETAL_RY     = 10.5; // chiều dài cánh hoa (hướng ra ngoài)

function petalCenter(
  fx: number, fy: number, angleDeg: number, dist = PETAL_DIST,
): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [fx + dist * Math.sin(rad), fy - dist * Math.cos(rad)];
}

export function YozakuraLogo({
  size = 120,
  bgColor = '#FFFBFB',
  style,
}: YozakuraLogoProps) {
  // Tọa độ các thành phần
  const moonCx = 40,  moonCy = 52,  moonR  = 29;   // vòng ngoài mặt trăng
  const cutCx  = 54,  cutCy  = 43,  cutR   = 23;   // vòng "cắt" tạo khuyết
  const fx = 68, fy = 68;                           // tâm bông hoa

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" style={style}>
      <Defs>
        {/* Gradient mặt trăng: trắng nhạt ở giữa, vàng ở rìa */}
        <RadialGradient id="moonGrad" cx="40%" cy="55%" r="70%">
          <Stop offset="0%"   stopColor="#FEFDF0" stopOpacity="1" />
          <Stop offset="60%"  stopColor="#FFF4D0" stopOpacity="1" />
          <Stop offset="100%" stopColor="#FEF1B7" stopOpacity="1" />
        </RadialGradient>

        {/* Gradient cánh hoa chính: trắng nhạt → hồng sakura */}
        <RadialGradient id="petalMain" cx="50%" cy="60%" r="80%">
          <Stop offset="0%"   stopColor="#FFF5F7" stopOpacity="1" />
          <Stop offset="100%" stopColor="#FFD1DC" stopOpacity="1" />
        </RadialGradient>

        {/* Gradient cánh hoa lớp sau: đậm hơn 1 chút */}
        <RadialGradient id="petalBack" cx="50%" cy="60%" r="80%">
          <Stop offset="0%"   stopColor="#FFE8EE" stopOpacity="1" />
          <Stop offset="100%" stopColor="#FFC4D0" stopOpacity="1" />
        </RadialGradient>
      </Defs>

      {/* ── 🌙 Vầng trăng khuyết ──────────────────────────── */}

      {/* Hào quang mờ phía sau trăng */}
      <Circle cx={moonCx} cy={moonCy} r={moonR + 7} fill="#FFF4D0" opacity={0.18} />
      <Circle cx={moonCx} cy={moonCy} r={moonR + 3} fill="#FFF4D0" opacity={0.22} />

      {/* Hình tròn vàng đầy đủ */}
      <Circle cx={moonCx} cy={moonCy} r={moonR} fill="url(#moonGrad)" />

      {/* Vòng cắt tạo phần khuyết (dùng màu nền để "xóa") */}
      <Circle cx={cutCx} cy={cutCy} r={cutR} fill={bgColor} />

      {/* Viền sáng ở rìa lõm của trăng khuyết */}
      <Circle
        cx={cutCx} cy={cutCy} r={cutR}
        fill="none" stroke="#FEF1B7" strokeWidth={1.5} opacity={0.85}
      />

      {/* Chấm sáng nhỏ trên bề mặt trăng */}
      <Circle cx={28} cy={44} r={2.8} fill="#FFFEF5" opacity={0.6} />
      <Circle cx={22} cy={58} r={1.8} fill="#FFFEF5" opacity={0.45} />
      <Circle cx={35} cy={72} r={1.4} fill="#FFFEF5" opacity={0.35} />

      {/* ── 🌸 Bông hoa anh đào ───────────────────────────── */}

      {/* Lớp cánh sau (xoay lệch 36°, đậm hơn, tạo chiều sâu) */}
      {PETAL_ANGLES.map((angleDeg, i) => {
        const [px, py] = petalCenter(fx, fy, angleDeg + 36, PETAL_DIST + 1);
        return (
          <Ellipse
            key={`pb${i}`}
            cx={px} cy={py}
            rx={PETAL_RX - 0.5} ry={PETAL_RY - 1}
            fill="url(#petalBack)"
            opacity={0.55}
            transform={`rotate(${angleDeg + 36}, ${px}, ${py})`}
          />
        );
      })}

      {/* Cánh hoa chính (5 cánh, lớp trên) */}
      {PETAL_ANGLES.map((angleDeg, i) => {
        const [px, py] = petalCenter(fx, fy, angleDeg);
        // Đầu cánh hoa (outer tip) — để vẽ rãnh anh đào
        const tipRad  = (angleDeg * Math.PI) / 180;
        const tipDist = PETAL_DIST + PETAL_RY;
        const tipX = fx + tipDist * Math.sin(tipRad);
        const tipY = fy - tipDist * Math.cos(tipRad);
        const notchDist = PETAL_DIST + PETAL_RY - 5;
        const notchX = fx + notchDist * Math.sin(tipRad);
        const notchY = fy - notchDist * Math.cos(tipRad);
        return (
          <React.Fragment key={`petal${i}`}>
            <Ellipse
              cx={px} cy={py}
              rx={PETAL_RX} ry={PETAL_RY}
              fill="url(#petalMain)"
              stroke="#FFB7C5"
              strokeWidth={0.7}
              transform={`rotate(${angleDeg}, ${px}, ${py})`}
            />
            {/* Rãnh nhỏ đặc trưng của hoa anh đào (đường vào đỉnh cánh) */}
            <Line
              x1={notchX} y1={notchY}
              x2={tipX}   y2={tipY}
              stroke="#FFB7C5"
              strokeWidth={1.2}
              strokeLinecap="round"
              opacity={0.65}
            />
          </React.Fragment>
        );
      })}

      {/* Nhụy hoa (vòng ngoài và tâm) */}
      <Circle cx={fx} cy={fy} r={8}   fill="#FFF8E0" stroke="#FEF1B7" strokeWidth={0.8} />
      <Circle cx={fx} cy={fy} r={5}   fill="#FFF4D0" />
      <Circle cx={fx} cy={fy} r={3.2} fill="#FFB7C5" />

      {/* Chỉ nhụy — 8 chấm nhỏ quanh tâm */}
      {Array.from({ length: 8 }, (_, i) => {
        const a   = (i * 45 * Math.PI) / 180;
        const r   = 6;
        const len = i % 2 === 0 ? 1.2 : 0.9;   // xen kẽ to nhỏ
        return (
          <Circle
            key={`s${i}`}
            cx={fx + r * Math.cos(a)}
            cy={fy + r * Math.sin(a)}
            r={len}
            fill="#FF8FA8"
          />
        );
      })}

      {/* ── ✦ Ngôi sao ────────────────────────────────────── */}

      {/* Sao lớn — góc trên phải */}
      <Path d={star4(89, 16, 6)}   fill="#FEF1B7" />
      {/* Sao vừa — góc trên trái */}
      <Path d={star4(16, 18, 4.5)} fill="#FFF4D0" />
      {/* Sao nhỏ — cạnh phải */}
      <Path d={star4(107, 58, 3.5)} fill="#FEF1B7" />
      {/* Sao nhỏ — góc dưới trái */}
      <Path d={star4(12, 87, 3)}   fill="#FFF4D0" />
      {/* Sao tí — giữa dưới phải */}
      <Path d={star4(100, 96, 2.5)} fill="#FEF1B7" opacity={0.75} />

      {/* ── 🌸 Cánh hoa rơi (trang trí) ─────────────────── */}

      {/* Cánh rơi 1 — bên trái */}
      <Ellipse
        cx={17} cy={57} rx={3} ry={4.5}
        fill="#FFD1DC" opacity={0.65}
        transform="rotate(-40, 17, 57)"
      />
      {/* Cánh rơi 2 — góc trên phải */}
      <Ellipse
        cx={104} cy={32} rx={2.5} ry={3.5}
        fill="#FFD1DC" opacity={0.55}
        transform="rotate(20, 104, 32)"
      />
      {/* Cánh rơi 3 — góc dưới trái */}
      <Ellipse
        cx={22} cy={103} rx={2.8} ry={4}
        fill="#FFD1DC" opacity={0.5}
        transform="rotate(50, 22, 103)"
      />
    </Svg>
  );
}
