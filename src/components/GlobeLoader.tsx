import { useEffect, useState } from 'react';

interface GlobeLoaderProps {
  stage: string;
  progress: number;
}

// Multiple Earth texture sources for reliability (NASA Blue Marble, public domain)
const EARTH_TEXTURES = [
  'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg',
  'https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-blue-marble.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1280px-Blue_Marble_2002.png',
];

export const GlobeLoader: React.FC<GlobeLoaderProps> = ({ stage, progress }) => {
  const [textureUrl, setTextureUrl] = useState<string | null>(null);
  const [textureLoaded, setTextureLoaded] = useState(false);
  const [planeAngle1, setPlaneAngle1] = useState(0);
  const [planeAngle2, setPlaneAngle2] = useState(180);
  // Try loading Earth textures with fallback chain
  useEffect(() => {
    const tryLoad = (index: number) => {
      if (index >= EARTH_TEXTURES.length) {
        // All failed - use SVG fallback
        setTextureLoaded(true);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setTextureUrl(EARTH_TEXTURES[index]);
        setTextureLoaded(true);
      };
      img.onerror = () => tryLoad(index + 1);
      img.src = EARTH_TEXTURES[index];
    };
    tryLoad(0);
  }, []);

  // Animate planes
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaneAngle1(prev => (prev + 2) % 360);
      setPlaneAngle2(prev => (prev + 1.5) % 360);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  // Plane orbit calculations
  const orbitRadius = 105;
  const plane1X = Math.cos((planeAngle1 * Math.PI) / 180) * orbitRadius;
  const plane1Y = Math.sin((planeAngle1 * Math.PI) / 180) * orbitRadius * 0.35;
  const plane1Behind = Math.sin((planeAngle1 * Math.PI) / 180) < 0;
  const plane1Rotation = planeAngle1 + 90;

  const orbitRadius2 = 95;
  const tiltAngle = 60;
  const tiltRad = (tiltAngle * Math.PI) / 180;
  const plane2X = Math.cos((planeAngle2 * Math.PI) / 180) * orbitRadius2;
  const rawY = Math.sin((planeAngle2 * Math.PI) / 180) * orbitRadius2;
  const plane2Y = rawY * Math.cos(tiltRad);
  const plane2Behind = Math.sin((planeAngle2 * Math.PI) / 180) < 0;
  const plane2Rotation = Math.atan2(
    Math.cos(tiltRad) * Math.cos((planeAngle2 * Math.PI) / 180),
    -Math.sin((planeAngle2 * Math.PI) / 180)
  ) * (180 / Math.PI) + 90;

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-8">
      {/* Globe container */}
      <div className="relative w-48 h-48">
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-600/20 blur-xl scale-125" />

        {/* Globe sphere */}
        <div
          className="absolute inset-0 rounded-full overflow-hidden shadow-2xl"
          style={{
            boxShadow: '0 0 60px rgba(59, 130, 246, 0.3), 0 0 120px rgba(59, 130, 246, 0.1)',
          }}
        >
          {/* Real Earth texture (if loaded) - scrolling for rotation */}
          {textureUrl && (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${textureUrl})`,
                backgroundSize: '384px 192px',
                backgroundRepeat: 'repeat-x',
                backgroundPosition: '0px center',
                animation: 'earthRotate 20s linear infinite',
                borderRadius: '50%',
              }}
            />
          )}

          {/* SVG fallback globe (if no texture loaded) */}
          {!textureUrl && textureLoaded && (
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(circle at 35% 35%, #1a8cff, #0a3d7a 40%, #062654 70%, #041a3a)',
            }}>
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 200 200"
                style={{ animation: 'globeSpin 12s linear infinite' }}
              >
                {/* Realistic continent outlines */}
                {/* North America */}
                <path d="M30,45 Q35,38 45,35 Q55,33 60,38 Q65,42 68,48 Q70,55 65,60 Q60,62 58,68 Q55,75 50,78 Q45,80 40,77 Q35,73 33,68 Q30,60 28,52 Z" fill="#2ab87e" opacity="0.7"/>
                {/* Greenland */}
                <path d="M70,28 Q75,25 82,27 Q85,30 84,35 Q82,38 78,38 Q74,36 72,32 Z" fill="#2ab87e" opacity="0.55"/>
                {/* South America */}
                <path d="M55,90 Q60,85 65,87 Q70,92 72,100 Q73,110 70,120 Q67,128 62,132 Q58,130 56,125 Q53,118 52,108 Q51,98 53,93 Z" fill="#2ab87e" opacity="0.65"/>
                {/* Europe */}
                <path d="M100,35 Q105,32 110,34 Q115,37 118,42 Q116,45 112,46 Q108,48 104,45 Q100,42 99,38 Z" fill="#2ab87e" opacity="0.6"/>
                {/* UK/Ireland */}
                <path d="M94,38 Q96,36 98,38 Q99,41 97,42 Q95,41 94,39 Z" fill="#2ab87e" opacity="0.5"/>
                {/* Africa */}
                <path d="M108,55 Q115,50 122,52 Q128,56 130,65 Q132,75 130,88 Q127,100 122,108 Q118,112 114,110 Q110,105 108,95 Q106,82 105,70 Q106,60 108,55 Z" fill="#2ab87e" opacity="0.65"/>
                {/* Madagascar */}
                <path d="M135,98 Q137,95 138,98 Q139,104 137,108 Q135,106 134,102 Z" fill="#2ab87e" opacity="0.45"/>
                {/* Asia - main mass */}
                <path d="M120,28 Q130,24 142,26 Q155,28 165,33 Q172,38 175,45 Q176,55 172,60 Q165,65 158,62 Q150,58 145,55 Q138,52 132,50 Q125,48 120,42 Q118,35 120,28 Z" fill="#2ab87e" opacity="0.6"/>
                {/* India */}
                <path d="M148,60 Q152,58 155,62 Q157,68 155,76 Q152,80 149,78 Q146,74 146,68 Q147,63 148,60 Z" fill="#2ab87e" opacity="0.55"/>
                {/* Southeast Asia */}
                <path d="M165,58 Q168,56 172,58 Q174,62 173,66 Q170,68 167,65 Q165,62 165,58 Z" fill="#2ab87e" opacity="0.5"/>
                {/* Japan */}
                <path d="M178,38 Q180,35 181,38 Q182,44 180,48 Q178,46 177,42 Z" fill="#2ab87e" opacity="0.45"/>
                {/* Australia */}
                <path d="M162,100 Q170,95 178,98 Q184,103 185,110 Q183,118 178,122 Q172,124 166,120 Q162,115 160,108 Q161,103 162,100 Z" fill="#2ab87e" opacity="0.6"/>
                {/* New Zealand */}
                <path d="M190,120 Q192,118 193,122 Q192,126 190,125 Z" fill="#2ab87e" opacity="0.4"/>
                {/* Antarctica hint */}
                <path d="M30,170 Q60,165 100,168 Q140,165 170,170 Q160,178 100,180 Q40,178 30,170 Z" fill="#c8e8f0" opacity="0.4"/>
                {/* Duplicate set for seamless wrapping */}
                <path d="M230,45 Q235,38 245,35 Q255,33 260,38 Q265,42 268,48 Q270,55 265,60 Q260,62 258,68 Q255,75 250,78 Q245,80 240,77 Q235,73 233,68 Q230,60 228,52 Z" fill="#2ab87e" opacity="0.7"/>
                <path d="M255,90 Q260,85 265,87 Q270,92 272,100 Q273,110 270,120 Q267,128 262,132 Q258,130 256,125 Q253,118 252,108 Q251,98 253,93 Z" fill="#2ab87e" opacity="0.65"/>
              </svg>
            </div>
          )}

          {/* Placeholder while loading */}
          {!textureLoaded && (
            <div
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ background: 'radial-gradient(circle at 35% 35%, #1a8cff, #0a3d7a 40%, #062654 70%, #041a3a)' }}
            />
          )}

          {/* 3D sphere shading overlay */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `
                radial-gradient(circle at 35% 35%, transparent 0%, transparent 30%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.45) 70%, rgba(0,0,0,0.75) 90%),
                radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12) 0%, transparent 40%)
              `,
            }}
          />

          {/* Atmosphere rim light */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: 'inset -3px -3px 15px rgba(0,0,0,0.5), inset 3px 3px 10px rgba(135,206,250,0.15)',
            }}
          />
        </div>

        {/* Thin atmosphere glow ring */}
        <div
          className="absolute rounded-full"
          style={{
            inset: '-3px',
            border: '1px solid rgba(135, 206, 250, 0.25)',
            borderRadius: '50%',
            boxShadow: '0 0 8px rgba(135, 206, 250, 0.15)',
          }}
        />

        {/* Plane 1 */}
        <div
          className="absolute"
          style={{
            left: `calc(50% + ${plane1X}px - 10px)`,
            top: `calc(50% + ${plane1Y}px - 10px)`,
            transform: `rotate(${plane1Rotation}deg) scale(${plane1Behind ? 0.6 : 1})`,
            opacity: plane1Behind ? 0.3 : 1,
            zIndex: plane1Behind ? 0 : 20,
            transition: 'opacity 0.3s, transform 0.1s',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="drop-shadow-lg">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
          </svg>
        </div>

        {/* Plane 2 */}
        <div
          className="absolute"
          style={{
            left: `calc(50% + ${plane2X}px - 8px)`,
            top: `calc(50% + ${plane2Y}px - 8px)`,
            transform: `rotate(${plane2Rotation}deg) scale(${plane2Behind ? 0.5 : 0.85})`,
            opacity: plane2Behind ? 0.2 : 0.9,
            zIndex: plane2Behind ? 0 : 20,
            transition: 'opacity 0.3s, transform 0.1s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#facc15" className="drop-shadow-lg">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
          </svg>
        </div>

        {/* Contrail particles for plane 1 */}
        {[...Array(6)].map((_, i) => {
          const trailAngle = planeAngle1 - (i + 1) * 12;
          const tx = Math.cos((trailAngle * Math.PI) / 180) * orbitRadius;
          const ty = Math.sin((trailAngle * Math.PI) / 180) * orbitRadius * 0.35;
          const behind = Math.sin((trailAngle * Math.PI) / 180) < 0;
          return (
            <div
              key={`trail1-${i}`}
              className="absolute rounded-full bg-white/40"
              style={{
                width: `${3 - i * 0.4}px`,
                height: `${3 - i * 0.4}px`,
                left: `calc(50% + ${tx}px)`,
                top: `calc(50% + ${ty}px)`,
                opacity: behind ? 0.05 : (0.4 - i * 0.06),
                zIndex: behind ? 0 : 15,
              }}
            />
          );
        })}
      </div>

      {/* Loading text and progress */}
      <div className="text-center space-y-3">
        <p className="text-lg font-medium text-slate-300">{stage}</p>
        <div className="w-64 mx-auto">
          <div className="w-full rounded-full h-1.5 overflow-hidden bg-slate-700/50">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-[#c4956a] to-[#007bc7]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1 font-mono">{progress}%</p>
        </div>
      </div>
    </div>
  );
};
