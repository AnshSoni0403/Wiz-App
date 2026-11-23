import { useState } from "react";
import logoUrl from "../assets/images/marwiz-logo-gold.png";
import { useAuth } from "../context/AuthContext";
import { friendlyMessage, toApiError } from "../utils/errors";
import useOnlineStatus from "../hooks/useOnlineStatus";
import OfflineBanner from "../components/OfflineBanner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sign in with the existing Marwiz Vision company login (same endpoint as the Admin). */
const LoginPage = () => {
    const { login } = useAuth();
    const online = useOnlineStatus();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const onSubmit = async (event) => {
        event.preventDefault();
        if (busy) return;
        if (!EMAIL_RE.test(email.trim())) {
            setError("Enter a valid email address.");
            return;
        }
        if (!password) {
            setError("Enter your password.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            await login({ email, password });
        } catch (err) {
            const e = toApiError(err);
            setError(e.kind === "http" && e.serverMessage ? e.serverMessage : friendlyMessage(e));
            setBusy(false);
        }
    };

    return (
        <div className="auth-page">
            <OfflineBanner />
            <div className="auth-card">
                <img src={logoUrl} alt="Marwiz Vision" className="auth-card__logo" />
                <h1 className="auth-card__title">Wizz</h1>
                <p className="auth-card__subtitle">Marwiz Vision's AI assistant. Sign in with your Marwiz Vision account.</p>

                <form className="form" onSubmit={onSubmit} noValidate>
                    <label className="field">
                        <span className="field__label">Email</span>
                        <input
                            className="input"
                            type="email"
                            inputMode="email"
                            autoComplete="username"
                            autoCapitalize="none"
                            spellCheck="false"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={busy}
                            required
                        />
                    </label>
                    <label className="field">
                        <span className="field__label">Password</span>
                        <div className="input-group">
                            <input
                                className="input"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={busy}
                                required
                            />
                            <button
                                type="button"
                                className="input-group__btn"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-pressed={showPassword}
                            >
                                {showPassword ? "Hide" : "Show"}
                            </button>
                        </div>
                    </label>

                    {error ? (
                        <div className="alert alert--danger" role="alert">
                            {error}
                        </div>
                    ) : null}

                    <button type="submit" className="btn btn--primary btn--block" disabled={busy || !online}>
                        {busy ? "Signing in…" : "Sign in"}
                    </button>
                </form>
                <p className="auth-card__hint">Forgot your password? Reset it from the Marwiz Vision Admin sign-in page.</p>
            </div>
        </div>
    );
};

export default LoginPage;
