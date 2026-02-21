import React, { Suspense, lazy, useEffect, useState } from 'react';
const Spline = lazy(() => import('@splinetool/react-spline'));

export function SplineScene({ scene, className }) {
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkScene() {
      try {
        const res = await fetch(scene, { method: 'HEAD' });
        if (!cancelled && res.ok) {
          setCanRender(true);
        } else if (!cancelled) {
          console.warn('Spline scene not reachable, disabling 3D preview');
          setCanRender(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Spline scene fetch failed, disabling 3D preview', err);
          setCanRender(false);
        }
      }
    }

    checkScene();

    return () => {
      cancelled = true;
    };
  }, [scene]);

  if (!canRender) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
        3D preview unavailable right now.
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="w-full h-full flex items-center justify-center">
          <span className="loader"></span>
        </div>
      }
    >
      <Spline scene={scene} className={className} />
    </Suspense>
  );
}

