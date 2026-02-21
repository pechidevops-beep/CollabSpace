import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';

export const useFadeIn = (delay = 0, duration = 0.6, y = 20) => {
    const elementRef = useRef(null);

    useLayoutEffect(() => {
        const el = elementRef.current;
        if (!el) return;

        gsap.fromTo(
            el,
            { opacity: 0, y },
            { opacity: 1, y: 0, duration, delay, ease: 'power3.out' }
        );
    }, [delay, duration, y]);

    return elementRef;
};

export const useStaggerInfo = (delay = 0.1, stagger = 0.1) => {
    const containerRef = useRef(null);

    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            gsap.fromTo(
                ".stagger-item",
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.5, stagger, delay, ease: "power2.out" }
            );
        }, containerRef);

        return () => ctx.revert();
    }, [delay, stagger]);

    return containerRef;
};

export const useHoverScale = (scale = 1.03) => {
    const elementRef = useRef(null);

    useLayoutEffect(() => {
        const el = elementRef.current;
        if (!el) return;

        const onMouseEnter = () => gsap.to(el, { scale, duration: 0.3, ease: 'power2.out' });
        const onMouseLeave = () => gsap.to(el, { scale: 1, duration: 0.3, ease: 'power2.out' });

        el.addEventListener('mouseenter', onMouseEnter);
        el.addEventListener('mouseleave', onMouseLeave);

        return () => {
            el.removeEventListener('mouseenter', onMouseEnter);
            el.removeEventListener('mouseleave', onMouseLeave);
        };
    }, [scale]);

    return elementRef;
}
