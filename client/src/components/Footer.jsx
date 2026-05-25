import { useBranding } from "../lib/branding.js";

/* =====================================================================
   Footer — minimal, profesional, paleta Holistic.
   Estructura: brand row + links + copyright. Cero adornos extra.
   Aparece sólo en pages autenticadas (montado en App.jsx).
   ===================================================================== */
export default function Footer() {
    const branding = useBranding();
    const year = new Date().getFullYear();
    const name = branding?.name || "Holistic";

    return (
        <>
            <style>{`
                .h-ft {
                    margin-top: auto;
                    border-top: 1px solid var(--c-border, rgba(255,255,255,.06));
                    background: var(--c-bg, #06070A);
                    color: var(--c-text-3, rgba(245,242,235,.5));
                }
                .h-ft__inner {
                    max-width: 1280px;
                    margin: 0 auto;
                    padding: var(--sp-8, 32px) clamp(20px, 4vw, 40px);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: var(--sp-6, 24px);
                    flex-wrap: wrap;
                }
                .h-ft__brand {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    color: var(--c-text-2, rgba(245,242,235,.72));
                }
                .h-ft__dot {
                    width: 6px; height: 6px;
                    border-radius: 50%;
                    background: var(--c-accent, #A7F5C8);
                    box-shadow: 0 0 8px var(--c-accent-glow, rgba(167,245,200,.32));
                }
                .h-ft__name {
                    font-family: var(--f-display, 'Gotham', sans-serif);
                    font-weight: 900;
                    font-size: 14px;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                }
                .h-ft__nav {
                    display: inline-flex;
                    align-items: center;
                    gap: var(--sp-5, 20px);
                }
                .h-ft__link {
                    font-family: var(--f-body, 'Gotham', sans-serif);
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                    color: var(--c-text-3, rgba(245,242,235,.5));
                    text-decoration: none;
                    transition: color var(--dur-fast, 150ms) ease;
                }
                .h-ft__link:hover { color: var(--c-text, #F5F2EB); }
                .h-ft__copy {
                    font-family: var(--f-body, 'Gotham', sans-serif);
                    font-size: 10px;
                    letter-spacing: 0.1em;
                    color: var(--c-text-disabled, rgba(245,242,235,.3));
                    white-space: nowrap;
                }
                @media (max-width: 640px) {
                    .h-ft__inner { padding: 24px 20px; }
                    .h-ft__nav { gap: 14px; flex-wrap: wrap; justify-content: center; }
                }
            `}</style>

            <footer className="h-ft" role="contentinfo">
                <div className="h-ft__inner">
                    <div className="h-ft__brand">
                        <span className="h-ft__dot" aria-hidden="true" />
                        <span className="h-ft__name">{name}</span>
                    </div>

                    <nav className="h-ft__nav" aria-label="Footer">
                        <a href="/perfil" className="h-ft__link">Mi cuenta</a>
                        <a href="/coins" className="h-ft__link">Coins</a>
                        <a href="/chat" className="h-ft__link">Soporte</a>
                        <a href="https://hgrowshop.com" className="h-ft__link" target="_blank" rel="noreferrer">Web</a>
                    </nav>

                    <p className="h-ft__copy">
                        © {year} {name.toUpperCase()} · TODOS LOS DERECHOS RESERVADOS
                    </p>
                </div>
            </footer>
        </>
    );
}
