import Anthropic from '@anthropic-ai/sdk';
import pptxgen from 'pptxgenjs';
import { saveAs } from 'file-saver';

// GTA-focused training content structure - optimized for conversion, not product expertise
export interface TrainingContent {
  destination: string;
  destinationHook: {
    tagline: string;
    emotionalDraws: Array<{ title: string; description: string }>;
    bucketListMoments: string[];
    idealTravelers: Array<{ profile: string; whyItFits: string }>;
  };
  seasonality: {
    peakSeason: { months: string; description: string; bookingNote: string };
    shoulderSeason: { months: string; description: string; bookingNote: string };
    lowSeason: { months: string; description: string; bookingNote: string };
    keyEvents: Array<{ name: string; timing: string; impact: string }>;
    leadTimeRequired: string;
  };
  urgencyDrivers: {
    limitedAvailability: string[];
    priceEscalation: string[];
    timeSensitive: string[];
    whyBookToday: string[];
  };
  qualifyingQuestions: {
    readyToBuy: Array<{ question: string; greenFlagAnswer: string }>;
    budgetIndicators: Array<{ question: string; whatItReveals: string }>;
    redFlags: string[];
  };
  whyAudley: {
    vsGroupTours: Array<{ point: string; talkingPoint: string }>;
    vsOtherPrivate: Array<{ point: string; talkingPoint: string }>;
    destinationSpecific: string[];
  };
  passthroughScript: {
    transitionPhrases: string[];
    whatSalesWillDo: string[];
    handlingObjections: Array<{ objection: string; response: string }>;
    settingExpectations: string[];
  };
}

