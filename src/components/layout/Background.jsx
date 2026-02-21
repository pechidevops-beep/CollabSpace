import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export default function Background() {
    const blobRef1 = useRef(null);
    const blobRef2 = useRef(null);
    const blobRef3 = useRef(null);

    useEffect(() => {
        // Floating animation for blobs
        const blobs = [blobRef1.current, blobRef2.current, blobRef3.current];

        blobs.forEach((blob, i) => {
            gsap.to(blob, {
                x: `random(-100, 100)`,
                y: `random(-50, 50)`,
                duration: 20 + i * 5,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
            });

            gsap.to(blob, {
                opacity: `random(0.3, 0.6)`,
                duration: 4 + i * 2,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
            });
        });
    }, []);

    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden bg-slate-950 pointer-events-none">
            {/* Base Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]" />

            {/* Radial Overlays */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_0%_0%,rgba(79,70,229,0.08),transparent_50%)]" />
            <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_100%_100%,rgba(67,56,202,0.08),transparent_50%)]" />

            {/* Animated Blobs */}
            <div
                ref={blobRef1}
                className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl mix-blend-screen filter"
            />
            <div
                ref={blobRef2}
                className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl mix-blend-screen filter"
            />
            <div
                ref={blobRef3}
                className="absolute top-1/2 left-1/2 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl mix-blend-screen filter"
            />

            {/* Noise Texture */}
            <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                }}
            />

            {/* Grid Texture (Optional, very subtle) */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        </div>
    );
}
