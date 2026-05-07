export default function Modal({ title, onClose, children, size = '' }) {
  return (
    <div
      className="modal-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
    >
      <div className={`modal ${size}`}>
        {title && (
          <div className="modal-header">
            <div className="modal-title">{title}</div>
            <button className="modal-close" onClick={onClose} aria-label="Close dialog">
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        )}
        {!title && (
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ position: 'absolute', top: 12, right: 16, zIndex: 2 }}
          >
            <span aria-hidden="true">✕</span>
          </button>
        )}
        {children}
      </div>
    </div>
  )
}
