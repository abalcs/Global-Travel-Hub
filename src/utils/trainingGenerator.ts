import Anthropic from '@anthropic-ai/sdk';
import pptxgen from 'pptxgenjs';
import { saveAs } from 'file-saver';

// Training content structure returned by Claude
export interface TrainingContent {
  destination: string;
  overview: {
    introduction: string;
    uniqueSellingPoints: string[];
    bestTimeToVisit: string;
    idealTripLength: string;
    keyFacts: string[];
  };
  hotels: {
    luxury: Array<{ name: string; highlights: string; location: string }>;
    midRange: Array<{ name: string; highlights: string; location: string }>;
    boutique: Array<{ name: string; highlights: string; location: string }>;
  };
  excursions: {
    mustDo: Array<{ name: string; description: string; duration: string }>;
    hiddenGems: Array<{ name: string; description: string; duration: string }>;
    cultural: Array<{ name: string; description: string; duration: string }>;
  };
  advisorTips: {
    idealClients: string[];
    commonConcerns: Array<{ concern: string; response: string }>;
    conversationStarters: string[];
    proTips: string[];
  };
  quizQuestions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }>;
}

// Build the prompt for Claude to generate training content
const buildTrainingPrompt = (
  destination: string,
  currentTpRate: number,
  departmentAvgRate: number,
  customFocus?: string
): string => {
  const customFocusSection = customFocus
    ? `\n\nSPECIAL FOCUS REQUESTED BY TRAINER:\n${customFocus}\n\nPlease incorporate this focus throughout the training content where relevant - in the selling points, hotel selections, experience recommendations, advisor tips, and quiz questions.`
    : '';

  return `You are a travel industry expert helping create product training for Global Travel Advisors (GTAs) at a luxury tailor-made travel company. GTAs are business development professionals who help match clients with the perfect trip experiences.

CONTEXT:
- The GTAs' current Trip-to-Passthrough (T>P) conversion rate for ${destination} is ${currentTpRate.toFixed(1)}%
- The department average is ${departmentAvgRate.toFixed(1)}%
- Goal: Help GTAs improve their destination expertise to better serve clients and increase successful trip matches${customFocusSection}

Please generate comprehensive training content for a 45-minute product training session. Return ONLY valid JSON matching this exact structure:

{
  "destination": "${destination}",
  "overview": {
    "introduction": "A compelling 2-3 sentence introduction about ${destination} that captures its essence and appeal",
    "uniqueSellingPoints": ["5-7 unique selling points that make ${destination} special"],
    "bestTimeToVisit": "Best seasons/months to visit and why",
    "idealTripLength": "Recommended trip duration with reasoning",
    "keyFacts": ["4-5 interesting facts about ${destination} that advisors should know"]
  },
  "hotels": {
    "luxury": [
      {"name": "Hotel Name", "highlights": "Key features and what makes it exceptional", "location": "Area/region"},
      {"name": "Hotel Name", "highlights": "Key features and what makes it exceptional", "location": "Area/region"},
      {"name": "Hotel Name", "highlights": "Key features and what makes it exceptional", "location": "Area/region"}
    ],
    "midRange": [
      {"name": "Hotel Name", "highlights": "Key features and value proposition", "location": "Area/region"},
      {"name": "Hotel Name", "highlights": "Key features and value proposition", "location": "Area/region"}
    ],
    "boutique": [
      {"name": "Hotel Name", "highlights": "Unique character and experience", "location": "Area/region"},
      {"name": "Hotel Name", "highlights": "Unique character and experience", "location": "Area/region"}
    ]
  },
  "excursions": {
    "mustDo": [
      {"name": "Experience Name", "description": "What makes this unmissable", "duration": "Half day/Full day/etc"},
      {"name": "Experience Name", "description": "What makes this unmissable", "duration": "Half day/Full day/etc"},
      {"name": "Experience Name", "description": "What makes this unmissable", "duration": "Half day/Full day/etc"}
    ],
    "hiddenGems": [
      {"name": "Experience Name", "description": "Why this is special and underrated", "duration": "Duration"},
      {"name": "Experience Name", "description": "Why this is special and underrated", "duration": "Duration"}
    ],
    "cultural": [
      {"name": "Experience Name", "description": "Cultural significance and what to expect", "duration": "Duration"},
      {"name": "Experience Name", "description": "Cultural significance and what to expect", "duration": "Duration"}
    ]
  },
  "advisorTips": {
    "idealClients": ["5-6 client profiles that are perfect for ${destination}"],
    "commonConcerns": [
      {"concern": "Common question or concern clients have", "response": "Helpful, informative response"},
      {"concern": "Common question or concern clients have", "response": "Helpful, informative response"},
      {"concern": "Common question or concern clients have", "response": "Helpful, informative response"},
      {"concern": "Common question or concern clients have", "response": "Helpful, informative response"}
    ],
    "conversationStarters": ["5-6 engaging questions to discover if ${destination} is right for a client"],
    "proTips": ["4-5 insider tips that experienced advisors know about ${destination}"]
  },
  "quizQuestions": [
    {
      "question": "Question about ${destination}?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Why this is correct and the key learning point"
    },
    {
      "question": "Question about ${destination}?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 1,
      "explanation": "Why this is correct and the key learning point"
    },
    {
      "question": "Question about ${destination}?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 2,
      "explanation": "Why this is correct and the key learning point"
    },
    {
      "question": "Question about ${destination}?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Why this is correct and the key learning point"
    },
    {
      "question": "Question about ${destination}?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 1,
      "explanation": "Why this is correct and the key learning point"
    }
  ]
}

IMPORTANT:
- Focus on building destination expertise that helps advisors match clients with the right experiences
- Include specific hotel and experience names that advisors should know
- Make responses to concerns informative and helpful, not pushy
- Quiz questions should reinforce key destination knowledge
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

// Color palette for slides - modernized
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
  gradient1: '4F46E5',    // Indigo
  gradient2: '7C3AED',    // Purple
};

// Generate PowerPoint training deck from content
export const generateTrainingDeck = async (content: TrainingContent): Promise<void> => {
  const pptx = new pptxgen();

  // Set presentation properties
  pptx.author = 'GTT KPI Report';
  pptx.title = `${content.destination} - Global Travel Advisor Training`;
  pptx.subject = 'Destination Training for Global Travel Advisors';
  pptx.layout = 'LAYOUT_16x9';

  // Helper function for modern slide headers with gradient accent
  const addSlideHeader = (slide: pptxgen.Slide, title: string, subtitle?: string, icon?: string) => {
    // Gradient accent bar
    slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.12, fill: { color: COLORS.primary } });

    // Title with optional icon
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

    // Subtle separator line
    slide.addShape('rect', { x: 0.5, y: 1.35, w: 2, h: 0.02, fill: { color: COLORS.primary } });
  };

  // Helper for gradient background cards
  const addGradientCard = (
    slide: pptxgen.Slide,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
  ) => {
    slide.addShape('rect', {
      x, y, w, h,
      fill: { color: COLORS.darkAlt },
      line: { color, width: 2 },
      shadow: { type: 'outer', blur: 8, offset: 2, angle: 45, opacity: 0.3, color: '000000' },
    });
  };

  // ===== SLIDE 1: TITLE WITH GRADIENT BACKGROUND =====
  const slide1 = pptx.addSlide();
  slide1.background = { color: COLORS.dark };

  // Decorative gradient shapes for visual interest
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

  // Gradient accent bar at top
  slide1.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.15, fill: { color: COLORS.primary } });

  // Destination name - large and bold
  slide1.addText(content.destination.toUpperCase(), {
    x: 0.5, y: 1.8, w: 9, h: 1.0,
    fontSize: 56, bold: true, color: COLORS.white, align: 'center', fontFace: 'Arial',
    shadow: { type: 'outer', blur: 10, offset: 3, angle: 45, opacity: 0.5, color: '000000' },
  });

  // Subtitle
  slide1.addText('Global Travel Advisor Training', {
    x: 0.5, y: 2.9, w: 9, h: 0.5,
    fontSize: 24, color: COLORS.lighter, align: 'center', fontFace: 'Arial',
  });

  // Decorative line
  slide1.addShape('rect', { x: 3.5, y: 3.5, w: 3, h: 0.04, fill: { color: COLORS.warning } });

  // Session info badge
  slide1.addShape('roundRect', {
    x: 3.2, y: 4.0, w: 3.6, h: 0.5,
    fill: { color: COLORS.darkAlt, transparency: 30 },
    line: { color: COLORS.primary, width: 1 },
  });
  slide1.addText('45-Minute Training Session', {
    x: 3.2, y: 4.05, w: 3.6, h: 0.45,
    fontSize: 14, color: COLORS.white, align: 'center', fontFace: 'Arial',
  });

  // ===== SLIDE 2: AGENDA =====
  const slide2 = pptx.addSlide();
  slide2.background = { color: COLORS.dark };
  addSlideHeader(slide2, 'Training Agenda', '45 Minutes of Destination Expertise', '📋');

  const agendaItems = [
    { num: '01', title: 'Destination Overview & Key Facts', time: '8 min', color: COLORS.accent, icon: '🌍' },
    { num: '02', title: 'Accommodations Deep Dive', time: '10 min', color: COLORS.warning, icon: '🏨' },
    { num: '03', title: 'Experiences & Excursions', time: '10 min', color: COLORS.success, icon: '✨' },
    { num: '04', title: 'Client Matching & Advisor Tips', time: '10 min', color: COLORS.secondary, icon: '💡' },
    { num: '05', title: 'Knowledge Check & Discussion', time: '7 min', color: COLORS.primary, icon: '🎯' },
  ];

  agendaItems.forEach((item, i) => {
    const y = 1.55 + i * 0.85;

    // Card with colored left border
    slide2.addShape('rect', {
      x: 0.8, y, w: 8.4, h: 0.72,
      fill: { color: COLORS.darkAlt },
    });
    slide2.addShape('rect', {
      x: 0.8, y, w: 0.08, h: 0.72,
      fill: { color: item.color },
    });

    // Number badge
    slide2.addShape('roundRect', {
      x: 1.0, y: y + 0.15, w: 0.55, h: 0.42,
      fill: { color: item.color },
    });
    slide2.addText(item.num, {
      x: 1.0, y: y + 0.18, w: 0.55, h: 0.38,
      fontSize: 14, bold: true, color: COLORS.white, align: 'center', fontFace: 'Arial',
    });

    // Icon and title
    slide2.addText(`${item.icon}  ${item.title}`, {
      x: 1.7, y: y + 0.18, w: 5.5, h: 0.38,
      fontSize: 16, color: COLORS.white, fontFace: 'Arial',
    });

    // Duration
    slide2.addText(item.time, {
      x: 7.8, y: y + 0.22, w: 1.2, h: 0.3,
      fontSize: 12, color: COLORS.light, align: 'right', fontFace: 'Arial',
    });
  });

  // ===== SLIDE 3: DESTINATION OVERVIEW =====
  const slide3 = pptx.addSlide();
  slide3.background = { color: COLORS.dark };

  // Decorative accent on right side
  slide3.addShape('rect', {
    x: 8.5, y: 0, w: 1.5, h: 5.625,
    fill: { color: COLORS.primary, transparency: 80 },
  });
  slide3.addShape('ellipse', {
    x: 7.5, y: 1.5, w: 3, h: 3,
    fill: { color: COLORS.accent, transparency: 90 },
  });

  addSlideHeader(slide3, content.destination, 'Destination Overview', '🌍');

  // Introduction card
  slide3.addShape('rect', {
    x: 0.5, y: 1.5, w: 4.5, h: 1.4,
    fill: { color: COLORS.darkAlt },
    line: { color: COLORS.accent, width: 1 },
  });
  slide3.addText(content.overview.introduction, {
    x: 0.65, y: 1.6, w: 4.2, h: 1.2,
    fontSize: 12, color: COLORS.white, fontFace: 'Arial',
  });

  // Quick facts row
  slide3.addShape('roundRect', {
    x: 0.5, y: 3.0, w: 2.1, h: 0.6,
    fill: { color: COLORS.success, transparency: 80 },
    line: { color: COLORS.success, width: 1 },
  });
  slide3.addText(`🗓️ ${content.overview.bestTimeToVisit}`, {
    x: 0.6, y: 3.1, w: 2.0, h: 0.45,
    fontSize: 10, color: COLORS.white, fontFace: 'Arial',
  });

  slide3.addShape('roundRect', {
    x: 2.7, y: 3.0, w: 2.3, h: 0.6,
    fill: { color: COLORS.warning, transparency: 80 },
    line: { color: COLORS.warning, width: 1 },
  });
  slide3.addText(`⏱️ ${content.overview.idealTripLength}`, {
    x: 2.8, y: 3.1, w: 2.1, h: 0.45,
    fontSize: 10, color: COLORS.white, fontFace: 'Arial',
  });

  // Key facts
  slide3.addText('Key Facts', {
    x: 0.5, y: 3.75, w: 4.5, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.accent, fontFace: 'Arial',
  });

  (content.overview.keyFacts || []).slice(0, 4).forEach((fact, i) => {
    slide3.addText(`• ${fact}`, {
      x: 0.5, y: 4.1 + i * 0.38, w: 4.5, h: 0.35,
      fontSize: 10, color: COLORS.lighter, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 4: UNIQUE SELLING POINTS =====
  const slide4 = pptx.addSlide();
  slide4.background = { color: COLORS.dark };
  addSlideHeader(slide4, 'Why Clients Love It', 'Unique Selling Points', '⭐');

  content.overview.uniqueSellingPoints.slice(0, 6).forEach((usp, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 4.7;
    const y = 1.55 + row * 1.3;

    addGradientCard(slide4, x, y, 4.5, 1.15, COLORS.primary);

    // Number badge
    slide4.addShape('ellipse', {
      x: x + 0.15, y: y + 0.15, w: 0.4, h: 0.4,
      fill: { color: COLORS.primary },
    });
    slide4.addText(`${i + 1}`, {
      x: x + 0.15, y: y + 0.18, w: 0.4, h: 0.35,
      fontSize: 12, bold: true, color: COLORS.white, align: 'center', fontFace: 'Arial',
    });

    slide4.addText(usp, {
      x: x + 0.65, y: y + 0.2, w: 3.7, h: 0.85,
      fontSize: 11, color: COLORS.white, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 5: LUXURY HOTELS =====
  const slide5 = pptx.addSlide();
  slide5.background = { color: COLORS.dark };
  addSlideHeader(slide5, 'Luxury Accommodations', 'Premium Properties to Know', '👑');

  content.hotels.luxury.forEach((hotel, i) => {
    const y = 1.55 + i * 1.3;

    addGradientCard(slide5, 0.5, y, 9, 1.15, COLORS.warning);

    // Hotel name with star
    slide5.addText(`⭐ ${hotel.name}`, {
      x: 0.7, y: y + 0.12, w: 6, h: 0.4,
      fontSize: 16, bold: true, color: COLORS.warning, fontFace: 'Arial',
    });

    // Location badge
    slide5.addShape('roundRect', {
      x: 7.5, y: y + 0.12, w: 1.8, h: 0.35,
      fill: { color: COLORS.darkCard },
    });
    slide5.addText(`📍 ${hotel.location}`, {
      x: 7.5, y: y + 0.15, w: 1.8, h: 0.3,
      fontSize: 9, color: COLORS.light, align: 'center', fontFace: 'Arial',
    });

    slide5.addText(hotel.highlights, {
      x: 0.7, y: y + 0.55, w: 8.6, h: 0.5,
      fontSize: 11, color: COLORS.lighter, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 6: MID-RANGE & BOUTIQUE =====
  const slide6 = pptx.addSlide();
  slide6.background = { color: COLORS.dark };
  addSlideHeader(slide6, 'More Great Options', 'Mid-Range & Boutique Properties', '🏨');

  // Mid-range section
  slide6.addText('💎 Mid-Range Excellence', {
    x: 0.5, y: 1.5, w: 4.3, h: 0.35,
    fontSize: 14, bold: true, color: COLORS.success, fontFace: 'Arial',
  });

  content.hotels.midRange.slice(0, 2).forEach((hotel, i) => {
    const y = 1.9 + i * 1.0;
    addGradientCard(slide6, 0.5, y, 4.3, 0.9, COLORS.success);
    slide6.addText(hotel.name, {
      x: 0.65, y: y + 0.08, w: 4.0, h: 0.32,
      fontSize: 13, bold: true, color: COLORS.white, fontFace: 'Arial',
    });
    slide6.addText(hotel.highlights, {
      x: 0.65, y: y + 0.45, w: 4.0, h: 0.4,
      fontSize: 10, color: COLORS.light, fontFace: 'Arial',
    });
  });

  // Boutique section
  slide6.addText('🎨 Boutique Character', {
    x: 5.2, y: 1.5, w: 4.3, h: 0.35,
    fontSize: 14, bold: true, color: COLORS.secondary, fontFace: 'Arial',
  });

  content.hotels.boutique.slice(0, 2).forEach((hotel, i) => {
    const y = 1.9 + i * 1.0;
    addGradientCard(slide6, 5.2, y, 4.3, 0.9, COLORS.secondary);
    slide6.addText(hotel.name, {
      x: 5.35, y: y + 0.08, w: 4.0, h: 0.32,
      fontSize: 13, bold: true, color: COLORS.white, fontFace: 'Arial',
    });
    slide6.addText(hotel.highlights, {
      x: 5.35, y: y + 0.45, w: 4.0, h: 0.4,
      fontSize: 10, color: COLORS.light, fontFace: 'Arial',
    });
  });

  // Pro tip
  slide6.addShape('rect', {
    x: 0.5, y: 4.1, w: 9, h: 0.7,
    fill: { color: COLORS.primary, transparency: 85 },
    line: { color: COLORS.primary, width: 1, dashType: 'dash' },
  });
  slide6.addText('💡 Pro Tip: Match accommodation style to client personality - adventurers love boutiques, families prefer properties with facilities', {
    x: 0.7, y: 4.2, w: 8.6, h: 0.5,
    fontSize: 11, color: COLORS.white, fontFace: 'Arial',
  });

  // ===== SLIDE 7: MUST-DO EXPERIENCES =====
  const slide7 = pptx.addSlide();
  slide7.background = { color: COLORS.dark };
  addSlideHeader(slide7, 'Must-Do Experiences', 'Essential Activities to Recommend', '✨');

  content.excursions.mustDo.forEach((exp, i) => {
    const y = 1.55 + i * 1.3;

    addGradientCard(slide7, 0.5, y, 9, 1.15, COLORS.success);

    slide7.addText(`✨ ${exp.name}`, {
      x: 0.7, y: y + 0.12, w: 7, h: 0.4,
      fontSize: 16, bold: true, color: COLORS.success, fontFace: 'Arial',
    });

    // Duration badge
    slide7.addShape('roundRect', {
      x: 7.8, y: y + 0.12, w: 1.5, h: 0.35,
      fill: { color: COLORS.success, transparency: 70 },
    });
    slide7.addText(`⏱️ ${exp.duration}`, {
      x: 7.8, y: y + 0.15, w: 1.5, h: 0.3,
      fontSize: 9, color: COLORS.white, align: 'center', fontFace: 'Arial',
    });

    slide7.addText(exp.description, {
      x: 0.7, y: y + 0.55, w: 8.6, h: 0.5,
      fontSize: 11, color: COLORS.lighter, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 8: HIDDEN GEMS & CULTURAL =====
  const slide8 = pptx.addSlide();
  slide8.background = { color: COLORS.dark };
  addSlideHeader(slide8, 'Beyond the Highlights', 'Hidden Gems & Cultural Experiences', '🔮');

  // Hidden Gems
  slide8.addText('💎 Hidden Gems', {
    x: 0.5, y: 1.5, w: 4.3, h: 0.35,
    fontSize: 14, bold: true, color: COLORS.warning, fontFace: 'Arial',
  });

  content.excursions.hiddenGems.forEach((exp, i) => {
    const y = 1.9 + i * 1.05;
    addGradientCard(slide8, 0.5, y, 4.3, 0.95, COLORS.warning);
    slide8.addText(exp.name, {
      x: 0.65, y: y + 0.08, w: 4.0, h: 0.32,
      fontSize: 12, bold: true, color: COLORS.warning, fontFace: 'Arial',
    });
    slide8.addText(exp.description, {
      x: 0.65, y: y + 0.45, w: 4.0, h: 0.45,
      fontSize: 10, color: COLORS.light, fontFace: 'Arial',
    });
  });

  // Cultural
  slide8.addText('🎭 Cultural Immersion', {
    x: 5.2, y: 1.5, w: 4.3, h: 0.35,
    fontSize: 14, bold: true, color: COLORS.secondary, fontFace: 'Arial',
  });

  content.excursions.cultural.forEach((exp, i) => {
    const y = 1.9 + i * 1.05;
    addGradientCard(slide8, 5.2, y, 4.3, 0.95, COLORS.secondary);
    slide8.addText(exp.name, {
      x: 5.35, y: y + 0.08, w: 4.0, h: 0.32,
      fontSize: 12, bold: true, color: COLORS.secondary, fontFace: 'Arial',
    });
    slide8.addText(exp.description, {
      x: 5.35, y: y + 0.45, w: 4.0, h: 0.45,
      fontSize: 10, color: COLORS.light, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 9: IDEAL CLIENTS =====
  const slide9 = pptx.addSlide();
  slide9.background = { color: COLORS.dark };
  addSlideHeader(slide9, 'Ideal Client Profiles', `Who Is ${content.destination} Perfect For?`, '🎯');

  content.advisorTips.idealClients.forEach((client, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 4.7;
    const y = 1.55 + row * 0.85;

    addGradientCard(slide9, x, y, 4.5, 0.72, COLORS.primary);
    slide9.addText(`✓ ${client}`, {
      x: x + 0.15, y: y + 0.18, w: 4.2, h: 0.5,
      fontSize: 12, color: COLORS.white, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 10: CONVERSATION STARTERS =====
  const slide10 = pptx.addSlide();
  slide10.background = { color: COLORS.dark };
  addSlideHeader(slide10, 'Discovery Questions', 'Finding the Right Fit', '💬');

  slide10.addText('Use these questions to discover if this destination matches your client:', {
    x: 0.5, y: 1.5, w: 9, h: 0.35,
    fontSize: 12, color: COLORS.light, fontFace: 'Arial',
  });

  content.advisorTips.conversationStarters.forEach((starter, i) => {
    const y = 1.95 + i * 0.68;

    slide10.addShape('rect', {
      x: 0.5, y, w: 9, h: 0.58,
      fill: { color: COLORS.darkAlt },
      line: { color: COLORS.accent, width: 0.5 },
    });
    slide10.addText(`"${starter}"`, {
      x: 0.7, y: y + 0.12, w: 8.6, h: 0.38,
      fontSize: 12, color: COLORS.white, italic: true, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 11: ADDRESSING CONCERNS =====
  const slide11 = pptx.addSlide();
  slide11.background = { color: COLORS.dark };
  addSlideHeader(slide11, 'Addressing Client Concerns', 'Common Questions & Helpful Responses', '🤝');

  content.advisorTips.commonConcerns.slice(0, 4).forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 4.7;
    const y = 1.55 + row * 2.0;

    // Concern
    slide11.addShape('rect', {
      x, y, w: 4.5, h: 0.55,
      fill: { color: COLORS.danger, transparency: 70 },
    });
    slide11.addText(`❓ "${item.concern}"`, {
      x: x + 0.1, y: y + 0.1, w: 4.3, h: 0.4,
      fontSize: 11, color: COLORS.white, fontFace: 'Arial',
    });

    // Response
    slide11.addShape('rect', {
      x, y: y + 0.58, w: 4.5, h: 0.85,
      fill: { color: COLORS.darkAlt },
      line: { color: COLORS.success, width: 1 },
    });
    slide11.addText(`✓ ${item.response}`, {
      x: x + 0.1, y: y + 0.65, w: 4.3, h: 0.72,
      fontSize: 10, color: COLORS.success, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 12: PRO TIPS =====
  const slide12 = pptx.addSlide();
  slide12.background = { color: COLORS.dark };
  addSlideHeader(slide12, 'Advisor Pro Tips', 'Insider Knowledge', '🏆');

  (content.advisorTips.proTips || []).forEach((tip, i) => {
    const y = 1.55 + i * 0.95;

    addGradientCard(slide12, 0.5, y, 9, 0.82, COLORS.warning);

    // Tip number
    slide12.addShape('ellipse', {
      x: 0.7, y: y + 0.2, w: 0.45, h: 0.45,
      fill: { color: COLORS.warning },
    });
    slide12.addText(`${i + 1}`, {
      x: 0.7, y: y + 0.24, w: 0.45, h: 0.38,
      fontSize: 14, bold: true, color: COLORS.dark, align: 'center', fontFace: 'Arial',
    });

    slide12.addText(tip, {
      x: 1.3, y: y + 0.22, w: 8.0, h: 0.55,
      fontSize: 13, color: COLORS.white, fontFace: 'Arial',
    });
  });

  // ===== QUIZ SLIDES =====
  content.quizQuestions.forEach((quiz, qIndex) => {
    const slideQ = pptx.addSlide();
    slideQ.background = { color: COLORS.dark };
    addSlideHeader(slideQ, `Knowledge Check`, `Question ${qIndex + 1} of ${content.quizQuestions.length}`, '🎯');

    slideQ.addText(quiz.question, {
      x: 0.5, y: 1.5, w: 9, h: 0.8,
      fontSize: 18, bold: true, color: COLORS.white, fontFace: 'Arial',
    });

    quiz.options.forEach((option, oIndex) => {
      const y = 2.4 + oIndex * 0.72;
      const isCorrect = oIndex === quiz.correctAnswer;
      const letter = String.fromCharCode(65 + oIndex);

      slide11.addShape('rect', {
        x: 0.5, y, w: 9, h: 0.62,
        fill: { color: COLORS.darkAlt },
        line: { color: isCorrect ? COLORS.success : COLORS.darkCard, width: isCorrect ? 2 : 1 },
      });

      // Letter badge
      slideQ.addShape('roundRect', {
        x: 0.6, y: y + 0.1, w: 0.45, h: 0.42,
        fill: { color: isCorrect ? COLORS.success : COLORS.darkCard },
      });
      slideQ.addText(letter, {
        x: 0.6, y: y + 0.14, w: 0.45, h: 0.35,
        fontSize: 12, bold: true, color: COLORS.white, align: 'center', fontFace: 'Arial',
      });

      slideQ.addText(option, {
        x: 1.2, y: y + 0.15, w: 8.1, h: 0.38,
        fontSize: 13, color: isCorrect ? COLORS.success : COLORS.white, fontFace: 'Arial',
      });
    });

    // Explanation
    slideQ.addShape('rect', {
      x: 0.5, y: 5.05, w: 9, h: 0.55,
      fill: { color: COLORS.warning, transparency: 85 },
      line: { color: COLORS.warning, width: 1 },
    });
    slideQ.addText(`💡 ${quiz.explanation}`, {
      x: 0.7, y: 5.12, w: 8.6, h: 0.42,
      fontSize: 11, color: COLORS.warning, fontFace: 'Arial',
    });
  });

  // ===== KEY TAKEAWAYS SLIDE =====
  const slideTakeaways = pptx.addSlide();
  slideTakeaways.background = { color: COLORS.dark };
  addSlideHeader(slideTakeaways, 'Key Takeaways', 'What to Remember', '📝');

  const takeaways = [
    `🌟 USP: ${content.overview.uniqueSellingPoints[0]}`,
    `🗓️ Best time: ${content.overview.bestTimeToVisit}`,
    `✨ Must-do: ${content.excursions.mustDo[0]?.name || 'Signature experiences'}`,
    `🏨 Know your properties across all categories`,
    `💎 Use hidden gems to differentiate`,
    `🎯 Match destination to right client profile`,
  ];

  takeaways.forEach((takeaway, i) => {
    const y = 1.55 + i * 0.65;

    slide11.addShape('rect', {
      x: 0.5, y, w: 0.1, h: 0.52,
      fill: { color: COLORS.success },
    });
    slideTakeaways.addText(takeaway, {
      x: 0.8, y: y + 0.08, w: 8.7, h: 0.45,
      fontSize: 13, color: COLORS.white, fontFace: 'Arial',
    });
  });

  slideTakeaways.addText('Questions? Let\'s Discuss!', {
    x: 0.5, y: 5.0, w: 9, h: 0.45,
    fontSize: 20, bold: true, color: COLORS.primary, align: 'center', fontFace: 'Arial',
  });

  // ===== THANK YOU SLIDE =====
  const slideThank = pptx.addSlide();
  slideThank.background = { color: COLORS.dark };

  // Decorative gradient shapes
  slideThank.addShape('ellipse', {
    x: -2, y: -1, w: 5, h: 5,
    fill: { color: COLORS.primary, transparency: 85 },
  });
  slideThank.addShape('ellipse', {
    x: 7, y: 2, w: 4, h: 4,
    fill: { color: COLORS.warning, transparency: 90 },
  });

  slideThank.addShape('rect', { x: 0, y: 5.45, w: '100%', h: 0.18, fill: { color: COLORS.primary } });

  slideThank.addText('Training Complete!', {
    x: 0.5, y: 1.8, w: 9, h: 0.9,
    fontSize: 48, bold: true, color: COLORS.white, align: 'center', fontFace: 'Arial',
    shadow: { type: 'outer', blur: 10, offset: 3, angle: 45, opacity: 0.5, color: '000000' },
  });

  slideThank.addText(content.destination, {
    x: 0.5, y: 2.8, w: 9, h: 0.7,
    fontSize: 32, color: COLORS.warning, align: 'center', fontFace: 'Arial',
  });

  slideThank.addText('You\'re now ready to match clients with amazing experiences!', {
    x: 0.5, y: 3.7, w: 9, h: 0.45,
    fontSize: 16, color: COLORS.lighter, align: 'center', fontFace: 'Arial',
  });

  slideThank.addText('Generated by GTT KPI Report', {
    x: 0.5, y: 4.8, w: 9, h: 0.3,
    fontSize: 10, color: COLORS.light, italic: true, align: 'center', fontFace: 'Arial',
  });

  // Save the file
  const fileName = `${content.destination.replace(/\s+/g, '_')}_GTA_Training_${new Date().toISOString().split('T')[0]}.pptx`;
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
  onProgress?.('Generating training content with AI...');
  const content = await generateTrainingContent(destination, currentTpRate, departmentAvgRate, apiKey, customFocus);

  // Stage 2: Generate PowerPoint
  onProgress?.('Creating PowerPoint presentation...');
  await generateTrainingDeck(content);

  onProgress?.('Complete!');
};
