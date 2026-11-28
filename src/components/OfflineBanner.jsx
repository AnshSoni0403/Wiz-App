import { IconWifiOff } from "@tabler/icons-react";
import useOnlineStatus from "../hooks/useOnlineStatus";

/** Slim banner while offline (answers are never stored on the device). */
const OfflineBanner = () => {
    const online = useOnlineStatus();
    if (online) return null;
    return (
        <div className="offline-banner" role="status" aria-live="polite">
            <IconWifiOff size={14} stroke={2} aria-hidden="true" />
            <span>You're offline — Wizz needs a connection to answer.</span>
        </div>
    );
};

export default OfflineBanner;
