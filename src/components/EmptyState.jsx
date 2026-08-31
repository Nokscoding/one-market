export default function EmptyState({ title, text, action }) {
  return (
    <div className="empty-state">
      <div className="empty-dot" />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}
