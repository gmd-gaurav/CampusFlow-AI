const { get, query, run } = require('../database/db');
const applicationService = require('../services/application-service');
const aiService = require('../services/ai-service');

async function getReviewerStats(req, res) {
  try {
    const reviewer = req.user;
    const apps = applicationService.getApplicationsForReviewer(reviewer);

    const total = apps.length;
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    for (const a of apps) {
      if (a.status === 'pending_review' || a.status === 'submitted') {
        pending++;
      } else if (a.status === 'approved') {
        approved++;
      } else if (a.status === 'rejected') {
        rejected++;
      }
    }

    return res.json({
      success: true,
      stats: {
        total,
        pending,
        approved,
        rejected
      }
    });
  } catch (error) {
    console.error('Error fetching reviewer stats:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch review statistics.' });
  }
}

async function getIncomingApplications(req, res) {
  try {
    const reviewer = req.user;
    const { status, category, department, search } = req.query;

    const applications = applicationService.getApplicationsForReviewer(reviewer, {
      status,
      category,
      department,
      search
    });

    return res.json({
      success: true,
      applications
    });
  } catch (error) {
    console.error('Error fetching incoming applications:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch applications queue.' });
  }
}

async function submitReview(req, res) {
  try {
    const { applicationId } = req.params;
    const { decision, remarks } = req.body;
    const reviewer = req.user;

    if (!decision) {
      return res.status(400).json({ success: false, error: 'Decision (approved or rejected) is required.' });
    }

    const result = await applicationService.reviewApplication({
      applicationId,
      reviewer,
      decision,
      remarks
    });

    return res.json({
      success: true,
      message: `Application ${applicationId} has been ${decision} successfully.`,
      result
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
}

async function reSummarizeApplication(req, res) {
  try {
    const { applicationId } = req.params;
    const app = get('SELECT * FROM applications WHERE application_id = ?', [applicationId]);

    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    const meta = {
      category: app.category,
      course: app.course,
      semester: app.semester,
      section: app.section
    };

    const fullContent = `${app.subject}\n\n${app.body}`;
    const [summaryRes, qualityRes] = await Promise.all([
      aiService.summarizeApplication(fullContent, meta),
      aiService.checkQuality(fullContent, meta)
    ]);

    run(
      `UPDATE applications SET ai_summary = ?, ai_key_info = ?, ai_quality_check = ? WHERE id = ?`,
      [summaryRes.summary, JSON.stringify(summaryRes.keyInfo), JSON.stringify(qualityRes), app.id]
    );

    return res.json({
      success: true,
      message: 'AI summary and quality checks regenerated successfully.',
      summary: summaryRes.summary,
      keyInfo: summaryRes.keyInfo,
      qualityCheck: qualityRes
    });
  } catch (error) {
    console.error('Error re-summarizing application:', error);
    return res.status(500).json({ success: false, error: 'Failed to regenerate AI summary.' });
  }
}

module.exports = {
  getReviewerStats,
  getIncomingApplications,
  submitReview,
  reSummarizeApplication
};
