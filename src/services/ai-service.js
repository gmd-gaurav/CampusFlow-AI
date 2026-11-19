const { GoogleGenAI } = require('@google/genai');

// AI Provider Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

let geminiClient = null;
if (GEMINI_API_KEY) {
  try {
    geminiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI client:', err.message);
  }
}

// Semantic Dictionary for expanding raw/casual student inputs into formal academic language
const ACADEMIC_EXPANSIONS = [
  { match: /\b(?:fever|sick|ill|headache|stomach\s*pain|cold|flu|unwell)\b/gi, replacement: "an acute medical indisposition requiring clinical attention and mandatory physician-advised bed rest" },
  { match: /\b(?:sister(?:'s)?|brother(?:'s)?|cousin(?:'s)?)\s*wedding\b/gi, replacement: "unavoidable family solemnization and traditional matrimonial commitments requiring personal presence" },
  { match: /\b(?:miss(?:ed)?\s*exam|exam\s*clash|re-?test|supplementary)\b/gi, replacement: "an unforeseen impediment on the scheduled evaluation date, necessitating a special supplementary assessment consideration" },
  { match: /\b(?:fee\s*problem|money\s*problem|financial|installment|pay\s*later)\b/gi, replacement: "temporary domestic liquidity constraints, respectfully petitioning for an institutional grace extension or installment facility" },
  { match: /\b(?:hackathon|competition|conference|sports|tournament)\b/gi, replacement: "institutional representation in a prestigious inter-collegiate academic and technical convention" },
  { match: /\b(?:projector|ac|fan|light|board|broken|not\s*working|repair)\b/gi, replacement: "sub-optimal pedagogical infrastructure and equipment malfunction severely impeding daily instructional sessions" },
  { match: /\b(?:timetable|reschedule|change\s*time|shift\s*class)\b/gi, replacement: "academic lecture schedule restructuring to optimize laboratory continuity and student curriculum progression" }
];

function transformCasualToAcademicProse(rawInput) {
  if (!rawInput || !rawInput.trim()) {
    return "I am respectfully petitioning the university administration regarding an urgent academic matter requiring your authorization.";
  }

  let polished = rawInput.trim();
  for (const item of ACADEMIC_EXPANSIONS) {
    if (item.match.test(polished)) {
      polished = polished.replace(item.match, item.replacement);
    }
  }

  // Capitalize and format as dignified declarative sentence
  if (!polished.endsWith('.')) polished += '.';
  return polished.charAt(0).toUpperCase() + polished.slice(1);
}
function sanitizeInput(text) {
  if (!text) return '';
  return String(text).trim().slice(0, 3000);
}

/**
 * -------------------------------------------------------------
 * FUNCTION A: APPLICATION WRITER
 * -------------------------------------------------------------
 */
async function generateApplication({
  prompt,
  category = 'General Administrative Request',
  recipientRole = 'coordinator',
  recipientName = '',
  applicantName = 'Student',
  rollNumber = '',
  department = '',
  course = 'B.Tech',
  semester = '4',
  section = 'A',
  isCollective = false,
  className = '',
  studentsCount = 1,
  language = 'en',
  tone = 'formal', // 'formal', 'shorter', 'more_formal'
  action = 'generate' // 'generate', 'improve', 'shorten', 'formalize', 'translate_hi_en', 'translate_en_hi'
}) {
  const cleanPrompt = sanitizeInput(prompt);

  // If Gemini client is active, try calling Gemini API
  if (geminiClient && GEMINI_API_KEY) {
    try {
      const recipientTitle = getRecipientTitle(recipientRole, recipientName);
      const systemInstruction = `You are CampusFlow AI, a premier institutional academic letter writing authority for accredited universities.
CRITICAL TRANSFORMATION RULES:
1. NEVER lazily echo or copy the applicant's raw words or casual sentence fragments verbatim.
2. Elevate all raw, colloquial, or fragmented inputs into dignified, formal, precise administrative English/Hindi.
3. Replace casual expressions with formal equivalents (e.g., replace "I have fever" with "I have been diagnosed with acute viral indisposition and prescribed complete medical rest").
4. Structure the output into standard institutional application architecture:
   - Clear Subject line (prefixed with "Subject: ")
   - Proper formal salutation (e.g., "Respected Sir/Madam," or "Respected Director Sir,")
   - Contextual introduction establishing student/class credentials
   - Articulate factual grievance/petition body with academic rigor
   - Explicit formal request and assurance of institutional compliance
   - Formal sign-off and complete signatory block.
5. Use temperature 0.35 for disciplined, impeccable academic tone.`;

      let userInstruction = '';
      if (action === 'translate_hi_en') {
        userInstruction = `Translate and thoroughly elevate this Hindi academic request into formal institutional English application format:\nDescription: "${cleanPrompt}"`;
      } else if (action === 'translate_en_hi') {
        userInstruction = `Translate and elevate this English request into pristine formal institutional Hindi (मानक प्रशासनिक हिंदी / राजभाषा):\nDescription: "${cleanPrompt}"`;
      } else if (action === 'shorten') {
        userInstruction = `Condense and refine the following into an executive, highly concise yet dignified institutional petition:\nText: "${cleanPrompt}"`;
      } else if (action === 'formalize' || action === 'improve') {
        userInstruction = `Completely rewrite the following to eliminate colloquialisms and achieve peak university administrative formality:\nText: "${cleanPrompt}"`;
      } else {
        userInstruction = `Draft a comprehensive, polished ${language === 'hi' ? 'Hindi' : 'English'} institutional application.
Applicant Category: ${category}
Raw Student Brief: "${cleanPrompt}"
Recipient: ${recipientTitle}
Applicant: ${isCollective ? `Class Representative representing ${className} (${studentsCount} students)` : `${applicantName} (Roll: ${rollNumber || 'N/A'}, ${course} ${department} Sem ${semester} Sec ${section})`}
Tone: ${tone}

Transform the raw student brief into eloquent, respectful academic prose. Do NOT repeat the student's exact sentences.`;
      }

      const response = await geminiClient.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          { role: 'user', parts: [{ text: `${systemInstruction}\n\n${userInstruction}` }] }
        ],
        config: {
          temperature: 0.35
        }
      });

      const responseText = response.text || '';
      const parsed = parseGeneratedApplication(responseText, category);
      return {
        ...parsed,
        source: 'gemini',
        model: GEMINI_MODEL
      };
    } catch (err) {
      console.warn('Gemini API call failed, falling back to built-in academic rule engine:', err.message);
    }
  }

  // Built-in intelligent academic rule engine fallback
  return generateWithRuleEngine({
    prompt: cleanPrompt,
    category,
    recipientRole,
    recipientName,
    applicantName,
    rollNumber,
    department,
    course,
    semester,
    section,
    isCollective,
    className,
    studentsCount,
    language,
    tone,
    action
  });
}

