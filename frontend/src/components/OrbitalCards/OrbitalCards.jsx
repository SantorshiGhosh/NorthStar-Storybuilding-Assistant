import React, { useEffect, useRef } from "react";
import { initOrbitalCards } from "./initOrbitalCards.js";
import "./OrbitalCards.css";

// Phosphor regular icons (MIT, Copyright (c) 2023 Phosphor Icons), 256×256 path data.
const ICONS = {
  "text-italic": "M200,56a8,8,0,0,1-8,8H157.77L115.1,192H144a8,8,0,0,1,0,16H64a8,8,0,0,1,0-16H98.23L140.9,64H112a8,8,0,0,1,0-16h80A8,8,0,0,1,200,56Z",
  "sparkle": "M197.58,129.06,146,110l-19-51.62a15.92,15.92,0,0,0-29.88,0L78,110l-51.62,19a15.92,15.92,0,0,0,0,29.88L78,178l19,51.62a15.92,15.92,0,0,0,29.88,0L146,178l51.62-19a15.92,15.92,0,0,0,0-29.88ZM137,164.22a8,8,0,0,0-4.74,4.74L112,223.85,91.78,169A8,8,0,0,0,87,164.22L32.15,144,87,123.78A8,8,0,0,0,91.78,119L112,64.15,132.22,119a8,8,0,0,0,4.74,4.74L191.85,144ZM144,40a8,8,0,0,1,8-8h16V16a8,8,0,0,1,16,0V32h16a8,8,0,0,1,0,16H184V64a8,8,0,0,1-16,0V48H152A8,8,0,0,1,144,40ZM248,88a8,8,0,0,1-8,8h-8v8a8,8,0,0,1-16,0V96h-8a8,8,0,0,1,0-16h8V72a8,8,0,0,1,16,0v8h8A8,8,0,0,1,248,88Z",
  "magic-wand": "M48,64a8,8,0,0,1,8-8H72V40a8,8,0,0,1,16,0V56h16a8,8,0,0,1,0,16H88V88a8,8,0,0,1-16,0V72H56A8,8,0,0,1,48,64ZM184,192h-8v-8a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0v-8h8a8,8,0,0,0,0-16Zm56-48H224V128a8,8,0,0,0-16,0v16H192a8,8,0,0,0,0,16h16v16a8,8,0,0,0,16,0V160h16a8,8,0,0,0,0-16ZM219.31,80,80,219.31a16,16,0,0,1-22.62,0L36.68,198.63a16,16,0,0,1,0-22.63L176,36.69a16,16,0,0,1,22.63,0l20.68,20.68A16,16,0,0,1,219.31,80Zm-54.63,32L144,91.31l-96,96L68.68,208ZM208,68.69,187.31,48l-32,32L176,100.69Z",
  "robot": "M200,48H136V16a8,8,0,0,0-16,0V48H56A32,32,0,0,0,24,80V192a32,32,0,0,0,32,32H200a32,32,0,0,0,32-32V80A32,32,0,0,0,200,48Zm16,144a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V80A16,16,0,0,1,56,64H200a16,16,0,0,1,16,16Zm-52-56H92a28,28,0,0,0,0,56h72a28,28,0,0,0,0-56Zm-24,16v24H116V152ZM80,164a12,12,0,0,1,12-12h8v24H92A12,12,0,0,1,80,164Zm84,12h-8V152h8a12,12,0,0,1,0,24ZM72,108a12,12,0,1,1,12,12A12,12,0,0,1,72,108Zm88,0a12,12,0,1,1,12,12A12,12,0,0,1,160,108Z",
  "layout": "M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V96H40V56ZM40,112H96v88H40Zm176,88H112V112H216v88Z",
  "squares-four": "M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48Z",
  "ruler": "M235.32,73.37,182.63,20.69a16,16,0,0,0-22.63,0L20.68,160a16,16,0,0,0,0,22.63l52.69,52.68a16,16,0,0,0,22.63,0L235.32,96A16,16,0,0,0,235.32,73.37ZM84.68,224,32,171.31l32-32,26.34,26.35a8,8,0,0,0,11.32-11.32L75.31,128,96,107.31l26.34,26.35a8,8,0,0,0,11.32-11.32L107.31,96,128,75.31l26.34,26.35a8,8,0,0,0,11.32-11.32L139.31,64l32-32L224,84.69Z",
  "palette": "M200.77,53.89A103.27,103.27,0,0,0,128,24h-1.07A104,104,0,0,0,24,128c0,43,26.58,79.06,69.36,94.17A32,32,0,0,0,136,192a16,16,0,0,1,16-16h46.21a31.81,31.81,0,0,0,31.2-24.88,104.43,104.43,0,0,0,2.59-24A103.28,103.28,0,0,0,200.77,53.89Zm13,93.71A15.89,15.89,0,0,1,198.21,160H152a32,32,0,0,0-32,32,16,16,0,0,1-21.31,15.07C62.49,194.3,40,164,40,128a88,88,0,0,1,87.09-88h.9a88.35,88.35,0,0,1,88,87.25A88.86,88.86,0,0,1,213.81,147.6ZM140,76a12,12,0,1,1-12-12A12,12,0,0,1,140,76ZM96,100A12,12,0,1,1,84,88,12,12,0,0,1,96,100Zm0,56a12,12,0,1,1-12-12A12,12,0,0,1,96,156Zm88-56a12,12,0,1,1-12-12A12,12,0,0,1,184,100Z",
  "cursor-click": "M88,24V16a8,8,0,0,1,16,0v8a8,8,0,0,1-16,0ZM16,104h8a8,8,0,0,0,0-16H16a8,8,0,0,0,0,16ZM124.42,39.16a8,8,0,0,0,10.74-3.58l8-16a8,8,0,0,0-14.31-7.16l-8,16A8,8,0,0,0,124.42,39.16Zm-96,81.69-16,8a8,8,0,0,0,7.16,14.31l16-8a8,8,0,1,0-7.16-14.31ZM219.31,184a16,16,0,0,1,0,22.63l-12.68,12.68a16,16,0,0,1-22.63,0L132.7,168,115,214.09c0,.1-.08.21-.13.32a15.83,15.83,0,0,1-14.6,9.59l-.79,0a15.83,15.83,0,0,1-14.41-11L32.8,52.92A16,16,0,0,1,52.92,32.8L213,85.07a16,16,0,0,1,1.41,29.8l-.32.13L168,132.69ZM208,195.31,156.69,144h0a16,16,0,0,1,4.93-26l.32-.14,45.95-17.64L48,48l52.2,159.86,17.65-46c0-.11.08-.22.13-.33a16,16,0,0,1,11.69-9.34,16.72,16.72,0,0,1,3-.28,16,16,0,0,1,11.3,4.69L195.31,208Z",
  "lightning": "M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,13l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17ZM109.37,214l10.47-52.38a8,8,0,0,0-5-9.06L62,132.71l84.62-90.66L136.16,94.43a8,8,0,0,0,5,9.06l52.8,19.8Z",
  "target": "M221.87,83.16A104.1,104.1,0,1,1,195.67,49l22.67-22.68a8,8,0,0,1,11.32,11.32l-96,96a8,8,0,0,1-11.32-11.32l27.72-27.72a40,40,0,1,0,17.87,31.09,8,8,0,1,1,16-.9,56,56,0,1,1-22.38-41.65L184.3,60.39a87.88,87.88,0,1,0,23.13,29.67,8,8,0,0,1,14.44-6.9Z",
  "chat-circle-dots": "M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128ZM84,116a12,12,0,1,0,12,12A12,12,0,0,0,84,116Zm88,0a12,12,0,1,0,12,12A12,12,0,0,0,172,116Zm60,12A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Zm-16,0A88,88,0,1,0,51.81,172.06a8,8,0,0,1,.66,6.54L40,216,77.4,203.53a7.85,7.85,0,0,1,2.53-.42,8,8,0,0,1,4,1.08A88,88,0,0,0,216,128Z",
};

