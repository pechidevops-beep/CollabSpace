import React, { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { gsap } from 'gsap';

export default function PageTransition({ children }) {
    const el = useRef(null);
    const location = useLocation();

    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            gsap.fromTo(el.current,
                { opacity: 0, y: 10 },
                { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
            );
        }, el);
        return () => ctx.revert();
    }, [location.pathname]);

    return <div ref={el} className="w-full h-full">{children}</div>;
}
