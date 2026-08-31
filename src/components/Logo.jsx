import { Link } from 'react-router-dom'
export default function Logo({ className = '' }) { return <Link to="/" className={`brand-logo ${className}`} aria-label="OneMarket — accueil"><img src="https://res.cloudinary.com/nks-services/image/upload/v1788106209/one-market-logo.webp" alt="OneMarket" /></Link> }
