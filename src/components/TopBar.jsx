import markUrl from "../assets/images/marwiz-mark.png";
import NotificationBell from "./NotificationBell";

/** Page header: optional leading action, brand + title, trailing content, then the notification bell. */
const TopBar = ({ leading = null, title = "Wizz", subtitle = null, children = null, bell = true }) => (
    <header className="topbar">
        <div className="topbar__leading">{leading}</div>
        <div className="topbar__brand">
            <img src={markUrl} alt="Marwiz" className="topbar__mark" width="28" height="28" />
            <div className="topbar__titles">
                <span className="topbar__title">{title}</span>
                {subtitle ? <span className="topbar__subtitle">{subtitle}</span> : null}
            </div>
        </div>
        <div className="topbar__trailing">
            {children}
            {bell ? <NotificationBell /> : null}
        </div>
    </header>
);

export default TopBar;
