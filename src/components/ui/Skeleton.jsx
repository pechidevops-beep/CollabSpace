import React from 'react';

export default function Skeleton({ className, ...props }) {
    return (
        <div
            className={`animate-pulse rounded-md bg-slate-800/50 ${className}`}
            {...props}
        />
    );
}