/**
 * -------------------------------------------------------------
 * FUNCTION B: APPLICATION SUMMARIZER
 * -------------------------------------------------------------
 */
async function summarizeApplication(applicationText, metadata = {}) {
  const cleanApp = sanitizeInput(applicationText);

  if (geminiClient && GEMINI_API_KEY) {
    try {
      const prompt = `You are CampusFlow AI's academic review summarizer for university authorities.
Analyze the following academic application submitted by a student.
Application Text:
"""
${cleanApp}
"""

Provide your output in strict JSON format with exactly these keys:
{
  "summary": "1 to 2 line factual, objective summary for the reviewing authority.",
  "main_request": "The single primary request being made.",
  "relevant_dates": "Extracted dates or timeframe mentioned, or 'Not specified'.",
  "applicant_details": "Extracted student/class credentials.",
  "missing_information": "Any crucial details or attachments missing, or 'None detected'."
}
Do not distort the student's request. Return ONLY the JSON object.`;

      const response = await geminiClient.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' }
      });

      const text = response.text || '{}';
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return {
        summary: parsed.summary || 'Summary unavailable.',
        keyInfo: {
          main_request: parsed.main_request || 'Main request not identified',
          relevant_dates: parsed.relevant_dates || 'Not specified',
          applicant_details: parsed.applicant_details || metadata.applicantName || 'Student',
          missing_information: parsed.missing_information || 'None detected'
        },
        source: 'gemini'
      };
    } catch (err) {
      console.warn('Gemini summarization failed, falling back to rule-based engine:', err.message);
    }
  }

  // Built-in rule-based summarizer
  return summarizeWithRuleEngine(cleanApp, metadata);
}

/**
 * -------------------------------------------------------------
 * FUNCTION C: APPLICATION QUALITY CHECKER
 * -------------------------------------------------------------
 */
