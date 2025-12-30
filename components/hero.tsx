"use client";

import Link from "next/link";
import { GL } from "./gl";
import { Pill } from "./pill";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";

export function Hero() {
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize mouse position to 0-1 range
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      setMousePosition({ x, y });
      setHovering(true);
    };

    const handleMouseLeave = () => {
      setHovering(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div className="flex flex-col h-svh justify-between">
      <GL hovering={hovering} mousePosition={mousePosition} />

      <div className="pb-16 mt-auto text-center relative">
        <Pill className="mb-6">FULL STACK DEV</Pill>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-sentient">
          PIYUSH <br />
          <i className="font-light">SINGH</i>
        </h1>
        <p className="font-mono text-sm sm:text-base text-foreground/60 text-balance mt-8 max-w-[440px] mx-auto">
          Founder of Draftly • Scaled 0 to 33K users • 0 to 800K viewers on socials
        </p>

        <div className="flex gap-4 justify-center mt-8">
          <Link 
            href="https://www.linkedin.com/in/piyush-singh-023507359" 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-mono text-sm text-foreground/60 hover:text-foreground transition-colors"
          >
            LinkedIn
          </Link>
          <Link 
            href="https://www.instagram.com/piyush.glitch" 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-mono text-sm text-foreground/60 hover:text-foreground transition-colors"
          >
            Instagram
          </Link>
          <Link 
            href="https://x.com/Piyush_Sxt" 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-mono text-sm text-foreground/60 hover:text-foreground transition-colors"
          >
            Twitter
          </Link>
        </div>

        <Link className="contents max-sm:hidden" href="/#contact">
          <Button className="mt-14">
            [Get In Touch]
          </Button>
        </Link>
        <Link className="contents sm:hidden" href="/#contact">
          <Button size="sm" className="mt-14">
            [Get In Touch]
          </Button>
        </Link>
      </div>
    </div>
  );
}
