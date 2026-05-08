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
                    border-top: 1px solid var(--h-line-1);
                    background: var(--h-bg-0);
                    color: var(--h-text-3);
                }
                .h-ft__inner {
                    max-width: 1280px;
                    margin: 0 auto;
                    padding: var(--h-sp-7) var(--h-content-mx);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: var(--h-sp-6);
                    flex-wrap: wrap;
                }
                .h-ft__brand {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    color: var(--h-text-2);
                }
                .h-ft__dot {
                    width: 6px; height: 6px;
                    border-radius: 50%;
                    background: var(--h-green);
                    box-shadow: 0 0 8px var(--h-green-glow);
                }
                .h-ft__name {
                    font-family: var(--h-font-display);
                    font-size: 14px;
                    letter-spacing: 3px;
                    text-transform: uppercase;
                }
                .h-ft__nav {
                    display: inline-flex;
                    align-items: center;
                    gap: var(--h-sp-5);
                }
                .h-ft__link {
                    font-family: var(--h-font-mono);
                    font-size: 11px;
                    font-weight: 500;
                    letter-spacing: 1.4px;
                    text-transform: uppercase;
                    color: var(--h-text-3);
                    text-decoration: none;
                    transition: color var(--h-trans-fast);
                }
                .h-ft__link:hover { color: var(--h-text-1); }
                .h-ft__copy {
                    font-family: var(--h-font-mono);
                    font-size: 10px;
                    letter-spacing: 1px;
                    color: var(--h-text-4);
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