// Build the prompt for Claude to generate GTA-focused training content
const buildTrainingPrompt = (
  destination: string,
  currentTpRate: number,
  departmentAvgRate: number,
  customFocus?: string
): string => {
  const customFocusSection = customFocus
    ? `\n\nSPECIAL FOCUS REQUESTED BY TRAINER:\n${customFocus}\n\nPlease incorporate this focus throughout the training content where relevant.`
    : '';

  return `You are a travel industry expert creating conversion-focused training for Global Travel Advisors (GTAs) at Audley Travel, a luxury tailor-made travel company.

CRITICAL CONTEXT:
- GTAs are NOT product specialists - they are business development professionals
- Their PRIMARY job is to qualify prospects and pass them to Sales Specialists who build itineraries
- Current T>P (Trip-to-Passthrough) rate for ${destination}: ${currentTpRate.toFixed(1)}%
- Department average: ${departmentAvgRate.toFixed(1)}%
- Goal: Help GTAs identify qualified clients and create urgency to speak with Sales TODAY${customFocusSection}

GTAs need:
1. HIGH-LEVEL destination appeal (NOT detailed product knowledge)
2. Seasonality and timing information
3. Urgency drivers to encourage booking now
4. Qualifying questions to identify serious buyers
5. Why Audley beats competitors
6. Scripts for warm-transferring to Sales

Return ONLY valid JSON matching this exact structure:

{
  "destination": "${destination}",
  "destinationHook": {
    "tagline": "A compelling one-line hook that captures why people dream of ${destination}",
    "emotionalDraws": [
      {"title": "Draw 1 Name", "description": "2-3 sentences about this emotional/experiential draw"},
      {"title": "Draw 2 Name", "description": "2-3 sentences about this emotional/experiential draw"},
      {"title": "Draw 3 Name", "description": "2-3 sentences about this emotional/experiential draw"},
      {"title": "Draw 4 Name", "description": "2-3 sentences about this emotional/experiential draw"}
    ],
    "bucketListMoments": ["5-6 iconic bucket list moments/experiences that spark immediate interest"],
    "idealTravelers": [
      {"profile": "Traveler type (e.g., Honeymooners)", "whyItFits": "Why ${destination} is perfect for them"},
      {"profile": "Traveler type", "whyItFits": "Why ${destination} is perfect for them"},
      {"profile": "Traveler type", "whyItFits": "Why ${destination} is perfect for them"},
      {"profile": "Traveler type", "whyItFits": "Why ${destination} is perfect for them"}
    ]
  },
  "seasonality": {
    "peakSeason": {
      "months": "Month - Month",
      "description": "What makes this peak season and weather expectations",
      "bookingNote": "How far ahead to book and availability concerns"
    },
    "shoulderSeason": {
      "months": "Month - Month",
      "description": "Benefits of shoulder season travel",
      "bookingNote": "Booking recommendations and potential savings"
    },
    "lowSeason": {
      "months": "Month - Month",
      "description": "What to expect and who this works for",
      "bookingNote": "Availability and pricing notes"
    },
    "keyEvents": [
      {"name": "Event/Festival name", "timing": "When it occurs", "impact": "How it affects travel/availability"},
      {"name": "Event/Festival name", "timing": "When it occurs", "impact": "How it affects travel/availability"}
    ],
    "leadTimeRequired": "How far in advance clients typically need to book for ${destination}"
  },
  "urgencyDrivers": {
    "limitedAvailability": [
      "3-4 specific reasons why availability is limited (small lodges, migration timing, popular routes, etc.)"
    ],
    "priceEscalation": [
      "2-3 reasons why prices increase (seasonal pricing, early booking discounts expiring, etc.)"
    ],
    "timeSensitive": [
      "2-3 time-sensitive opportunities (new routes, special offers, optimal wildlife viewing windows, etc.)"
    ],
    "whyBookToday": [
      "4-5 compelling reasons why the client should speak with a Sales Specialist TODAY rather than wait"
    ]
  },
  "qualifyingQuestions": {
    "readyToBuy": [
      {"question": "Question to determine if they're ready to book", "greenFlagAnswer": "Answer that indicates they're serious"},
      {"question": "Question to determine readiness", "greenFlagAnswer": "What a qualified prospect says"},
      {"question": "Question to determine readiness", "greenFlagAnswer": "What a qualified prospect says"}
    ],
    "budgetIndicators": [
      {"question": "Indirect question that reveals budget", "whatItReveals": "What their answer tells you about budget fit"},
      {"question": "Indirect question that reveals budget", "whatItReveals": "What their answer tells you about budget fit"},
      {"question": "Indirect question that reveals budget", "whatItReveals": "What their answer tells you about budget fit"}
    ],
    "redFlags": [
      "4-5 red flags that indicate someone is NOT a good fit for Audley (just browsing, unrealistic budget, etc.)"
    ]
  },
  "whyAudley": {
    "vsGroupTours": [
      {"point": "Key differentiator vs group tours", "talkingPoint": "How to present this to the client"},
      {"point": "Key differentiator vs group tours", "talkingPoint": "How to present this to the client"},
      {"point": "Key differentiator vs group tours", "talkingPoint": "How to present this to the client"},
      {"point": "Key differentiator vs group tours", "talkingPoint": "How to present this to the client"}
    ],
    "vsOtherPrivate": [
      {"point": "Key differentiator vs other private tour companies", "talkingPoint": "How to present this to the client"},
      {"point": "Key differentiator vs other private tour companies", "talkingPoint": "How to present this to the client"},
      {"point": "Key differentiator vs other private tour companies", "talkingPoint": "How to present this to the client"},
      {"point": "Key differentiator vs other private tour companies", "talkingPoint": "How to present this to the client"}
    ],
    "destinationSpecific": [
      "3-4 specific advantages Audley has for ${destination} (local offices, exclusive access, specialist expertise, etc.)"
    ]
  },
  "passthroughScript": {
    "transitionPhrases": [
      "4-5 natural phrases to transition the client to speak with a Sales Specialist"
    ],
    "whatSalesWillDo": [
      "4-5 specific things the Sales Specialist will do for them (build custom itinerary, share insider knowledge, etc.)"
    ],
    "handlingObjections": [
      {"objection": "I'm just researching right now", "response": "Helpful response that encourages the call anyway"},
      {"objection": "I need to talk to my partner first", "response": "Response that gets them both on a call"},
      {"objection": "Can you just send me some information?", "response": "Response that emphasizes value of the conversation"},
      {"objection": "I'm not ready to book yet", "response": "Response about planning timeline and no commitment"}
    ],
    "settingExpectations": [
      "3-4 things to tell the client about what to expect from the Sales call (no pressure, custom recommendations, etc.)"
    ]
  }
}

IMPORTANT:
- Focus on CONVERSION, not product expertise
- GTAs don't need to know specific hotels or tour names
- Every piece of content should help GTAs identify qualified clients and create urgency
- Urgency drivers should be specific and believable, not generic
- Objection handlers should be helpful and not pushy
- Return ONLY the JSON, no markdown formatting or explanation`;
};

// Call Claude API to generate training content
export const generateTrainingContent = async (
  destination: string,
  currentTpRate: number,
  departmentAvgRate: number,
  apiKey: string,
  customFocus?: string
): Promise<TrainingContent> => {
  const anthropic = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const prompt = buildTrainingPrompt(destination, currentTpRate, departmentAvgRate, customFocus);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  // Parse the JSON response
  try {
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }

    return JSON.parse(jsonText.trim()) as TrainingContent;
  } catch {
    console.error('Failed to parse training content JSON:', content.text);
    throw new Error('Failed to parse training content from Claude response');
  }
};

