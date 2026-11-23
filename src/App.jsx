import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import config from "./config";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { availableAgents, DEFAULT_AGENT_PATH } from "./agents/registry";
import AppShell from "./components/AppShell";
import SplashScreen from "./components/SplashScreen";
import LoginPage from "./pages/LoginPage";
import NoAccessPage from "./pages/NoAccessPage";
import ConnectionErrorPage from "./pages/ConnectionErrorPage";
import ProfilePage from "./pages/ProfilePage";
import NotFoundPage from "./pages/NotFoundPage";

/** Gate for every signed-in screen. */
const RequireWizz = ({ children }) => {
    const { status } = useAuth();
    const location = useLocation();
    if (status === "loading") return <SplashScreen />;
    if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    if (status === "no-access") return <NoAccessPage />;
    if (status === "error") return <ConnectionErrorPage />;
    return children;
};

const LoginRoute = () => {
    const { status } = useAuth();
    const location = useLocation();
    if (status === "loading") return <SplashScreen />;
    if (status !== "anonymous") {
        const from = location.state?.from;
        return <Navigate to={from && from !== "/login" ? from : "/"} replace />;
    }
    return <LoginPage />;
};

const AppRoutes = () => {
    const { wizz } = useAuth();
    const agents = availableAgents(wizz);
    return (
        <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route
                element={
                    <RequireWizz>
                        <AppShell agents={agents} />
                    </RequireWizz>
                }
            >
                <Route index element={<Navigate to={DEFAULT_AGENT_PATH} replace />} />
                {agents.map(({ key, routePath, Component }) => (
                    <Route key={key} path={routePath} element={<Component />} />
                ))}
                <Route path="profile" element={<ProfilePage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Route>
        </Routes>
    );
};

const App = () => (
    <BrowserRouter basename={config.routerBasename}>
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    </BrowserRouter>
);

export default App;
