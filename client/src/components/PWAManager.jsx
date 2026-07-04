// client/src/components/PWAManager.jsx
// Componente global: sólo indicador de "sin conexión".
// El banner de instalación se sacó: ahora la instalación es un bloque
// deliberado en el inicio (InstallHolistic.jsx), no un prompt que aparece solo.

import { usePWA } from '../hooks/usePWA';

export default function PWAManager() {
  const { isOnline } = usePWA();

  return (
    <>
      {!isOnline && (
        <div style={styles.offlineBanner}>
          <span style={styles.offlineDot} />
          Sin conexión — mostrando datos guardados
        </div>
      )}
    </>
  );
}

const styles = {
  offlineBanner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    background: '#e67e22',
    color: '#fff',
    textAlign: 'center',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#fff',
    display: 'inline-block',
  },
};
