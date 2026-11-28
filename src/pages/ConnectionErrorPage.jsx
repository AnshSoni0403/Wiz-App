import { Button } from "@mantine/core";
import Icon from "../components/Icon";
import OfflineBanner from "../components/OfflineBanner";
import { useAuth } from "../context/AuthContext";
import { friendlyMessage } from "../utils/errors";

/** Startup failed for a reason other than "not signed in" (offline, server down). */
const ConnectionErrorPage = () => {
    const { error, retry, logout, user } = useAuth();
    return (
        <div className="auth-page">
            <OfflineBanner />
            <div className="auth-card">
                <div className="auth-card__icon">
                    <Icon name="alert" size={40} />
                </div>
                <h1 className="auth-card__title">Can't reach Wizz</h1>
                <p className="auth-card__message">{friendlyMessage(error)}</p>
                <div className="stack">
                    <Button unstyled type="button" className="btn btn--primary btn--block" onClick={() => retry()}>
                        <Icon name="refresh" size={18} /> Try again
                    </Button>
                    {user ? (
                        <Button unstyled type="button" className="btn btn--ghost btn--block" onClick={logout}>
                            Log out
                        </Button>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default ConnectionErrorPage;
