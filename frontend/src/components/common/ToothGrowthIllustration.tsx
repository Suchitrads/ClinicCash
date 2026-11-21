const toothStyles = `
@keyframes tooth-enter-keyframes {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes tooth-float-keyframes {
  0% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
  100% { transform: translateY(0); }
}
.tooth-enter {
  animation: tooth-enter-keyframes 900ms ease-out both;
}
.tooth-float {
  animation: tooth-float-keyframes 6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .tooth-enter,
  .tooth-float {
    animation: none;
  }
}
`;

const TOOTH_PATH =
  'M150 20 C210 14 262 34 276 92 C286 140 270 176 262 210 C254 250 246 300 222 318 C200 334 180 300 172 262 C168 240 160 230 150 230 C140 230 132 240 128 262 C120 300 100 334 78 318 C54 300 46 250 38 210 C30 176 14 140 24 92 C38 34 90 14 150 20 Z';

export default function ToothGrowthIllustration() {
  return (
    <div className="tooth-enter w-full max-w-[320px] mx-auto">
      <style>{toothStyles}</style>
      <div className="tooth-float">
        <svg
          viewBox="0 0 300 340"
          width="100%"
          height="auto"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          className="block w-full h-auto"
        >
          <defs>
            <linearGradient id="tooth-body-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#e6ebf0" />
              <stop offset="100%" stopColor="#cfd8e0" />
            </linearGradient>
            <filter id="tooth-highlight-blur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
            <filter id="tooth-shadow-blur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          {/* Soft grey shadow beneath the tooth */}
          <ellipse
            cx="150"
            cy="326"
            rx="110"
            ry="9"
            fill="#0f172a"
            opacity="0.12"
            filter="url(#tooth-shadow-blur)"
          />

          {/* Tooth body */}
          <path
            d={TOOTH_PATH}
            fill="url(#tooth-body-grad)"
            stroke="#d5dde5"
            strokeWidth="1.5"
          />

          {/* Subtle inner shade along the lower edge of the crown */}
          <path
            d="M40 200 C60 240 110 236 150 230 C190 236 240 240 260 200 C250 230 230 250 150 240 C70 250 50 230 40 200 Z"
            fill="#b9c4cf"
            opacity="0.25"
          />

          {/* Glossy highlight */}
          <ellipse
            cx="110"
            cy="90"
            rx="40"
            ry="18"
            transform="rotate(-20 110 90)"
            fill="#ffffff"
            opacity="0.7"
            filter="url(#tooth-highlight-blur)"
          />
        </svg>
      </div>
    </div>
  );
}
