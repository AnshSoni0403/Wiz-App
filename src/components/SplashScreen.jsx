import markUrl from "../assets/images/marwiz-mark.png";

const SplashScreen = ({ label = "Loading Wizz…" }) => (
    <div className="splash" role="status" aria-live="polite">
        <img src={markUrl} alt="" className="splash__mark" width="72" height="72" />
        <div className="spinner" aria-hidden="true" />
        <span className="sr-only">{label}</span>
    </div>
);

export default SplashScreen;
