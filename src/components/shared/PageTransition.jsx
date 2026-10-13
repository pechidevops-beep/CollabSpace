import React from 'react';

export default function PageTransition({ children }) {
    return <div className="w-full h-full animate-fade-up">{children}</div>;
}
