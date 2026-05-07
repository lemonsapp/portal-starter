import { motion } from "framer-motion";

/**
 * Wrappers de Framer Motion para microanimaciones consistentes en todo el portal.
 *
 * <Pop> → tap/hover spring (botones, items de tienda, badges)
 * <FadeUp> → entrada fade + slide up
 * <Pulse> → pulso lento de glow (badges, coins)
 * <Jumbo> → escala bouncy para emoji solos / coin pop
 *
 * Usage:
 *   <Pop as="button" onClick={x}>🪙 Comprar</Pop>
 *   <FadeUp delay={.1}><Card/></FadeUp>
 *   <Jumbo>{emoji}</Jumbo>
 */

export function Pop({ children, as: As = "div", style = {}, hoverScale = 1.04, tapScale = 0.96, ...rest }) {
  const MotionAs = motion[As] || motion.div;
  return (
    <MotionAs
      whileHover={{ scale: hoverScale, y: -1 }}
      whileTap={{ scale: tapScale }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      style={style}
      {...rest}
    >
      {children}
    </MotionAs>
  );
}

export function FadeUp({ children, delay = 0, y = 12, duration = 0.45, style = {}, ...rest }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: [0.2, 0.8, 0.2, 1] }}
      style={style}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function Pulse({ children, color = "var(--brand-primary, #f5e03a)", intensity = 16, duration = 2.4, style = {}, ...rest }) {
  return (
    <motion.div
      animate={{
        boxShadow: [
          `0 0 ${intensity * 0.6}px ${color}66`,
          `0 0 ${intensity * 1.4}px ${color}cc`,
          `0 0 ${intensity * 0.6}px ${color}66`,
        ],
      }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
      style={style}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function Jumbo({ children, style = {}, ...rest }) {
  return (
    <motion.span
      initial={{ scale: 0.8, rotate: -8, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 14 }}
      style={{ display: "inline-block", ...style }}
      {...rest}
    >
      {children}
    </motion.span>
  );
}

/**
 * <CountUp> — número que pulsa cuando cambia (para coins, contadores).
 * Uso:
 *   <CountUp value={balance}>{balance}</CountUp>
 */
export function CountUp({ value, children, color = "var(--brand-primary, #f5e03a)", style = {}, ...rest }) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 1.25, color }}
      animate={{ scale: 1, color: undefined }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{ display: "inline-block", ...style }}
      {...rest}
    >
      {children}
    </motion.span>
  );
}
