export default function Modal({ title, onClose, children, size = '' }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`}>
        {title && (
          <div className="modal-header">
            <div className="modal-title">{title}</div>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        )}
        {!title && <button className="modal-close" onClick={onClose} style={{ position: 'absolute', top: 12, right: 16, zIndex: 2 }}>✕</button>}
        {children}
      </div>
    </div>
  )
}
