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
  salesTips: {
    targetClients: string[];
    commonObjections: Array<{ objection: string; response: string }>;
    closingTechniques: string[];
    conversationStarters: string[];
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
  departmentAvgRate: number
): string => {
  return `You are a travel industry expert helping create product training for Global Travel Agents selling luxury tailor-made trips to ${destination}.

CONTEXT:
- The agents' current Trip-to-Passthrough (T>P) conversion rate for ${destination} is ${currentTpRate.toFixed(1)}%
- The department average is ${departmentAvgRate.toFixed(1)}%
- Goal: Help agents convert more trip inquiries into passthroughs (qualified leads) by improving their destination knowledge

Please generate comprehensive training content for a 45-minute product training session. Return ONLY valid JSON matching this exact structure:

{
  "destination": "${destination}",
  "overview": {
    "introduction": "A compelling 2-3 sentence introduction about ${destination} that agents can use to hook clients",
    "uniqueSellingPoints": ["5-7 unique selling points that differentiate ${destination} from competitors"],
    "bestTimeToVisit": "Best seasons/months to visit and why",
    "idealTripLength": "Recommended trip duration with reasoning"
  },
  "hotels": {
    "luxury": [
      {"name": "Hotel Name", "highlights": "Key features and why clients love it", "location": "Area/region"},
      {"name": "Hotel Name", "highlights": "Key features and why clients love it", "location": "Area/region"},
      {"name": "Hotel Name", "highlights": "Key features and why clients love it", "location": "Area/region"}
    ],
    "midRange": [
      {"name": "Hotel Name", "highlights": "Key features and why clients love it", "location": "Area/region"},
      {"name": "Hotel Name", "highlights": "Key features and why clients love it", "location": "Area/region"}
    ],
    "boutique": [
      {"name": "Hotel Name", "highlights": "Key features and unique character", "location": "Area/region"},
      {"name": "Hotel Name", "highlights": "Key features and unique character", "location": "Area/region"}
    ]
  },
  "excursions": {
    "mustDo": [
      {"name": "Experience Name", "description": "What makes this special", "duration": "Half day/Full day/etc"},
      {"name": "Experience Name", "description": "What makes this special", "duration": "Half day/Full day/etc"},
      {"name": "Experience Name", "description": "What makes this special", "duration": "Half day/Full day/etc"}
    ],
    "hiddenGems": [
      {"name": "Experience Name", "description": "Why this is special and underrated", "duration": "Duration"},
      {"name": "Experience Name", "description": "Why this is special and underrated", "duration": "Duration"}
    ],
    "cultural": [
      {"name": "Experience Name", "description": "Cultural significance and experience", "duration": "Duration"},
      {"name": "Experience Name", "description": "Cultural significance and experience", "duration": "Duration"}
    ]
  },
  "salesTips": {
    "targetClients": ["5-6 client profiles that are ideal for ${destination}"],
    "commonObjections": [
      {"objection": "Common concern clients raise", "response": "Effective response to address it"},
      {"objection": "Common concern clients raise", "response": "Effective response to address it"},
      {"objection": "Common concern clients raise", "response": "Effective response to address it"},
      {"objection": "Common concern clients raise", "response": "Effective response to address it"}
    ],
    "closingTechniques": ["4-5 specific closing techniques that work well for ${destination}"],
    "conversationStarters": ["5-6 engaging questions to start conversations about ${destination}"]
  },
  "quizQuestions": [
    {
      "question": "Question about ${destination}?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Why this is correct and what agents should remember"
    },
    {
      "question": "Question about ${destination}?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 1,
      "explanation": "Why this is correct and what agents should remember"
    },
    {
      "question": "Question about ${destination}?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 2,
      "explanation": "Why this is correct and what agents should remember"
    },
    {
      "question": "Question about ${destination}?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Why this is correct and what agents should remember"
    },
    {
      "question": "Question about ${destination}?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 1,
      "explanation": "Why this is correct and what agents should remember"
    }
  ]
}

IMPORTANT:
- Focus on actionable knowledge that helps convert inquiries to qualified leads
- Include specific hotel and experience names that agents should know
- Make objection responses consultative, not pushy
- Quiz questions should reinforce key selling points
- Return ONLY the JSON, no markdown formatting or explanation`;
};

