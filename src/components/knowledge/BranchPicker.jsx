import Icon from "../Icon";

export const ALL_BRANCHES = "*";

/** Branch filter for questions. Only branches from /wizz/me; "All my branches" sends no branch. */
const BranchPicker = ({ branches, value, onChange, disabled = false }) => {
    if (!branches?.length) return null;
    return (
        <label className="branch-picker">
            <span className="sr-only">Branch</span>
            <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
                <option value={ALL_BRANCHES}>All my branches</option>
                {branches.map((b) => (
                    <option key={b.code} value={b.code}>
                        {b.name || b.code}
                    </option>
                ))}
            </select>
            <Icon name="chevronDown" size={16} className="branch-picker__chevron" />
        </label>
    );
};

export default BranchPicker;
