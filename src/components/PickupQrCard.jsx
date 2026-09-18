import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, QrCode } from 'lucide-react'
import QRCode from 'qrcode'

const ERP_SCAN_URL = 'https://onemarket-erpnks.netlify.app/courier/scan'

export default function PickupQrCard({ code, orderNumber }) {
  const [src, setSrc] = useState('')
  const [failed, setFailed] = useState(false)

  const qrValue = useMemo(() => {
    if (!code?.payload || !code?.seller_order_id) return ''
    const params = new URLSearchParams({
      pickup: code.payload,
      so: code.seller_order_id,
    })
    return `${ERP_SCAN_URL}?${params.toString()}`
  }, [code?.payload, code?.seller_order_id])

  useEffect(() => {
    let active = true
    setSrc('')
    setFailed(false)
    if (!qrValue) return undefined

    QRCode.toDataURL(qrValue, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
    }).then(url => {
      if (active) setSrc(url)
    }).catch(() => {
      if (active) setFailed(true)
    })

    return () => { active = false }
  }, [qrValue])

  if (!code) {
    return <div className="seller-pickup-qr loading">
      <QrCode size={26}/>
      <span><strong>QR de ramassage</strong><small>Génération du code sécurisé…</small></span>
    </div>
  }

  return <div className={`seller-pickup-qr ${code.verified ? 'verified' : ''}`}>
    <div className="seller-pickup-qr-visual">
      {src ? <img src={src} alt={`QR de ramassage ${orderNumber || ''}`}/> : <QrCode size={54}/>}
    </div>
    <div className="seller-pickup-qr-copy">
      <span className="seller-pickup-qr-label">{code.verified ? 'Colis vérifié' : 'Code de ramassage'}</span>
      <strong>{code.verified ? <><CheckCircle2 size={18}/> Scanné par le livreur</> : 'Montrez ce QR au livreur One Market'}</strong>
      <p>Le livreur peut le scanner avec la caméra de son téléphone ou depuis son espace One Market.</p>
      <div className="seller-pickup-short-code"><span>Code manuel</span><b>{code.short_code}</b></div>
      {failed && <small className="seller-pickup-qr-error">QR indisponible : utilisez le code manuel ci-dessus.</small>}
    </div>
  </div>
}
