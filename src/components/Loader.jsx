export default function Loader({ fullscreen = false }) {
  return <div className={fullscreen ? 'loader-screen' : 'loader-inline'}><div className="loader-orbit"><span/><span/><span/></div><p>Chargement One Market…</p></div>
}
