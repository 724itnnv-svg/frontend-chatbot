export function EyeIcon({ className = "w-5 h-5" }) {
    return (
        <svg
            className={className}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeWidth="2"
                d="M1.5 12s4-7.5 10.5-7.5S22.5 12 22.5 12s-4 7.5-10.5 7.5S1.5 12 1.5 12z"
            />
            <circle cx="12" cy="12" r="3" strokeWidth="2" />
        </svg>
    );
}

export function EyeCloseIcon({ className = "w-5 h-5" }) {
    return (
        <svg
            className={className}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path strokeWidth="2" d="M3 3l18 18" />
            <path
                strokeWidth="2"
                d="M9.88 9.88A3 3 0 0114.12 14.12M7.5 7.5C4.5 9 2.5 12 2.5 12s4 7.5 9.5 7.5c1.4 0 2.7-.3 3.9-.9M16.5 16.5c3-1.5 5-4.5 5-4.5s-4-7.5-9.5-7.5c-1.1 0-2.2.2-3.2.5"
            />
        </svg>
    );
}
