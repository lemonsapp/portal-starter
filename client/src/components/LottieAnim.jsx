import { useEffect, useRef, useState } from "react";
import Lottie from "lottie-react";

/**
 * Wrapper de Lottie que acepta:
 * - `data`: JSON inline (importado o estático)
 * - `src`: URL a un .json (ej: lottiefiles.com)
 *
 * Props extra:
 * - `loop` (default true)
 * - `autoplay` (default true)
 * - `size` (number) → ancho/alto. También podés usar `style`
 * - `speed` (default 1)
 * - `hover` → pausa hasta hover (efecto premium)
 *
 * Usage:
 *   <LottieAnim src="https://assets-v2.lottiefiles.com/.../animation.json" size={64} />
 *   <LottieAnim data={importedJson} loop={false} autoplay onComplete={…} />
 */
export default function LottieAnim({
  data,
  src,
  loop = true,
  autoplay = true,
  size,
  speed = 1,
  hover = false,
  style = {},
  className = "",
  onComplete,
}) {
  const [json, setJson] = useState(data || null);
  const [hovered, setHovered] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (data) { setJson(data); return; }
    if (!src) return;
    let abort = false;
    fetch(src).then(r => r.json()).then(d => { if (!abort) setJson(d); }).catch(() => {});
    return () => { abort = true; };
  }, [data, src]);

  useEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    inst.setSpeed?.(speed);
    if (hover) {
      if (hovered) inst.play?.(); else inst.pause?.();
    }
  }, [speed, hover, hovered, json]);

  if (!json) return <span style={{ display: "inline-block", width: size || 24, height: size || 24, ...style }} />;

  return (
    <span
      onMouseEnter={() => hover && setHovered(true)}
      onMouseLeave={() => hover && setHovered(false)}
      className={className}
      style={{ display: "inline-block", lineHeight: 0, width: size, height: size, ...style }}
    >
      <Lottie
        lottieRef={ref}
        animationData={json}
        loop={loop}
        autoplay={autoplay && !hover}
        onComplete={onComplete}
      />
    </span>
  );
}
