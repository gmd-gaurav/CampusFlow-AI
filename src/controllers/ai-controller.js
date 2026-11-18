const aiService = require('../services/ai-service');

async function generate(req, res) {
  try {
    const {
      prompt,
      category,
      recipientRole,
      recipientName,
      isCollective,
      className,
      studentsCount,
      language,
      tone,
      action
    } = req.body;

    const user = req.user;

    const result = await aiService.generateApplication({
      prompt,
      category,
      recipientRole: recipientRole || 'coordinator',
      recipientName,
      applicantName: user.full_name,
      rollNumber: user.roll_number,
      department: user.department_name || '',
      course: user.course || 'B.Tech',
      semester: user.semester || 4,
      section: user.section || 'A',
      isCollective: isCollective === true || isCollective === 'true',
      className,
      studentsCount: parseInt(studentsCount, 10) || 1,
      language: language || 'en',
      tone: tone || 'formal',
      action: action || 'generate'
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('AI generate error:', error);
    return res.status(500).json({ success: false, error: 'AI generation failed.' });
  }
}

async function summarize(req, res) {
  try {
    const { text, category } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: 'Application text is required for summarization.' });
    }

    const user = req.user;
    const metadata = {
      applicantName: user.full_name,
      rollNumber: user.roll_number,
      department: user.department_name,
      course: user.course,
      semester: user.semester,
      section: user.section,
      category
    };

    const result = await aiService.summarizeApplication(text, metadata);
    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('AI summarize error:', error);
    return res.status(500).json({ success: false, error: 'AI summarization failed.' });
  }
}

async function checkQuality(req, res) {
  try {
    const { text, category } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: 'Application text is required for quality check.' });
    }

    const user = req.user;
    const metadata = {
      applicantName: user.full_name,
      rollNumber: user.roll_number,
      department: user.department_name,
      course: user.course,
      semester: user.semester,
      section: user.section,
      category
    };

    const result = await aiService.checkQuality(text, metadata);
    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('AI check quality error:', error);
    return res.status(500).json({ success: false, error: 'Quality check failed.' });
  }
}

module.exports = {
  generate,
  summarize,
  checkQuality
};