async function checkQuality(applicationText, metadata = {}) {
  const cleanApp = sanitizeInput(applicationText);

  if (geminiClient && GEMINI_API_KEY) {
    try {
      const prompt = `Analyze this college application for quality, missing information, tone, and date inconsistencies.
Application:
"""
${cleanApp}
"""

Return a strict JSON object with:
{
  "clarity": "High" | "Medium" | "Low",
  "tone": "Respectful and formal" | "Informal" | "Overly aggressive" | "Neutral",
  "missing_info": "List any missing dates, contact info, reasons, or attachments, or 'None'.",
  "inconsistent_dates": "Any conflicting dates, or 'None detected'.",
  "issues": ["Issue 1", "Issue 2"] // empty array if no issues
}
Do not invent facts. Return ONLY JSON.`;

      const response = await geminiClient.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' }
      });

      const text = response.text || '{}';
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return {
        clarity: parsed.clarity || 'Medium',
        tone: parsed.tone || 'Formal',
        missing_info: parsed.missing_info || 'None',
        inconsistent_dates: parsed.inconsistent_dates || 'None detected',
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        source: 'gemini'
      };
    } catch (err) {
      console.warn('Gemini quality check failed, falling back to rule-based engine:', err.message);
    }
  }

  // Built-in rule-based quality checker
  return checkQualityWithRuleEngine(cleanApp, metadata);
}

/**
 * =============================================================
 * BUILT-IN ACADEMIC RULE & TEMPLATE ENGINE (FALLBACK / OFFLINE)
 * =============================================================
 */

function getRecipientTitle(role, name) {
  const names = {
    cr: 'The Class Representative',
    coordinator: 'The Class Coordinator',
    hod: 'The Head of Department',
    director: 'The Director',
    dean: 'The Dean of Academic Affairs',
    faculty: 'The Course Faculty / Reviewing Authority'
  };
  const base = names[role] || 'The Respected Authority';
  return name ? `${base} (${name})` : base;
}

function parseGeneratedApplication(fullText, category) {
  let subject = '';
  let body = fullText;

  const subjectMatch = fullText.match(/Subject\s*:\s*(.+?)(?:\n|$)/i);
  if (subjectMatch) {
    subject = subjectMatch[1].trim();
    // remove subject line from body
    body = fullText.replace(/Subject\s*:\s*.+?(?:\n|$)/i, '').trim();
  } else {
    subject = `Application Regarding ${category}`;
  }

  return {
    subject,
    body: body.trim()
  };
}