// Call Claude API to generate training content
export const generateTrainingContent = async (
  destination: string,
  currentTpRate: number,
  departmentAvgRate: number,
  apiKey: string
): Promise<TrainingContent> => {
  const anthropic = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const prompt = buildTrainingPrompt(destination, currentTpRate, departmentAvgRate);

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
    // Clean up the response - remove any markdown code blocks if present
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
  primary: '4F46E5',      // Indigo
  secondary: '7C3AED',    // Purple
  success: '10B981',      // Emerald
  warning: 'F59E0B',      // Amber
  danger: 'EF4444',       // Red
  dark: '0F172A',         // Slate 900
  darkAlt: '1E293B',      // Slate 800
  light: '94A3B8',        // Slate 400
  white: 'FFFFFF',
};

// Generate PowerPoint training deck from content
export const generateTrainingDeck = async (content: TrainingContent): Promise<void> => {
  const pptx = new pptxgen();

  // Set presentation properties
  pptx.author = 'GTT KPI Report';
  pptx.title = `${content.destination} Product Training`;
  pptx.subject = 'Destination Product Training for Global Travel Agents';
  pptx.layout = 'LAYOUT_16x9';

  // Helper function for slide headers
  const addSlideHeader = (slide: pptxgen.Slide, title: string, subtitle?: string) => {
    slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: COLORS.primary } });
    slide.addText(title, {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: 28, bold: true, color: COLORS.white, fontFace: 'Arial',
    });
    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.5, y: 0.85, w: 9, h: 0.35,
        fontSize: 14, color: COLORS.light, fontFace: 'Arial',
      });
    }
  };

  // ===== SLIDE 1: TITLE =====
  const slide1 = pptx.addSlide();
  slide1.background = { color: COLORS.dark };
  slide1.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.15, fill: { color: COLORS.primary } });

  slide1.addText('PRODUCT TRAINING', {
    x: 0.5, y: 1.5, w: 9, h: 0.7,
    fontSize: 42, bold: true, color: COLORS.white, align: 'center', fontFace: 'Arial',
  });

  slide1.addText(content.destination.toUpperCase(), {
    x: 0.5, y: 2.3, w: 9, h: 0.8,
    fontSize: 52, bold: true, color: COLORS.warning, align: 'center', fontFace: 'Arial',
  });

  slide1.addShape('rect', { x: 3.5, y: 3.3, w: 3, h: 0.03, fill: { color: COLORS.primary } });

  slide1.addText('Improving Trip-to-Passthrough Conversion', {
    x: 0.5, y: 3.6, w: 9, h: 0.4,
    fontSize: 18, color: COLORS.light, align: 'center', fontFace: 'Arial',
  });

  slide1.addText('45-Minute Training Session', {
    x: 0.5, y: 4.4, w: 9, h: 0.3,
    fontSize: 14, color: COLORS.light, align: 'center', fontFace: 'Arial',
  });

  // ===== SLIDE 2: AGENDA =====
  const slide2 = pptx.addSlide();
  slide2.background = { color: COLORS.dark };
  addSlideHeader(slide2, 'Training Agenda', '45 Minutes');

  const agendaItems = [
    { num: '01', title: 'Destination Overview', time: '5 min', color: COLORS.success },
    { num: '02', title: 'Hotels & Accommodations', time: '10 min', color: COLORS.primary },
    { num: '03', title: 'Experiences & Excursions', time: '10 min', color: COLORS.secondary },
    { num: '04', title: 'Sales Techniques', time: '10 min', color: COLORS.warning },
    { num: '05', title: 'Handling Objections', time: '5 min', color: COLORS.danger },
    { num: '06', title: 'Quiz & Discussion', time: '5 min', color: COLORS.success },
  ];

  agendaItems.forEach((item, i) => {
    const y = 1.3 + i * 0.75;
    slide2.addShape('rect', {
      x: 0.8, y, w: 8.4, h: 0.65,
      fill: { color: COLORS.darkAlt },
      line: { color: item.color, width: 1.5 },
    });
    slide2.addText(item.num, {
      x: 1.0, y: y + 0.12, w: 0.5, h: 0.4,
      fontSize: 18, bold: true, color: item.color, fontFace: 'Arial',
    });
    slide2.addText(item.title, {
      x: 1.7, y: y + 0.15, w: 5, h: 0.35,
      fontSize: 16, color: COLORS.white, fontFace: 'Arial',
    });
    slide2.addText(item.time, {
      x: 7.8, y: y + 0.18, w: 1.2, h: 0.3,
      fontSize: 12, color: COLORS.light, align: 'right', fontFace: 'Arial',
    });
  });

  // ===== SLIDE 3: DESTINATION OVERVIEW =====
  const slide3 = pptx.addSlide();
  slide3.background = { color: COLORS.dark };
  addSlideHeader(slide3, content.destination, 'Destination Overview');

  // Introduction
  slide3.addShape('rect', {
    x: 0.5, y: 1.3, w: 9, h: 1.2,
    fill: { color: COLORS.darkAlt },
  });
  slide3.addText(content.overview.introduction, {
    x: 0.7, y: 1.4, w: 8.6, h: 1.0,
    fontSize: 14, color: COLORS.white, fontFace: 'Arial',
  });

  // Best time and trip length
  slide3.addText(`Best Time to Visit: ${content.overview.bestTimeToVisit}`, {
    x: 0.5, y: 2.7, w: 4.3, h: 0.4,
    fontSize: 12, color: COLORS.success, fontFace: 'Arial',
  });
  slide3.addText(`Ideal Trip Length: ${content.overview.idealTripLength}`, {
    x: 5.2, y: 2.7, w: 4.3, h: 0.4,
    fontSize: 12, color: COLORS.warning, fontFace: 'Arial',
  });

  // USPs
  slide3.addText('Unique Selling Points', {
    x: 0.5, y: 3.2, w: 9, h: 0.35,
    fontSize: 14, bold: true, color: COLORS.primary, fontFace: 'Arial',
  });

  content.overview.uniqueSellingPoints.slice(0, 6).forEach((usp, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    slide3.addText(`• ${usp}`, {
      x: 0.5 + col * 4.7, y: 3.6 + row * 0.55, w: 4.5, h: 0.5,
      fontSize: 11, color: COLORS.white, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 4: LUXURY HOTELS =====
  const slide4 = pptx.addSlide();
  slide4.background = { color: COLORS.dark };
  addSlideHeader(slide4, 'Luxury Accommodations', 'Premium Properties');

  content.hotels.luxury.forEach((hotel, i) => {
    const y = 1.3 + i * 1.3;
    slide4.addShape('rect', {
      x: 0.5, y, w: 9, h: 1.15,
      fill: { color: COLORS.darkAlt },
      line: { color: COLORS.warning, width: 1 },
    });
    slide4.addText(hotel.name, {
      x: 0.7, y: y + 0.1, w: 6, h: 0.35,
      fontSize: 16, bold: true, color: COLORS.warning, fontFace: 'Arial',
    });
    slide4.addText(hotel.location, {
      x: 7.0, y: y + 0.15, w: 2.3, h: 0.3,
      fontSize: 11, color: COLORS.light, align: 'right', fontFace: 'Arial',
    });
    slide4.addText(hotel.highlights, {
      x: 0.7, y: y + 0.5, w: 8.6, h: 0.55,
      fontSize: 12, color: COLORS.white, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 5: MID-RANGE & BOUTIQUE =====
  const slide5 = pptx.addSlide();
  slide5.background = { color: COLORS.dark };
  addSlideHeader(slide5, 'Mid-Range & Boutique', 'Value & Character');

  // Mid-range section
  slide5.addText('Mid-Range Options', {
    x: 0.5, y: 1.2, w: 4.3, h: 0.3,
    fontSize: 14, bold: true, color: COLORS.success, fontFace: 'Arial',
  });

  content.hotels.midRange.slice(0, 2).forEach((hotel, i) => {
    const y = 1.55 + i * 0.95;
    slide5.addShape('rect', {
      x: 0.5, y, w: 4.3, h: 0.85,
      fill: { color: COLORS.darkAlt },
    });
    slide5.addText(hotel.name, {
      x: 0.6, y: y + 0.05, w: 4.1, h: 0.3,
      fontSize: 13, bold: true, color: COLORS.white, fontFace: 'Arial',
    });
    slide5.addText(hotel.highlights, {
      x: 0.6, y: y + 0.4, w: 4.1, h: 0.4,
      fontSize: 10, color: COLORS.light, fontFace: 'Arial',
    });
  });

  // Boutique section
  slide5.addText('Boutique Properties', {
    x: 5.2, y: 1.2, w: 4.3, h: 0.3,
    fontSize: 14, bold: true, color: COLORS.secondary, fontFace: 'Arial',
  });

  content.hotels.boutique.slice(0, 2).forEach((hotel, i) => {
    const y = 1.55 + i * 0.95;
    slide5.addShape('rect', {
      x: 5.2, y, w: 4.3, h: 0.85,
      fill: { color: COLORS.darkAlt },
    });
    slide5.addText(hotel.name, {
      x: 5.3, y: y + 0.05, w: 4.1, h: 0.3,
      fontSize: 13, bold: true, color: COLORS.white, fontFace: 'Arial',
    });
    slide5.addText(hotel.highlights, {
      x: 5.3, y: y + 0.4, w: 4.1, h: 0.4,
      fontSize: 10, color: COLORS.light, fontFace: 'Arial',
    });
  });

  // Key selling tip
  slide5.addShape('rect', {
    x: 0.5, y: 3.6, w: 9, h: 0.8,
    fill: { color: '1a1a2e' },
    line: { color: COLORS.primary, width: 1, dashType: 'dash' },
  });
  slide5.addText('💡 Tip: Match accommodation style to client personality - adventurers love boutiques, families prefer mid-range with facilities', {
    x: 0.7, y: 3.75, w: 8.6, h: 0.5,
    fontSize: 12, color: COLORS.white, fontFace: 'Arial',
  });

  // ===== SLIDE 6: MUST-DO EXPERIENCES =====
  const slide6 = pptx.addSlide();
  slide6.background = { color: COLORS.dark };
  addSlideHeader(slide6, 'Must-Do Experiences', 'Essential Activities');

  content.excursions.mustDo.forEach((exp, i) => {
    const y = 1.3 + i * 1.25;
    slide6.addShape('rect', {
      x: 0.5, y, w: 9, h: 1.1,
      fill: { color: COLORS.darkAlt },
      line: { color: COLORS.success, width: 1 },
    });
    slide6.addText(exp.name, {
      x: 0.7, y: y + 0.1, w: 7, h: 0.35,
      fontSize: 16, bold: true, color: COLORS.success, fontFace: 'Arial',
    });
    slide6.addText(exp.duration, {
      x: 7.5, y: y + 0.15, w: 1.8, h: 0.25,
      fontSize: 10, color: COLORS.light, align: 'right', fontFace: 'Arial',
    });
    slide6.addText(exp.description, {
      x: 0.7, y: y + 0.5, w: 8.6, h: 0.5,
      fontSize: 12, color: COLORS.white, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 7: HIDDEN GEMS & CULTURAL =====
  const slide7 = pptx.addSlide();
  slide7.background = { color: COLORS.dark };
  addSlideHeader(slide7, 'Hidden Gems & Cultural', 'Differentiation Opportunities');

  // Hidden Gems
  slide7.addText('Hidden Gems', {
    x: 0.5, y: 1.2, w: 4.3, h: 0.3,
    fontSize: 14, bold: true, color: COLORS.warning, fontFace: 'Arial',
  });

  content.excursions.hiddenGems.forEach((exp, i) => {
    const y = 1.55 + i * 1.0;
    slide7.addShape('rect', {
      x: 0.5, y, w: 4.3, h: 0.9,
      fill: { color: COLORS.darkAlt },
    });
    slide7.addText(exp.name, {
      x: 0.6, y: y + 0.05, w: 4.1, h: 0.3,
      fontSize: 13, bold: true, color: COLORS.warning, fontFace: 'Arial',
    });
    slide7.addText(exp.description, {
      x: 0.6, y: y + 0.4, w: 4.1, h: 0.45,
      fontSize: 10, color: COLORS.light, fontFace: 'Arial',
    });
  });

  // Cultural
  slide7.addText('Cultural Experiences', {
    x: 5.2, y: 1.2, w: 4.3, h: 0.3,
    fontSize: 14, bold: true, color: COLORS.secondary, fontFace: 'Arial',
  });

  content.excursions.cultural.forEach((exp, i) => {
    const y = 1.55 + i * 1.0;
    slide7.addShape('rect', {
      x: 5.2, y, w: 4.3, h: 0.9,
      fill: { color: COLORS.darkAlt },
    });
    slide7.addText(exp.name, {
      x: 5.3, y: y + 0.05, w: 4.1, h: 0.3,
      fontSize: 13, bold: true, color: COLORS.secondary, fontFace: 'Arial',
    });
    slide7.addText(exp.description, {
      x: 5.3, y: y + 0.4, w: 4.1, h: 0.45,
      fontSize: 10, color: COLORS.light, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 8: TARGET CLIENTS =====
  const slide8 = pptx.addSlide();
  slide8.background = { color: COLORS.dark };
  addSlideHeader(slide8, 'Ideal Client Profiles', 'Who to Target');

  slide8.addText(`Who is ${content.destination} perfect for?`, {
    x: 0.5, y: 1.2, w: 9, h: 0.35,
    fontSize: 14, color: COLORS.light, fontFace: 'Arial',
  });

  content.salesTips.targetClients.forEach((client, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    slide8.addShape('rect', {
      x: 0.5 + col * 4.7, y: 1.6 + row * 0.75, w: 4.5, h: 0.65,
      fill: { color: COLORS.darkAlt },
      line: { color: COLORS.primary, width: 0.5 },
    });
    slide8.addText(`✓ ${client}`, {
      x: 0.6 + col * 4.7, y: 1.7 + row * 0.75, w: 4.3, h: 0.5,
      fontSize: 12, color: COLORS.white, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 9: CONVERSATION STARTERS =====
  const slide9 = pptx.addSlide();
  slide9.background = { color: COLORS.dark };
  addSlideHeader(slide9, 'Conversation Starters', 'Opening Questions');

  content.salesTips.conversationStarters.forEach((starter, i) => {
    const y = 1.3 + i * 0.7;
    slide9.addShape('rect', {
      x: 0.5, y, w: 9, h: 0.6,
      fill: { color: COLORS.darkAlt },
    });
    slide9.addText(`"${starter}"`, {
      x: 0.7, y: y + 0.12, w: 8.6, h: 0.4,
      fontSize: 13, color: COLORS.white, italic: true, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 10: HANDLING OBJECTIONS =====
  const slide10 = pptx.addSlide();
  slide10.background = { color: COLORS.dark };
  addSlideHeader(slide10, 'Handling Objections', 'Common Concerns & Responses');

  content.salesTips.commonObjections.slice(0, 4).forEach((obj, i) => {
    const y = 1.2 + i * 1.05;

    // Objection
    slide10.addShape('rect', {
      x: 0.5, y, w: 4.3, h: 0.45,
      fill: { color: COLORS.danger },
    });
    slide10.addText(`"${obj.objection}"`, {
      x: 0.6, y: y + 0.08, w: 4.1, h: 0.3,
      fontSize: 11, color: COLORS.white, fontFace: 'Arial',
    });

    // Response
    slide10.addShape('rect', {
      x: 0.5, y: y + 0.48, w: 4.3, h: 0.5,
      fill: { color: COLORS.darkAlt },
    });
    slide10.addText(`→ ${obj.response}`, {
      x: 0.6, y: y + 0.52, w: 4.1, h: 0.45,
      fontSize: 10, color: COLORS.success, fontFace: 'Arial',
    });
  });

  // ===== SLIDE 11: CLOSING TECHNIQUES =====
  const slide11 = pptx.addSlide();
  slide11.background = { color: COLORS.dark };
  addSlideHeader(slide11, 'Closing Techniques', 'Converting to Passthroughs');

  content.salesTips.closingTechniques.forEach((technique, i) => {
    const y = 1.3 + i * 0.8;
    slide11.addShape('rect', {
      x: 0.5, y, w: 9, h: 0.7,
      fill: { color: COLORS.darkAlt },
      line: { color: COLORS.success, width: 1 },
    });
    slide11.addText(`${i + 1}. ${technique}`, {
      x: 0.7, y: y + 0.15, w: 8.6, h: 0.45,
      fontSize: 13, color: COLORS.white, fontFace: 'Arial',
    });
  });

  // ===== SLIDES 12-16: QUIZ QUESTIONS =====
  content.quizQuestions.forEach((quiz, qIndex) => {
    const slideQ = pptx.addSlide();
    slideQ.background = { color: COLORS.dark };
    addSlideHeader(slideQ, `Quiz: Question ${qIndex + 1}`, 'Test Your Knowledge');

    slideQ.addText(quiz.question, {
      x: 0.5, y: 1.3, w: 9, h: 0.8,
      fontSize: 18, bold: true, color: COLORS.white, fontFace: 'Arial',
    });

    quiz.options.forEach((option, oIndex) => {
      const y = 2.3 + oIndex * 0.7;
      const isCorrect = oIndex === quiz.correctAnswer;
      slideQ.addShape('rect', {
        x: 0.5, y, w: 9, h: 0.6,
        fill: { color: COLORS.darkAlt },
        line: { color: isCorrect ? COLORS.success : COLORS.light, width: isCorrect ? 2 : 0.5 },
      });
      slideQ.addText(`${String.fromCharCode(65 + oIndex)}. ${option}`, {
        x: 0.7, y: y + 0.15, w: 8.6, h: 0.35,
        fontSize: 14, color: isCorrect ? COLORS.success : COLORS.white, fontFace: 'Arial',
      });
    });

    // Explanation
    slideQ.addShape('rect', {
      x: 0.5, y: 5.1, w: 9, h: 0.6,
      fill: { color: '1a1a2e' },
    });
    slideQ.addText(`💡 ${quiz.explanation}`, {
      x: 0.7, y: 5.2, w: 8.6, h: 0.45,
      fontSize: 11, color: COLORS.warning, fontFace: 'Arial',
    });
  });

  // ===== FINAL SLIDE: KEY TAKEAWAYS =====
  const slideFinal = pptx.addSlide();
  slideFinal.background = { color: COLORS.dark };
  addSlideHeader(slideFinal, 'Key Takeaways', 'Remember This!');

  const takeaways = [
    `Know the USPs: ${content.overview.uniqueSellingPoints[0]}`,
    `Best time to visit: ${content.overview.bestTimeToVisit}`,
    `Lead with must-do: ${content.excursions.mustDo[0]?.name || 'signature experiences'}`,
    `Match hotels to client needs - luxury, mid-range, or boutique`,
    `Use hidden gems to differentiate your recommendations`,
    `Address objections consultatively, not defensively`,
  ];

  takeaways.forEach((takeaway, i) => {
    const y = 1.3 + i * 0.65;
    slide11.addShape('rect', {
      x: 0.5, y, w: 0.08, h: 0.55,
      fill: { color: COLORS.success },
    });
    slideFinal.addText(`✓ ${takeaway}`, {
      x: 0.7, y: y + 0.1, w: 8.8, h: 0.45,
      fontSize: 13, color: COLORS.white, fontFace: 'Arial',
    });
  });

  slideFinal.addText('Questions? Discussion?', {
    x: 0.5, y: 5.0, w: 9, h: 0.4,
    fontSize: 20, bold: true, color: COLORS.primary, align: 'center', fontFace: 'Arial',
  });

  // ===== THANK YOU SLIDE =====
  const slideThank = pptx.addSlide();
  slideThank.background = { color: COLORS.dark };
  slideThank.addShape('rect', { x: 0, y: 5.45, w: '100%', h: 0.15, fill: { color: COLORS.primary } });

  slideThank.addText('Training Complete!', {
    x: 0.5, y: 2.0, w: 9, h: 0.8,
    fontSize: 44, bold: true, color: COLORS.white, align: 'center', fontFace: 'Arial',
  });

  slideThank.addText(content.destination, {
    x: 0.5, y: 2.9, w: 9, h: 0.6,
    fontSize: 28, color: COLORS.warning, align: 'center', fontFace: 'Arial',
  });

  slideThank.addText('Go convert those inquiries!', {
    x: 0.5, y: 3.7, w: 9, h: 0.4,
    fontSize: 18, color: COLORS.success, align: 'center', fontFace: 'Arial',
  });

  slideThank.addText('Generated by GTT KPI Report', {
    x: 0.5, y: 4.8, w: 9, h: 0.3,
    fontSize: 10, color: COLORS.light, italic: true, align: 'center', fontFace: 'Arial',
  });

  // Save the file
  const fileName = `${content.destination.replace(/\s+/g, '_')}_Product_Training_${new Date().toISOString().split('T')[0]}.pptx`;
  const pptxBlob = await pptx.write({ outputType: 'blob' }) as Blob;
  saveAs(pptxBlob, fileName);
};

// Main function to generate training
export const generateDestinationTraining = async (
  destination: string,
  currentTpRate: number,
  departmentAvgRate: number,
  apiKey: string,
  onProgress?: (stage: string) => void
): Promise<void> => {
  // Stage 1: Generate content with Claude
  onProgress?.('Generating training content with AI...');
  const content = await generateTrainingContent(destination, currentTpRate, departmentAvgRate, apiKey);

  // Stage 2: Generate PowerPoint
  onProgress?.('Creating PowerPoint presentation...');
  await generateTrainingDeck(content);

  onProgress?.('Complete!');
};
