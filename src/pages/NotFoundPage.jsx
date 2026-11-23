import { Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import { DEFAULT_AGENT_PATH } from "../agents/registry";

const NotFoundPage = () => (
    <div className="page">
        <TopBar title="Wizz" />
        <div className="page__body page__body--center">
            <h2>Page not found</h2>
            <p className="muted">This screen doesn't exist in Wizz.</p>
            <Link to={DEFAULT_AGENT_PATH} className="btn btn--primary">
                Back to Wizz
            </Link>
        </div>
    </div>
);

export default NotFoundPage;
