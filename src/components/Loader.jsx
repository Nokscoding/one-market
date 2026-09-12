export default function Loader({ fullscreen = false, size = 'default' }) {
  return <div className={`om-loader ${fullscreen ? 'om-loader--fullscreen' : ''} ${size === 'small' ? 'om-loader--small' : ''}`} role="status" aria-live="polite" aria-label="Chargement"><div className="om-loader-loop" aria-hidden="true"><div className="om-loader-mark-frame"><img src="https://res.cloudinary.com/nks-services/image/upload/v1788106209/one-market-logo.webp" alt="" className="om-loader-mark" draggable="false" /><span className="om-loader-scan" /></div></div><span className="sr-only">Chargement</span></div>
}
