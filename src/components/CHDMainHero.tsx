"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { preloadImages } from "../utils/imagePreloader";

if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
}

export default function CHDMainHero() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [images, setImages] = useState<HTMLImageElement[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [progress, setProgress] = useState(0);

    const frameCount = 200;

    useEffect(() => {
        // Preload images
        const imgs = preloadImages(frameCount, "/hero_sequence", "jpg", 3);
        setImages(imgs);

        let loadedCount = 0;
        imgs.forEach((img, idx) => {
            const handleLoad = () => {
                loadedCount++;
                setProgress(Math.round((loadedCount / frameCount) * 100));
                if (idx === 0 || loadedCount > 2) {
                    setLoaded(true);
                }
            };
            if (img.complete) {
                handleLoad();
            } else {
                img.onload = handleLoad;
                img.onerror = handleLoad;
            }
        });

        // Failsafe timer to prevent infinite loading screen
        const timer = setTimeout(() => setLoaded(true), 2000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!loaded || images.length === 0 || !canvasRef.current || !containerRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Render the first frame initially
        const render = (index: number) => {
            if (images[index]) {
                const drawIt = () => {
                    // Clear and draw matching dimensions
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;

                    // Calculate aspect ratio cover
                    const imgRatio = images[index].width / images[index].height;
                    const canvasRatio = canvas.width / canvas.height;
                    let renderWidth = canvas.width;
                    let renderHeight = canvas.height;
                    let offsetX = 0;
                    let offsetY = 0;

                    if (canvasRatio > imgRatio) {
                        renderHeight = canvas.width / imgRatio;
                        offsetY = (canvas.height - renderHeight) / 2;
                    } else {
                        renderWidth = canvas.height * imgRatio;
                        offsetX = (canvas.width - renderWidth) / 2;
                    }

                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(images[index], offsetX, offsetY, renderWidth, renderHeight);
                };

                if (images[index].complete && images[index].naturalWidth > 0) {
                    drawIt();
                } else {
                    images[index].onload = drawIt;
                }
            }
        };

        render(0);

        // Setup GSAP ScrollTrigger
        const scrollTrigger = ScrollTrigger.create({
            trigger: containerRef.current,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.5, // 0.5 for smooth interpolation
            onUpdate: (self) => {
                // Map progress 0-1 to frame 0-199
                const frameIndex = Math.floor(self.progress * (frameCount - 1));
                render(frameIndex);
            },
        });

        // Handle resize
        const handleResize = () => {
            let currentFrame = Math.floor(scrollTrigger.progress * (frameCount - 1));
            if (isNaN(currentFrame)) currentFrame = 0;
            render(currentFrame);
        };

        window.addEventListener("resize", handleResize);

        return () => {
            scrollTrigger.kill();
            window.removeEventListener("resize", handleResize);
        };
    }, [loaded, images]);

    return (
        <div ref={containerRef} className="absolute inset-0 w-full h-full z-0 pointer-events-none">
            {/* Sticky container for the canvas */}
            <div className="sticky top-0 left-0 w-full h-screen overflow-hidden bg-black">
                {/* Loading Overlay */}
                {!loaded && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black">
                        <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.8)] transition-all duration-200"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="font-mono text-cyan-500 text-xs mt-4 tracking-[0.2em] uppercase blur-[0.5px]">
                            Initializing Sequence Buffer... {progress}%
                        </p>
                    </div>
                )}

                {/* Dynamic Canvas */}
                <canvas ref={canvasRef} className="w-full h-full object-cover" />

                {/* Subtle vignette/overlay over the video to make text readable */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />
            </div>
        </div>
    );
}
