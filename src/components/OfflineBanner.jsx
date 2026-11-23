import Icon from "./Icon";
import useOnlineStatus from "../hooks/useOnlineStatus";

const OfflineBanner = () => {
    const online = useOnlineStatus();
    if (online) return null;
    return (
        <div className="offline-banner" role="status" aria-live="polite">
            <Icon name="wifiOff" size={16} />
            <span>You're offline. Wizz needs a connection to answer - answers are never stored on this device.</span>
        </div>
    );
};

export default OfflineBanner;
