/**
 * Screen-reader announcement for useToast(). The visible toast is a Mantine notification (see useToast);
 * this region is always mounted (visually hidden) so the text is announced as soon as it arrives.
 * `onClose` is accepted for older callers.
 */
// eslint-disable-next-line no-unused-vars
const LiveToast = ({ toast, onClose }) => (
    <div className="sr-only" aria-live="polite" role="status">
        {toast ? toast.text : ""}
    </div>
);

export default LiveToast;