function generateWithRuleEngine({
  prompt,
  category,
  recipientRole,
  recipientName,
  applicantName,
  rollNumber,
  department,
  course,
  semester,
  section,
  isCollective,
  className,
  studentsCount,
  language,
  tone,
  action
}) {
  const isHindi = language === 'hi' || action === 'translate_en_hi';
  const recipientTitle = getRecipientTitle(recipientRole, recipientName);

  const elevatedProse = transformCasualToAcademicProse(prompt);

  if (isHindi) {
    let subject = `विषय: ${getHindiCategorySubject(category, prompt)}`;
    let salutation = recipientRole === 'director' ? 'आदरणीय निदेशक महोदय,' : 'सादर प्रणाम / महोदय,';

    let intro = '';
    let signoff = '';

    if (isCollective) {
      intro = `सविनय निवेदन यह है कि हम ${className || `${course} ${department} सेमेस्टर ${semester}`} के छात्र (कुल संख्या: ${studentsCount || 'समस्त विद्यार्थी'}), अपने कक्षा प्रतिनिधि के माध्यम से यह सामूहिक आवेदन आपके समक्ष प्रस्तुत कर रहे हैं।`;
      signoff = `सधन्यवाद,\n\nसमस्त छात्रों की ओर से,\n${applicantName} (कक्षा प्रतिनिधि)\nअनुक्रमांक (Roll No): ${rollNumber || '22CSE045'}\n${className || `${course} ${department}`}`;
    } else {
      intro = `सविनय निवेदन यह है कि मैं ${applicantName}, ${course} ${department} विभाग का छात्र हूँ (सेमेस्टर ${semester}, सेक्शन ${section}, रोल नंबर: ${rollNumber || "[रोल नंबर दर्ज करें]"})।`;
      signoff = `सधन्यवाद,\n\nआपका आज्ञाकारी छात्र,\n${applicantName}\nरोल नंबर: ${rollNumber || "[रोल नंबर दर्ज करें]"}\n${course} ${department} (सेम ${semester}, सेक ${section})`;
    }

    const mainBody = `प्रस्तुत पत्र के माध्यम से विश्वविद्यालय प्रशासन को सादर अवगत कराना है कि ${category.toLowerCase()} के संदर्भ में यह प्रार्थना पत्र प्रेषित किया गया है। आवश्यक कारणों एवं परिस्थितियों के दृष्टिगत, ${elevatedProse} इस विषय में सभी आवश्यक विवरण संलग्न कर दिए गए हैं। अतः आपसे विनम्र अनुरोध है कि उक्त परिस्थिति पर सहानुभूतिपूर्वक विचार करते हुए वांछित अनुमति प्रदान करने की महती कृपा करें।`;

    const body = `${salutation}\n\n${intro}\n\n${mainBody}\n\nमैं/हम संस्थान के सभी नियमों एवं निर्देशों का पूर्ण निष्ठा से पालन करने का विश्वास दिलाते हैं।\n\n${signoff}`;

    return {
      subject,
      body,
      source: 'rule-engine',
      model: 'campusflow-academic-rules-hi'
    };
  }

  // English Generation
  let subject = `Subject: Application for ${getEnglishCategorySubject(category, prompt)}`;
  let salutation = recipientRole === 'director' ? 'Respected Director Sir/Madam,' : 'Respected Sir/Madam,';

  let intro = '';
  let closing = '';

  if (isCollective) {
    intro = `We, the students of ${className || `${course} ${department}, Semester ${semester}, Section ${section}`} (representing ${studentsCount || 'all'} enrolled students of the cohort), respectfully submit this institutional petition through our elected Class Representative.`;
    closing = `We earnestly request your esteemed office to take favorable cognizance of our collective appeal and grant institutional sanction at the earliest.\n\nThanking you.\n\nYours faithfully,\nOn behalf of ${className || `${course} ${department} (Sec ${section})`},\n${applicantName} (Class Representative)\nRoll No: ${rollNumber || 'N/A'}`;
  } else {
    intro = `I am ${applicantName}, a regular enrolled student of ${course} in the Department of ${department}, Semester ${semester}, Section ${section} (University Roll No: ${rollNumber || '[Roll Number]'}).`;
    closing = `I earnestly request you to favorably consider my request and grant the requisite approval at your earliest convenience. I assure you of my ongoing commitment to institutional compliance and academic diligence.\n\nThanking you.\n\nYours obediently,\n${applicantName}\nRoll No: ${rollNumber || '[Roll Number]'}\n${course} ${department} - Sem ${semester} (Sec ${section})`;
  }

  // Adjust for tone actions
  if (action === 'shorten' || tone === 'shorter') {
    const compactBody = `${salutation}\n\nWith reference to the subject cited above, I respectfully submit this petition regarding ${category.toLowerCase()}.\n\nSpecifically, ${elevatedProse}\n\nAll relevant particulars are placed on record. I kindly request your prompt authorization.\n\nThank you.\n\n${applicantName}\n${course} ${department} (Roll: ${rollNumber})`;
    return {
      subject: `Subject: Formal Petition Regarding ${category}`,
      body: compactBody,
      source: 'rule-engine',
      model: 'campusflow-academic-rules-en-short'
    };
  }

  const fullBody = `${salutation}\n\n${intro}\n\nWith utmost respect, I wish to bring to your kind notice that this formal application is tendered regarding ${category.toLowerCase()}.\n\nCircumstances and Details:\n${elevatedProse}\n\nAll requisite corroborating details and documentation have been attached herewith for your administrative scrutiny.\n\n${closing}`;

  return {
    subject,
    body: fullBody,
    source: 'rule-engine',
    model: 'campusflow-academic-rules-en'
  };
}

function getEnglishCategorySubject(category, prompt) {
  const map = {
    'Leave Application': 'Grant of Leave of Absence',
    'Attendance Consideration': 'Consideration of Attendance on Medical / Academic Grounds',
    'Event Permission': 'Permission to Organize Academic / Departmental Event',
    'Academic Grievance': 'Redressal of Academic Grievance',
    'Fee-Related Request': 'Fee Payment Extension / Installment Request',
    'Examination-Related Request': 'Special Consideration for Examination / Re-Test',
    'Timetable Change Request': 'Proposed Adjustment in Academic Lecture Schedule',
    'Classroom Infrastructure Request': 'Maintenance and Repair of Classroom Equipment',
    'Scholarship-Related Request': 'Verification and Forwarding of Scholarship Documentation',
    'General Administrative Request': 'Official Academic & Administrative Clearance'
  };
  return map[category] || `Official Request Regarding ${category}`;
}