// Color palette for slides
const COLORS = {
  primary: '6366F1',      // Indigo 500
  primaryDark: '4F46E5',  // Indigo 600
  secondary: '8B5CF6',    // Violet 500
  accent: '06B6D4',       // Cyan 500
  success: '10B981',      // Emerald 500
  warning: 'F59E0B',      // Amber 500
  danger: 'EF4444',       // Red 500
  dark: '0F172A',         // Slate 900
  darkAlt: '1E293B',      // Slate 800
  darkCard: '334155',     // Slate 700
  light: '94A3B8',        // Slate 400
  lighter: 'CBD5E1',      // Slate 300
  white: 'FFFFFF',
};

// Generate PowerPoint training deck from content
export const generateTrainingDeck = async (content: TrainingContent): Promise<void> => {
  const pptx = new pptxgen();

  pptx.author = 'Global Travel Hub';
  pptx.title = `${content.destination} - GTA Conversion Training`;
  pptx.subject = 'Conversion Training for Global Travel Advisors';
  pptx.layout = 'LAYOUT_16x9';

  // Helper function for slide headers
  const addSlideHeader = (slide: pptxgen.Slide, title: string, subtitle?: string, icon?: string) => {
    slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.12, fill: { color: COLORS.primary } });

    const titleText = icon ? `${icon}  ${title}` : title;
    slide.addText(titleText, {
      x: 0.5, y: 0.35, w: 9, h: 0.65,
      fontSize: 32, bold: true, color: COLORS.white, fontFace: 'Arial',
    });

    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.5, y: 0.95, w: 9, h: 0.35,
        fontSize: 14, color: COLORS.light, fontFace: 'Arial',
      });
    }

    slide.addShape('rect', { x: 0.5, y: 1.35, w: 2, h: 0.02, fill: { color: COLORS.primary } });
  };

  // Helper for gradient cards
  const addCard = (
    slide: pptxgen.Slide,
    x: number,
    y: number,
    w: number,
    h: number,
    borderColor: string
  ) => {
    slide.addShape('rect', {
      x, y, w, h,
      fill: { color: COLORS.darkAlt },
      line: { color: borderColor, width: 2 },
      shadow: { type: 'outer', blur: 8, offset: 2, angle: 45, opacity: 0.3, color: '000000' },
    });
  };

  // ===== SLIDE 1: TITLE =====
  const slide1 = pptx.addSlide();
  slide1.background = { color: COLORS.dark };

  slide1.addShape('rect', {
    x: -1, y: -1, w: 6, h: 7,
    fill: { color: COLORS.primary, transparency: 85 },
    rotate: 15,
  });
  slide1.addShape('rect', {
    x: 6, y: -2, w: 6, h: 8,
    fill: { color: COLORS.secondary, transparency: 90 },
    rotate: -10,
  });

  slide1.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.15, fill: { color: COLORS.primary } });

  slide1.addText(content.destination.toUpperCase(), {
    x: 0.5, y: 1.6, w: 9, h: 1.0,
    fontSize: 56, bold: true, color: COLORS.white, align: 'center', fontFace: 'Arial',
    shadow: { type: 'outer', blur: 10, offset: 3, angle: 45, opacity: 0.5, color: '000000' },
  });

  slide1.addText('GTA Conversion Training', {
    x: 0.5, y: 2.7, w: 9, h: 0.5,
    fontSize: 24, color: COLORS.lighter, align: 'center', fontFace: 'Arial',
  });

  slide1.addShape('rect', { x: 3.5, y: 3.3, w: 3, h: 0.04, fill: { color: COLORS.warning } });

  slide1.addText(content.destinationHook.tagline, {
    x: 1, y: 3.6, w: 8, h: 0.6,
    fontSize: 16, color: COLORS.accent, align: 'center', italic: true, fontFace: 'Arial',
  });

  slide1.addShape('roundRect', {
    x: 3.2, y: 4.3, w: 3.6, h: 0.5,
    fill: { color: COLORS.darkAlt, transparency: 30 },
    line: { color: COLORS.primary, width: 1 },
  });
  slide1.addText('15-20 Minute Quick Reference', {
    x: 3.2, y: 4.35, w: 3.6, h: 0.45,
    fontSize: 14, color: COLORS.white, align: 'center', fontFace: 'Arial',
  });

  // ===== SLIDE 2: AGENDA =====
  const slide2 = pptx.addSlide();
  slide2.background = { color: COLORS.dark };
  addSlideHeader(slide2, 'Training Agenda', 'Conversion-Focused Quick Reference', '📋');

  const agendaItems = [
    { num: '01', title: 'What Draws People There', time: '3 min', color: COLORS.accent, icon: '✨' },
    { num: '02', title: 'Seasonality & Timing', time: '3 min', color: COLORS.success, icon: '📅' },
    { num: '03', title: 'Urgency Drivers', time: '3 min', color: COLORS.danger, icon: '⚡' },
    { num: '04', title: 'Qualifying Questions', time: '3 min', color: COLORS.warning, icon: '🎯' },
    { num: '05', title: 'Why Audley Wins', time: '3 min', color: COLORS.secondary, icon: '🏆' },
    { num: '06', title: 'Passthrough Scripts', time: '3 min', color: COLORS.primary, icon: '🤝' },
  ];

  agendaItems.forEach((item, i) => {
    const y = 1.55 + i * 0.68;

    slide2.addShape('rect', {
      x: 0.8, y, w: 8.4, h: 0.58,
      fill: { color: COLORS.darkAlt },
    });
    slide2.addShape('rect', {
      x: 0.8, y, w: 0.08, h: 0.58,
      fill: { color: item.color },
    });

    slide2.addShape('roundRect', {
      x: 1.0, y: y + 0.1, w: 0.45, h: 0.38,
      fill: { color: item.color },
    });
    slide2.addText(item.num, {
      x: 1.0, y: y + 0.12, w: 0.45, h: 0.35,
      fontSize: 12, bold: true, color: COLORS.white, align: 'center', fontFace: 'Arial',
    });

    slide2.addText(`${item.icon}  ${item.title}`, {
      x: 1.6, y: y + 0.12, w: 5.5, h: 0.35,
      fontSize: 14, color: COLORS.white, fontFace: 'Arial',
    });

    slide2.addText(item.time, {
      x: 7.8, y: y + 0.15, w: 1.2, h: 0.3,
      fontSize: 11, color: COLORS.light, align: 'right', fontFace: 'Arial',
    });
  });

  // ===== SLIDE 3: WHAT DRAWS PEOPLE =====
  const slide3 = pptx.addSlide();
  slide3.background = { color: COLORS.dark };
  addSlideHeader(slide3, 'What Draws People There', 'Emotional & Experiential Hooks', '✨');

  content.destinationHook.emotionalDraws.slice(0, 4).forEach((draw, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 4.7;
    const y = 1.55 + row * 1.95;

    addCard(slide3, x, y, 4.5, 1.8, COLORS.accent);

    slide3.addText(draw.title, {
      x: x + 0.15, y: y + 0.12, w: 4.2, h: 0.4,
      fontSize: 14, bold: true, color: COLORS.accent, fontFace: 'Arial',
    });

    slide3.addText(draw.description, {
      x: x + 0.15, y: y + 0.55, w: 4.2, h: 1.1,
      fontSize: 11, color: COLORS.lighter, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 4: BUCKET LIST MOMENTS =====
  const slide4 = pptx.addSlide();
  slide4.background = { color: COLORS.dark };
  addSlideHeader(slide4, 'Bucket List Moments', 'Iconic Experiences That Spark Interest', '🌟');

  content.destinationHook.bucketListMoments.slice(0, 6).forEach((moment, i) => {
    const y = 1.55 + i * 0.65;

    slide4.addShape('rect', {
      x: 0.5, y, w: 9, h: 0.55,
      fill: { color: COLORS.darkAlt },
      line: { color: COLORS.warning, width: 1 },
    });

    slide4.addText('⭐', {
      x: 0.6, y: y + 0.1, w: 0.4, h: 0.35,
      fontSize: 14, fontFace: 'Arial',
    });

    slide4.addText(moment, {
      x: 1.1, y: y + 0.12, w: 8.2, h: 0.35,
      fontSize: 13, color: COLORS.white, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 5: IDEAL TRAVELER PROFILES =====
  const slide5 = pptx.addSlide();
  slide5.background = { color: COLORS.dark };
  addSlideHeader(slide5, 'Ideal Traveler Profiles', 'Who Is This Destination Perfect For?', '🎯');

  content.destinationHook.idealTravelers.slice(0, 4).forEach((traveler, i) => {
    const y = 1.55 + i * 1.0;

    addCard(slide5, 0.5, y, 9, 0.88, COLORS.primary);

    slide5.addText(`👤 ${traveler.profile}`, {
      x: 0.7, y: y + 0.1, w: 3, h: 0.35,
      fontSize: 14, bold: true, color: COLORS.primary, fontFace: 'Arial',
    });

    slide5.addText(traveler.whyItFits, {
      x: 3.8, y: y + 0.1, w: 5.5, h: 0.7,
      fontSize: 11, color: COLORS.lighter, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 6: SEASONALITY =====
  const slide6 = pptx.addSlide();
  slide6.background = { color: COLORS.dark };
  addSlideHeader(slide6, 'Seasonality & Timing', 'When to Go and Lead Time', '📅');

  // Peak Season
  addCard(slide6, 0.5, 1.5, 3.0, 1.9, COLORS.danger);
  slide6.addText('🔥 PEAK SEASON', {
    x: 0.6, y: 1.55, w: 2.8, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.danger, fontFace: 'Arial',
  });
  slide6.addText(content.seasonality.peakSeason.months, {
    x: 0.6, y: 1.9, w: 2.8, h: 0.3,
    fontSize: 11, bold: true, color: COLORS.white, fontFace: 'Arial',
  });
  slide6.addText(content.seasonality.peakSeason.description, {
    x: 0.6, y: 2.2, w: 2.8, h: 0.6,
    fontSize: 9, color: COLORS.light, fontFace: 'Arial',
  });
  slide6.addText(`📌 ${content.seasonality.peakSeason.bookingNote}`, {
    x: 0.6, y: 2.85, w: 2.8, h: 0.5,
    fontSize: 9, color: COLORS.warning, fontFace: 'Arial',
  });

  // Shoulder Season
  addCard(slide6, 3.65, 1.5, 3.0, 1.9, COLORS.success);
  slide6.addText('👍 SHOULDER', {
    x: 3.75, y: 1.55, w: 2.8, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.success, fontFace: 'Arial',
  });
  slide6.addText(content.seasonality.shoulderSeason.months, {
    x: 3.75, y: 1.9, w: 2.8, h: 0.3,
    fontSize: 11, bold: true, color: COLORS.white, fontFace: 'Arial',
  });
  slide6.addText(content.seasonality.shoulderSeason.description, {
    x: 3.75, y: 2.2, w: 2.8, h: 0.6,
    fontSize: 9, color: COLORS.light, fontFace: 'Arial',
  });
  slide6.addText(`📌 ${content.seasonality.shoulderSeason.bookingNote}`, {
    x: 3.75, y: 2.85, w: 2.8, h: 0.5,
    fontSize: 9, color: COLORS.warning, fontFace: 'Arial',
  });

  // Low Season
  addCard(slide6, 6.8, 1.5, 3.0, 1.9, COLORS.accent);
  slide6.addText('💰 LOW SEASON', {
    x: 6.9, y: 1.55, w: 2.8, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.accent, fontFace: 'Arial',
  });
  slide6.addText(content.seasonality.lowSeason.months, {
    x: 6.9, y: 1.9, w: 2.8, h: 0.3,
    fontSize: 11, bold: true, color: COLORS.white, fontFace: 'Arial',
  });
  slide6.addText(content.seasonality.lowSeason.description, {
    x: 6.9, y: 2.2, w: 2.8, h: 0.6,
    fontSize: 9, color: COLORS.light, fontFace: 'Arial',
  });
  slide6.addText(`📌 ${content.seasonality.lowSeason.bookingNote}`, {
    x: 6.9, y: 2.85, w: 2.8, h: 0.5,
    fontSize: 9, color: COLORS.warning, fontFace: 'Arial',
  });

  // Lead time
  slide6.addShape('rect', {
    x: 0.5, y: 3.55, w: 9.3, h: 0.55,
    fill: { color: COLORS.warning, transparency: 80 },
    line: { color: COLORS.warning, width: 1 },
  });
  slide6.addText(`⏰ Lead Time: ${content.seasonality.leadTimeRequired}`, {
    x: 0.7, y: 3.62, w: 9, h: 0.4,
    fontSize: 12, bold: true, color: COLORS.white, fontFace: 'Arial',
  });

  // Key Events
  slide6.addText('📆 Key Events to Know:', {
    x: 0.5, y: 4.2, w: 9, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.lighter, fontFace: 'Arial',
  });

  content.seasonality.keyEvents.slice(0, 2).forEach((event, i) => {
    slide6.addText(`• ${event.name} (${event.timing}): ${event.impact}`, {
      x: 0.5, y: 4.55 + i * 0.4, w: 9.3, h: 0.35,
      fontSize: 10, color: COLORS.light, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 7: URGENCY DRIVERS =====
  const slide7 = pptx.addSlide();
  slide7.background = { color: COLORS.dark };
  addSlideHeader(slide7, 'Urgency Drivers', 'Create Momentum to Book NOW', '⚡');

  // Limited Availability
  slide7.addText('🔒 Limited Availability', {
    x: 0.5, y: 1.5, w: 4.3, h: 0.35,
    fontSize: 13, bold: true, color: COLORS.danger, fontFace: 'Arial',
  });
  content.urgencyDrivers.limitedAvailability.slice(0, 3).forEach((item, i) => {
    slide7.addText(`• ${item}`, {
      x: 0.5, y: 1.85 + i * 0.4, w: 4.3, h: 0.38,
      fontSize: 10, color: COLORS.lighter, fontFace: 'Arial',
    });
  });

  // Price Escalation
  slide7.addText('💰 Price Escalation', {
    x: 5.2, y: 1.5, w: 4.3, h: 0.35,
    fontSize: 13, bold: true, color: COLORS.warning, fontFace: 'Arial',
  });
  content.urgencyDrivers.priceEscalation.slice(0, 3).forEach((item, i) => {
    slide7.addText(`• ${item}`, {
      x: 5.2, y: 1.85 + i * 0.4, w: 4.3, h: 0.38,
      fontSize: 10, color: COLORS.lighter, fontFace: 'Arial',
    });
  });

  // Why Book Today box
  slide7.addShape('rect', {
    x: 0.5, y: 3.2, w: 9.3, h: 2.2,
    fill: { color: COLORS.darkAlt },
    line: { color: COLORS.success, width: 2 },
  });
  slide7.addText('✅ WHY SPEAK WITH SALES TODAY', {
    x: 0.7, y: 3.3, w: 9, h: 0.4,
    fontSize: 14, bold: true, color: COLORS.success, fontFace: 'Arial',
  });
  content.urgencyDrivers.whyBookToday.slice(0, 4).forEach((item, i) => {
    slide7.addText(`• ${item}`, {
      x: 0.7, y: 3.75 + i * 0.4, w: 8.9, h: 0.38,
      fontSize: 11, color: COLORS.white, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 8: QUALIFYING QUESTIONS =====
  const slide8 = pptx.addSlide();
  slide8.background = { color: COLORS.dark };
  addSlideHeader(slide8, 'Qualifying Questions', 'Identify Serious Buyers', '🎯');

  // Ready to Buy
  slide8.addText('✅ Ready-to-Buy Signals', {
    x: 0.5, y: 1.5, w: 4.5, h: 0.35,
    fontSize: 13, bold: true, color: COLORS.success, fontFace: 'Arial',
  });
  content.qualifyingQuestions.readyToBuy.slice(0, 3).forEach((item, i) => {
    const y = 1.9 + i * 0.75;
    slide8.addText(`"${item.question}"`, {
      x: 0.5, y, w: 4.5, h: 0.35,
      fontSize: 10, color: COLORS.white, italic: true, fontFace: 'Arial',
    });
    slide8.addText(`→ Green flag: ${item.greenFlagAnswer}`, {
      x: 0.5, y: y + 0.32, w: 4.5, h: 0.38,
      fontSize: 9, color: COLORS.success, fontFace: 'Arial',
    });
  });

  // Budget Indicators
  slide8.addText('💰 Budget Indicators', {
    x: 5.2, y: 1.5, w: 4.5, h: 0.35,
    fontSize: 13, bold: true, color: COLORS.warning, fontFace: 'Arial',
  });
  content.qualifyingQuestions.budgetIndicators.slice(0, 3).forEach((item, i) => {
    const y = 1.9 + i * 0.75;
    slide8.addText(`"${item.question}"`, {
      x: 5.2, y, w: 4.5, h: 0.35,
      fontSize: 10, color: COLORS.white, italic: true, fontFace: 'Arial',
    });
    slide8.addText(`→ ${item.whatItReveals}`, {
      x: 5.2, y: y + 0.32, w: 4.5, h: 0.38,
      fontSize: 9, color: COLORS.warning, fontFace: 'Arial',
    });
  });

  // Red Flags
  slide8.addText('🚩 Red Flags (Not a Fit)', {
    x: 0.5, y: 4.25, w: 9, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.danger, fontFace: 'Arial',
  });
  const redFlagsText = content.qualifyingQuestions.redFlags.slice(0, 4).map(f => `• ${f}`).join('  ');
  slide8.addText(redFlagsText, {
    x: 0.5, y: 4.6, w: 9.3, h: 0.7,
    fontSize: 10, color: COLORS.light, fontFace: 'Arial',
  });

  // ===== SLIDE 9: WHY AUDLEY VS GROUP TOURS =====
  const slide9 = pptx.addSlide();
  slide9.background = { color: COLORS.dark };
  addSlideHeader(slide9, 'Why Audley Wins', 'vs Group Tours', '🏆');

  content.whyAudley.vsGroupTours.slice(0, 4).forEach((item, i) => {
    const y = 1.55 + i * 1.0;

    addCard(slide9, 0.5, y, 9, 0.88, COLORS.primary);

    slide9.addText(`✓ ${item.point}`, {
      x: 0.7, y: y + 0.1, w: 8.6, h: 0.35,
      fontSize: 13, bold: true, color: COLORS.primary, fontFace: 'Arial',
    });

    slide9.addText(`Say: "${item.talkingPoint}"`, {
      x: 0.7, y: y + 0.45, w: 8.6, h: 0.38,
      fontSize: 10, color: COLORS.lighter, italic: true, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 10: WHY AUDLEY VS OTHER PRIVATE =====
  const slide10 = pptx.addSlide();
  slide10.background = { color: COLORS.dark };
  addSlideHeader(slide10, 'Why Audley Wins', 'vs Other Private Tour Companies', '🏆');

  content.whyAudley.vsOtherPrivate.slice(0, 4).forEach((item, i) => {
    const y = 1.55 + i * 1.0;

    addCard(slide10, 0.5, y, 9, 0.88, COLORS.secondary);

    slide10.addText(`✓ ${item.point}`, {
      x: 0.7, y: y + 0.1, w: 8.6, h: 0.35,
      fontSize: 13, bold: true, color: COLORS.secondary, fontFace: 'Arial',
    });

    slide10.addText(`Say: "${item.talkingPoint}"`, {
      x: 0.7, y: y + 0.45, w: 8.6, h: 0.38,
      fontSize: 10, color: COLORS.lighter, italic: true, fontFace: 'Arial',
    });
  });

  // Destination-specific advantages
  slide10.addText(`🌟 ${content.destination}-Specific Advantages:`, {
    x: 0.5, y: 4.6, w: 9, h: 0.35,
    fontSize: 11, bold: true, color: COLORS.accent, fontFace: 'Arial',
  });
  const destAdvText = content.whyAudley.destinationSpecific.slice(0, 3).map(a => `• ${a}`).join('  ');
  slide10.addText(destAdvText, {
    x: 0.5, y: 4.95, w: 9.3, h: 0.5,
    fontSize: 10, color: COLORS.lighter, fontFace: 'Arial',
  });

  // ===== SLIDE 11: PASSTHROUGH SCRIPTS =====
  const slide11 = pptx.addSlide();
  slide11.background = { color: COLORS.dark };
  addSlideHeader(slide11, 'Passthrough Scripts', 'Transitioning to Sales', '🤝');

  // Transition Phrases
  slide11.addText('🎯 Transition Phrases:', {
    x: 0.5, y: 1.5, w: 4.5, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.success, fontFace: 'Arial',
  });
  content.passthroughScript.transitionPhrases.slice(0, 3).forEach((phrase, i) => {
    slide11.addText(`"${phrase}"`, {
      x: 0.5, y: 1.85 + i * 0.45, w: 4.5, h: 0.42,
      fontSize: 10, color: COLORS.white, italic: true, fontFace: 'Arial',
    });
  });

  // What Sales Will Do
  slide11.addText('📋 What Sales Will Do:', {
    x: 5.2, y: 1.5, w: 4.5, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.accent, fontFace: 'Arial',
  });
  content.passthroughScript.whatSalesWillDo.slice(0, 4).forEach((item, i) => {
    slide11.addText(`• ${item}`, {
      x: 5.2, y: 1.85 + i * 0.38, w: 4.5, h: 0.35,
      fontSize: 10, color: COLORS.lighter, fontFace: 'Arial',
    });
  });

  // Setting Expectations
  slide11.addText('💬 Set Expectations:', {
    x: 0.5, y: 3.35, w: 9, h: 0.35,
    fontSize: 11, bold: true, color: COLORS.warning, fontFace: 'Arial',
  });
  const expectText = content.passthroughScript.settingExpectations.slice(0, 3).map(e => `• ${e}`).join('  ');
  slide11.addText(expectText, {
    x: 0.5, y: 3.7, w: 9.3, h: 0.5,
    fontSize: 10, color: COLORS.light, fontFace: 'Arial',
  });

  // ===== SLIDE 12: HANDLING OBJECTIONS =====
  const slide12 = pptx.addSlide();
  slide12.background = { color: COLORS.dark };
  addSlideHeader(slide12, 'Handling Objections', 'Common Pushbacks & Responses', '💪');

  content.passthroughScript.handlingObjections.slice(0, 4).forEach((item, i) => {
    const y = 1.55 + i * 1.0;

    // Objection
    slide12.addShape('rect', {
      x: 0.5, y, w: 9, h: 0.4,
      fill: { color: COLORS.danger, transparency: 70 },
    });
    slide12.addText(`❌ "${item.objection}"`, {
      x: 0.6, y: y + 0.05, w: 8.8, h: 0.32,
      fontSize: 11, color: COLORS.white, fontFace: 'Arial',
    });

    // Response
    slide12.addShape('rect', {
      x: 0.5, y: y + 0.42, w: 9, h: 0.5,
      fill: { color: COLORS.darkAlt },
      line: { color: COLORS.success, width: 1 },
    });
    slide12.addText(`✅ ${item.response}`, {
      x: 0.6, y: y + 0.48, w: 8.8, h: 0.4,
      fontSize: 10, color: COLORS.success, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 13: KEY TAKEAWAYS =====
  const slideTakeaways = pptx.addSlide();
  slideTakeaways.background = { color: COLORS.dark };
  addSlideHeader(slideTakeaways, 'Key Takeaways', 'Remember These for Every Call', '📝');

  const takeaways = [
    `✨ Hook: ${content.destinationHook.tagline}`,
    `📅 Peak Season: ${content.seasonality.peakSeason.months} - book ${content.seasonality.leadTimeRequired}`,
    `⚡ Urgency: ${content.urgencyDrivers.whyBookToday[0]}`,
    `🎯 Qualify: Ask about travel dates and past luxury experiences`,
    `🏆 Why Audley: ${content.whyAudley.vsGroupTours[0]?.point || 'Private, personalized, expert support'}`,
    `🤝 Passthrough: "${content.passthroughScript.transitionPhrases[0]}"`,
  ];

  takeaways.forEach((takeaway, i) => {
    const y = 1.55 + i * 0.65;

    slideTakeaways.addShape('rect', {
      x: 0.5, y, w: 0.1, h: 0.52,
      fill: { color: COLORS.success },
    });
    slideTakeaways.addText(takeaway, {
      x: 0.8, y: y + 0.08, w: 8.7, h: 0.48,
      fontSize: 12, color: COLORS.white, fontFace: 'Arial',
    });
  });

  slideTakeaways.addText('Your Goal: Get qualified clients talking to Sales TODAY!', {
    x: 0.5, y: 5.0, w: 9, h: 0.45,
    fontSize: 18, bold: true, color: COLORS.warning, align: 'center', fontFace: 'Arial',
  });

  // ===== SLIDE 14: THANK YOU =====
  const slideThank = pptx.addSlide();
  slideThank.background = { color: COLORS.dark };

  slideThank.addShape('ellipse', {
    x: -2, y: -1, w: 5, h: 5,
    fill: { color: COLORS.primary, transparency: 85 },
  });
  slideThank.addShape('ellipse', {
    x: 7, y: 2, w: 4, h: 4,
    fill: { color: COLORS.warning, transparency: 90 },
  });

  slideThank.addShape('rect', { x: 0, y: 5.45, w: '100%', h: 0.18, fill: { color: COLORS.primary } });

  slideThank.addText('Now Go Convert!', {
    x: 0.5, y: 1.8, w: 9, h: 0.9,
    fontSize: 48, bold: true, color: COLORS.white, align: 'center', fontFace: 'Arial',
    shadow: { type: 'outer', blur: 10, offset: 3, angle: 45, opacity: 0.5, color: '000000' },
  });

  slideThank.addText(content.destination, {
    x: 0.5, y: 2.8, w: 9, h: 0.7,
    fontSize: 32, color: COLORS.warning, align: 'center', fontFace: 'Arial',
  });

  slideThank.addText('Every qualified passthrough is a potential booking!', {
    x: 0.5, y: 3.7, w: 9, h: 0.45,
    fontSize: 16, color: COLORS.lighter, align: 'center', fontFace: 'Arial',
  });

  slideThank.addText('Generated by Global Travel Hub', {
    x: 0.5, y: 4.8, w: 9, h: 0.3,
    fontSize: 10, color: COLORS.light, italic: true, align: 'center', fontFace: 'Arial',
  });

  // Save the file
  const fileName = `${content.destination.replace(/\s+/g, '_')}_GTA_Conversion_Training_${new Date().toISOString().split('T')[0]}.pptx`;
  const pptxBlob = await pptx.write({ outputType: 'blob' }) as Blob;
  saveAs(pptxBlob, fileName);
};

// Main function to generate training
export const generateDestinationTraining = async (
  destination: string,
  currentTpRate: number,
  departmentAvgRate: number,
  apiKey: string,
  onProgress?: (stage: string) => void,
  customFocus?: string
): Promise<void> => {
  // Stage 1: Generate content with Claude
  onProgress?.('Generating conversion-focused training content...');
  const content = await generateTrainingContent(destination, currentTpRate, departmentAvgRate, apiKey, customFocus);

  // Stage 2: Generate PowerPoint
  onProgress?.('Creating PowerPoint presentation...');
  await generateTrainingDeck(content);

  onProgress?.('Complete!');
};
