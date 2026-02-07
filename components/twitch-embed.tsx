'use client';

import { useEffect, useRef, useState } from 'react';

interface TwitchEmbedProps {
  channel: string;
  width?: string | number;
  height?: string | number;
  autoplay?: boolean;
  muted?: boolean;
}

declare global {
  interface Window {
    Twitch?: {
      Embed: new (elementId: string, options: any) => any;
    };
  }
}

export function TwitchEmbed({
  channel,
  width = '100%',
  height = 500,
  autoplay = true,
  muted = false,
}: TwitchEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [embedId] = useState(() => `twitch-embed-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    // Check if script is already loaded
    const existingScript = document.querySelector('script[src="https://embed.twitch.tv/embed/v1.js"]');

    const initEmbed = () => {
      if (containerRef.current && window.Twitch && !playerRef.current) {
        // Clear any existing content
        containerRef.current.innerHTML = '';

        // Create Twitch player
        playerRef.current = new window.Twitch.Embed(embedId, {
          width,
          height,
          channel,
          layout: 'video',
          autoplay,
          muted,
          parent: ['localhost'],
        });
      }
    };

    if (existingScript) {
      // Script already loaded, just init
      initEmbed();
    } else {
      // Load script first time
      const script = document.createElement('script');
      script.src = 'https://embed.twitch.tv/embed/v1.js';
      script.async = true;
      script.onload = initEmbed;
      document.body.appendChild(script);
    }

    return () => {
      // Cleanup player on unmount
      if (playerRef.current) {
        playerRef.current = null;
      }
      // Clear container
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [channel, width, height, autoplay, muted, embedId]);

  return (
    <div className="w-full">
      <div
        id={embedId}
        ref={containerRef}
        className="rounded-lg overflow-hidden bg-gray-900"
      />
    </div>
  );
}
