import { ActionIcon, Avatar, Button, Paper } from "@mantine/core";
import TopBar from "../components/TopBar";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { useInstallPrompt } from "../pwa/installPrompt";
import { AUDIENCE_LABELS, ROLE_LABELS, branchName, initials } from "../utils/format";
import PushNotificationsCard from "../components/profile/PushNotificationsCard";
import { canUseTasks } from "../agents/access";

const ProfilePage = () => {
    const { user, wizz, logout } = useAuth();
    const { canInstall, promptInstall, standalone, ios } = useInstallPrompt();
    const member = wizz?.member || {};
    const branches = wizz?.branches || [];
    const name = member.name || user?.employeeName || "Wizz member";
    const email = member.email || user?.emailOffice || "";
    const memberBranches = member.branches?.length ? member.branches : branches.map((b) => b.code);

    return (
        <div className="page">
            <TopBar title="Profile">
                <ActionIcon unstyled className="icon-btn" onClick={logout} aria-label="Log out" title="Log out">
                    <Icon name="logout" size={18} />
                </ActionIcon>
            </TopBar>
            <div className="page__body profile-settings">
                <Paper component="section" className="card profile-card">
                    <Avatar className="avatar" color="gold" aria-hidden="true">
                        {initials(name)}
                    </Avatar>
                    <div className="profile-card__text">
                        <h2 className="profile-card__name">{name}</h2>
                        {email ? <div className="muted">{email}</div> : null}
                        <div className="profile-card__role">
                            <span className="badge">{ROLE_LABELS[member.role] || member.role || "Member"}</span>
                            {wizz?.isOwner ? <span className="badge badge--soft">Full access</span> : null}
                        </div>
                    </div>
                </Paper>

                <Paper component="section" className="card">
                    <h3 className="card__title">Branches</h3>
                    <div className="chip-row">
                        {memberBranches.map((code) => (
                            <span key={code} className="chip">
                                {branchName(code, branches)}
                                {code === member.homeBranch ? <em className="chip__note">Home</em> : null}
                            </span>
                        ))}
                    </div>
                    {member.maxAudience ? (
                        <p className="muted small">Wizz answers from {AUDIENCE_LABELS[member.maxAudience] || member.maxAudience}.</p>
                    ) : null}
                </Paper>

                {canUseTasks(wizz) ? <PushNotificationsCard /> : null}

                {!standalone && (canInstall || ios) ? (
                    <Paper component="section" className="card">
                        <h3 className="card__title">Install the app</h3>
                        {canInstall ? (
                            <Button unstyled type="button" className="btn btn--secondary" onClick={() => promptInstall()}>
                                <Icon name="download" size={18} /> Install Wizz
                            </Button>
                        ) : (
                            <p className="muted small">
                                In Safari, tap <Icon name="share" size={14} className="inline-icon" /> Share, then{" "}
                                <b>Add to Home Screen</b>.
                            </p>
                        )}
                    </Paper>
                ) : null}

                <p className="muted small center">Wizz v{__APP_VERSION__} · Marwiz Vision</p>
            </div>
        </div>
    );
};

export default ProfilePage;
