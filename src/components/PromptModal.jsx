import ModalWrapper from './ModalWrapper'

const PromptModal = ({
  isOpen,
  onClose,
  title,
  message,
  value,
  onChange,
  onConfirm,
  confirmText = 'Confirm',
  loading = false
}) => (
  <ModalWrapper
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    size="sm"
    showCloseButton={!loading}
  >
    <p className="text-gray-700 mb-4">{message}</p>
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoFocus
      rows={4}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:ring-2 focus:ring-primary outline-none"
    />
    <div className="flex gap-3 mt-5">
      <button
        onClick={onConfirm}
        disabled={loading || !value.trim()}
        className="flex-1 rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition-opacity disabled:opacity-50"
      >
        {loading ? 'Processing...' : confirmText}
      </button>
      <button
        onClick={onClose}
        disabled={loading}
        className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 font-semibold hover:bg-gray-50 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  </ModalWrapper>
)

export default PromptModal