function getHindiCategorySubject(category, prompt) {
  const map = {
    'Leave Application': 'अवकाश (Leave) स्वीकृति हेतु आवेदन पत्र',
    'Attendance Consideration': 'उपस्थिति (Attendance) छूट एवं विचारार्थ प्रार्थना पत्र',
    'Event Permission': 'विभागीय शैक्षणिक कार्यक्रम आयोजन की अनुमति हेतु',
    'Academic Grievance': 'शैक्षणिक समस्या के समाधान हेतु प्रार्थना पत्र',
    'Fee-Related Request': 'शुल्क भुगतान समायोजन / तिथि विस्तार हेतु',
    'Examination-Related Request': 'परीक्षा एवं पुनः परीक्षा से संबंधित आवेदन',
    'Timetable Change Request': 'कक्षा समय-सारणी में परिवर्तन हेतु',
    'Classroom Infrastructure Request': 'कक्षा कक्ष के बुनियादी ढांचे एवं उपकरण सुधार हेतु',
    'Scholarship-Related Request': 'छात्रवृत्ति दस्तावेज सत्यापन एवं अग्रेषण हेतु',
    'General Administrative Request': 'संस्थान प्रशासनिक स्वीकृति हेतु'
  };
  return map[category] || `${category} के संबंध में आवेदन पत्र`;
}

function summarizeWithRuleEngine(text, metadata) {
  // Extract dates (e.g. 15th to 17th November, 2026-11-20, etc.)
  const dateRegex = /\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/gi;
  const dates = text.match(dateRegex) || [];
  const dateStr = dates.length > 0 ? Array.from(new Set(dates)).slice(0, 3).join(', ') : 'Not explicitly specified';

  // Extract lines
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const subjectLine = lines.find(l => l.toLowerCase().startsWith('subject:')) || '';
  const cleanSubject = subjectLine.replace(/subject\s*:\s*/i, '').trim();

  let summary = '';
  if (cleanSubject) {
    summary = `Applicant requests: ${cleanSubject}. Mentioned dates/timeline: ${dateStr}.`;
  } else {
    const preview = lines.find(l => l.length > 25 && !l.includes('Dear') && !l.includes('Respected')) || 'Student academic request';
    summary = `Student request regarding: ${preview.slice(0, 120)}...`;
  }

  return {
    summary,
    keyInfo: {
      main_request: cleanSubject || metadata.category || 'Official Academic Request',
      relevant_dates: dateStr,
      applicant_details: `${metadata.applicantName || 'Student'} (${metadata.rollNumber || 'Roll N/A'}, ${metadata.course || 'B.Tech'} ${metadata.department || ''})`,
      missing_information: dates.length === 0 ? 'Specific dates/duration not mentioned in body' : 'None detected'
    },
    source: 'rule-engine'
  };
}

function checkQualityWithRuleEngine(text, metadata) {
  const issues = [];
  let clarity = 'High';
  let tone = 'Respectful and formal';

  const lower = text.toLowerCase();

  // Check for greetings
  if (!lower.includes('respected') && !lower.includes('dear') && !lower.includes('महोदय') && !lower.includes('सादर')) {
    issues.push('Missing formal salutation (e.g., "Respected Sir/Madam")');
    clarity = 'Medium';
  }

  // Check for closing
  if (!lower.includes('thanking you') && !lower.includes('yours') && !lower.includes('सधन्यवाद') && !lower.includes('आज्ञाकारी')) {
    issues.push('Missing formal sign-off / closing block');
  }

  // Check for informal words
  const informal = ['hey', 'hi bro', 'wanna', 'gonna', 'urgent plz', 'do fast', 'asap'];
  for (const word of informal) {
    if (lower.includes(word)) {
      issues.push(`Informal language detected: "${word}"`);
      tone = 'Informal / Needs Professional Revision';
      clarity = 'Medium';
    }
  }

  // Check length
  if (text.trim().length < 80) {
    issues.push('Application is very brief. Provide more specific academic reasons and context.');
    clarity = 'Low';
  }

  return {
    clarity,
    tone,
    missing_info: issues.length > 0 ? issues.join('; ') : 'None',
    inconsistent_dates: 'None detected',
    issues,
    source: 'rule-engine'
  };
}

module.exports = {
  generateApplication,
  summarizeApplication,
  checkQuality,
  getRecipientTitle
};