const fontVars = (name, font) => ({
  [`--orbital-cards-${name}-font`]: `"${font.fontFamily}"`,
  [`--orbital-cards-${name}-font-weight`]: font.fontWeight,
  [`--orbital-cards-${name}-font-size`]: `${font.fontSize}px`,
  [`--orbital-cards-${name}-font-spacing`]: `${font.letterSpacing}px`,
});

export default function OrbitalCards({
  headlineFont = { fontFamily: "Geist", fontWeight: 500, fontSize: 40, letterSpacing: -0.8 },
  headline = "Writing complex story worlds is an art. Keeping canon consistent is the hardest part.",
  eyebrowFont = { fontFamily: "Geist", fontWeight: 500, fontSize: 12, letterSpacing: 0 },
  eyebrow = "AI Continuity Guardian",
  cardCount = 6,
  titleFont = { fontFamily: "Geist", fontWeight: 500, fontSize: 18, letterSpacing: -0.18 },
  textFont = { fontFamily: "Geist", fontWeight: 400, fontSize: 16, letterSpacing: 0 },
  icon1 = "target",
  title1 = "Zero Guesswork Citations",
  text1 = "Never search 50 chapters for a discrepancy. Every alert pairs the exact earlier canon quote against your new passage.",
  icon2 = "sparkle",
  title2 = "Author Sovereignty",
  text2 = "The AI never overwrites your prose or alters your voice. You hold total creative command over every sentence and resolution.",
  icon3 = "layout",
  title3 = "Interactive Knowledge Graph",
  text3 = "Visualize your narrative as an interconnected web of characters, factions, locations, and artifacts powered by React Flow.",
  icon4 = "magic-wand",
  title4 = "Lore & Physical Laws",
  text4 = "Track wounds, severed limbs, inventory items, and magical rules so characters don't wield swords with severed hands.",
  icon5 = "ruler",
  title5 = "Timeline Chronology Engine",
  text5 = "Catch travel-time impossibilities, dead-character appearances, and timeline paradoxes across multi-chapter sagas.",
  icon6 = "lightning",
  title6 = "AES-256-GCM Encrypted Vault",
  text6 = "Your unreleased manuscripts and private worldbuilding notes are encrypted at rest with authenticated security.",
  icon7 = "chat-circle-dots",
  title7 = "Verbatim Canon Memory",
  text7 = "Cites exact earlier passages across dozens of chapters with stable offsets so evidence is always verifiable.",
  icon8 = "robot",
  title8 = "Multi-Agent Orchestration",
  text8 = "Coordinated agents evaluate physical states, character voice drift, and lore laws concurrently in the background.",
  scrollLength = 300,
  radiusX = 34,
  radiusY = 17,
  cardsPassed = 5,
  entry = 1.55,
  exitBegins = 0.8,
  scatter = 2.4,
  farBlur = 10,
  farFade = 0.8,
  background = "",
  card = "",
  ink = "",
  className = "",
  style,
}) {
  const root = useRef(null);
  const count = Math.round(Math.min(8, Math.max(3, cardCount)));
  const icons = [icon1, icon2, icon3, icon4, icon5, icon6, icon7, icon8];
  const titles = [title1, title2, title3, title4, title5, title6, title7, title8];
  const texts = [text1, text2, text3, text4, text5, text6, text7, text8];

  useEffect(() => {
    if (!root.current) return;
    const options = { radiusX, radiusY, steps: cardsPassed, entry, exitStart: exitBegins, scatter, farBlur, farFade };
    return initOrbitalCards(root.current, options);
  }, [count, radiusX, radiusY, cardsPassed, entry, exitBegins, scatter, farBlur, farFade]);

  const vars = {
    "--orbital-cards-scroll": `${scrollLength}vh`,
    ...(background ? { "--orbital-cards-bg": background } : {}),
    ...(card ? { "--orbital-cards-card": card } : {}),
    ...(ink ? { "--orbital-cards-ink": ink } : {}),
    "--orbital-cards-headline-font-size-value": headlineFont.fontSize,
    ...fontVars("headline", headlineFont),
    ...fontVars("eyebrow", eyebrowFont),
    ...fontVars("title", titleFont),
    ...fontVars("text", textFont),
  };

  return (
    <div ref={root} className={`velox-orbital-cards ${className}`} style={{ ...vars, ...style }}>
      <div className="velox-orbital-cards__stage">
        <div className="velox-orbital-cards__center">
          <p className="velox-orbital-cards__eyebrow">{eyebrow}</p>
          <h2 className="velox-orbital-cards__headline">{headline}</h2>
        </div>
        {titles.slice(0, count).map((title, i) => (
          <article key={i} className="velox-orbital-cards__card">
            <span className="velox-orbital-cards__icon" aria-hidden="true">
              <svg viewBox="0 0 256 256" fill="currentColor">
                <path d={ICONS[icons[i]] ?? ICONS["text-italic"]} />
              </svg>
            </span>
            <div className="velox-orbital-cards__body">
              <h3 className="velox-orbital-cards__title">{title}</h3>
              <p className="velox-orbital-cards__text">{texts[i]}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
