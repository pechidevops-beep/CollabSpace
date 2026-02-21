import React, { useRef, useLayoutEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { gsap } from 'gsap';

export default function DashboardHero() {
    const { user, profile } = useAuth();
    const titleRef = useRef(null);

    const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            gsap.from('.hero-text', {
                y: 20,
                opacity: 0,
                duration: 0.8,
                stagger: 0.1,
                ease: 'power3.out',
            });

            gsap.from('.hero-line', {
                scaleX: 0,
                transformOrigin: 'left center',
                duration: 0.8,
                ease: 'power3.out',
                delay: 0.2,
            });
        }, titleRef);

        return () => ctx.revert();
    }, []);

    return (
        <div ref={titleRef} className="mb-10 pt-2">
            <h1 className="text-4xl font-bold text-white tracking-tight hero-text">
                Good evening, <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-purple-400">{displayName}</span>
            </h1>
            <p className="mt-2 text-slate-400 text-lg hero-text">
                Here's what's happening in your workspaces today.
            </p>
            <div className="h-1 w-24 bg-gradient-to-r from-brand-500 to-transparent rounded-full mt-6 hero-line opacity-50" />
        </div>
    );
}
