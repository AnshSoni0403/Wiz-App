import { Button } from "@mantine/core";
import { useState } from "react";
import markUrl from "../assets/images/marwiz-mark.png";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { NO_ACCESS_MESSAGE } from "../utils/errors";

/** Signed in, but GET /wizz/me answered 403 WIZZ_NO_ACCESS. */
const NoAccessPage = () => {
    const { user, logout, retry } = useAuth();
    const [busy, setBusy] = useState(false);
    const name = user?.employeeName;

    return (
        <div className="auth-page">
            <div className="auth-card">
                <img src={markUrl} alt="Marwiz" className="auth-card__mark" width="64" height="64" />
                <h1 className="auth-card__title">{name ? `Hi ${name}` : "No Wizz access"}</h1>
                <p className="auth-card__message">{NO_ACCESS_MESSAGE}</p>
                <div className="stack">
                    <Button unstyled
                        type="button"
                        className="btn btn--secondary btn--block"
                        disabled={busy}
                        onClick={async () => {
                            setBusy(true);
                            await retry({ silent: true });
                            setBusy(false);
                        }}
                    >
                        <Icon name="refresh" size={18} /> {busy ? "Checking…" : "Check again"}
                    </Button>
                    <Button unstyled type="button" className="btn btn--primary btn--block" onClick={logout}>
                        <Icon name="logout" size={18} /> Log out
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default NoAccessPage;
