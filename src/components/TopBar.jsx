import markUrl from "../assets/images/marwiz-mark.png";

/** Page header: optional leading action, brand + title, trailing content. */
const TopBar = ({ leading = null, title = "Wizz", subtitle = null, children = null }) => (
    <header className="topbar">
        <div className="topbar__leading">{leading}</div>
        <div className="topbar__brand">
            <img src={markUrl} alt="Marwiz" className="topbar__mark" width="28" height="28" />
            <div className="topbar__titles">
                <span className="topbar__title">{title}</span>
                {subtitle ? <span className="topbar__subtitle">{subtitle}</span> : null}
            </div>
        </div>
        <div className="topbar__trailing">{children}</div>
    </header>
);

export default TopBar;
