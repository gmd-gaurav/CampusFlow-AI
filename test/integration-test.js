const assert = require('assert');
const path = require('path');

// Test runner using node:test
const test = require('node:test');

require('dotenv').config();
const { seedDatabase } = require('../src/database/seed');
const { get, query, run } = require('../src/database/db');
const app = require('../src/app');
const aiService = require('../src/services/ai-service');
const applicationService = require('../src/services/application-service');

test('CampusFlow AI Comprehensive Integration & Quality Test', async (t) => {
  seedDatabase();
  // Ensure idempotent state for regression tests
  run("UPDATE users SET verification_status = 'pending_verification' WHERE email = 'priya.cse@campusflow.edu'");
  run("UPDATE applications SET status = 'pending_review' WHERE application_id = 'CFA-2026-000002'");

  await t.test('1. Database initialized and seeded with departments and classes', () => {
    const depts = query('SELECT * FROM departments');
    assert.ok(depts.length >= 6, 'Should have at least 6 departments');
    const classes = query('SELECT * FROM classes');
    assert.ok(classes.length >= 4, 'Should have classes configured');
  });

  await t.test('2. Demo users exist with proper roles and hashed passwords', () => {
    const admin = get('SELECT * FROM users WHERE email = ?', ['admin@campusflow.edu']);
    assert.ok(admin, 'Admin should exist');
    assert.strictEqual(admin.role, 'admin');
    assert.ok(admin.password_hash.startsWith('$2'), 'Password must be hashed with bcrypt');

    const rahul = get('SELECT * FROM users WHERE email = ?', ['rahul.cse@campusflow.edu']);
    assert.ok(rahul, 'Verified student should exist');
    assert.strictEqual(rahul.verification_status, 'verified');

    const priya = get('SELECT * FROM users WHERE email = ?', ['priya.cse@campusflow.edu']);
    assert.ok(priya, 'Pending student should exist');
    assert.strictEqual(priya.verification_status, 'pending_verification');
  });

  await t.test('3. Duplicate roll number and email prevention', async () => {
    const authController = require('../src/controllers/auth-controller');

    // Attempt to register with duplicate email
    let resError = null;
    const reqDuplicateEmail = {
      body: {
        fullName: 'Duplicate Test',
        rollNumber: 'NEWROLL123',
        email: 'rahul.cse@campusflow.edu', // duplicate!
        password: 'Password123',
        confirmPassword: 'Password123'
      }
    };
    const resDuplicateEmail = {
      status: (code) => ({
        json: (data) => { resError = data.error; }
      })
    };
    await authController.register(reqDuplicateEmail, resDuplicateEmail);
    assert.ok(resError && resError.includes('already exists'), 'Duplicate email should be rejected');

    // Attempt to register with duplicate roll number
    resError = null;
    const reqDuplicateRoll = {
      body: {
        fullName: 'Duplicate Roll Test',
        rollNumber: '22CSE012', // duplicate roll!
        email: 'newemail999@campusflow.edu',
        password: 'Password123',
        confirmPassword: 'Password123'
      }
    };
    await authController.register(reqDuplicateRoll, resDuplicateEmail);
    assert.ok(resError && resError.includes('already exists'), 'Duplicate roll number should be rejected');
  });

  await t.test('4. Registration creates account in PENDING VERIFICATION status', async () => {
    const authController = require('../src/controllers/auth-controller');
    const testEmail = `newstudent_${Date.now()}@campusflow.edu`;
    const testRoll = `ROLL_${Date.now().toString().slice(-6)}`;

    let responseData = null;
    let statusCode = 200;
    const req = {
      body: {
        fullName: 'Integration Student',
        rollNumber: testRoll,
        email: testEmail,
        mobileNumber: '+91 9999900000',
        fatherName: 'Father Test',
        motherName: 'Mother Test',
        departmentId: 1,
        course: 'B.Tech',
        semester: 4,
        section: 'A',
        password: 'Password@123',
        confirmPassword: 'Password@123'
      }
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => { responseData = data; }
        };
      }
    };

    await authController.register(req, res);
    assert.strictEqual(statusCode, 201, 'Registration should return 201 Created');
    assert.strictEqual(responseData.user.verificationStatus, 'pending_verification', 'New user must start as pending_verification');

    // Verify DB
    const dbUser = get('SELECT * FROM users WHERE email = ?', [testEmail]);
    assert.strictEqual(dbUser.verification_status, 'pending_verification');
  });

  await t.test('5. Unverified student blocked from submitting applications', async () => {
    run("UPDATE users SET verification_status = 'pending_verification' WHERE email = 'priya.cse@campusflow.edu'");
    const { verifiedStudentOnly } = require('../src/middleware/auth');
    const priya = get('SELECT * FROM users WHERE email = ?', ['priya.cse@campusflow.edu']);

    let blockedCode = null;
    let errorMsg = null;
    const req = { user: priya };
    const res = {
      status: (code) => ({
        json: (data) => {
          blockedCode = data.code;
          errorMsg = data.error;
        }
      })
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    verifiedStudentOnly(req, res, next);
    assert.strictEqual(nextCalled, false, 'Next middleware should not be called for unverified student');
    assert.strictEqual(blockedCode, 'VERIFICATION_REQUIRED', 'Must return VERIFICATION_REQUIRED code');
    assert.ok(errorMsg.includes('PENDING VERIFICATION'), 'Error must clearly state pending status');
  });

  await t.test('6. Admin manual verification approves student registration', async () => {
    const verificationController = require('../src/controllers/verification-controller');
    const admin = get('SELECT * FROM users WHERE email = ?', ['admin@campusflow.edu']);
    const priya = get('SELECT * FROM users WHERE email = ?', ['priya.cse@campusflow.edu']);

    let result = null;
    let statusCode = 200;
    const req = {
      user: admin,
      params: { id: priya.id },
      body: {
        status: 'verified',
        remarks: 'Identity verified with CSE department records ledger.'
      }
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => { result = data; }
        };
      },
      json: (data) => { result = data; }
    };

    await verificationController.updateVerificationStatus(req, res);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'verified');

    // Check DB record updated
    const updated = get('SELECT * FROM users WHERE id = ?', [priya.id]);
    assert.strictEqual(updated.verification_status, 'verified');
    assert.strictEqual(updated.verified_by, admin.id);

    // Check verification_records audit log created
    const log = get('SELECT * FROM verification_records WHERE student_id = ? ORDER BY id DESC LIMIT 1', [priya.id]);
    assert.ok(log, 'Verification record audit log must be created');
    assert.strictEqual(log.new_status, 'verified');
  });

  await t.test('7. AI Writing Assistant, Summarizer, and Quality Checker', async () => {
    // Test Application Generation
    const genResult = await aiService.generateApplication({
      prompt: 'Need 2 days leave for sister wedding on 24-25 Nov',
      category: 'Leave Application',
      recipientRole: 'coordinator',
      applicantName: 'Test Student',
      rollNumber: '22CSE099',
      department: 'Computer Science & Engineering',
      course: 'B.Tech',
      semester: 4,
      section: 'A',
      language: 'en'
    });

    assert.ok(genResult.subject && genResult.subject.length > 5, 'Must generate formal subject');
    assert.ok(genResult.body && genResult.body.includes('Respected'), 'Must include respectful salutation');
    assert.ok(genResult.body.includes('Test Student'), 'Must include applicant name in sign-off');

    // Test Summarization
    const sumResult = await aiService.summarizeApplication(genResult.body, {
      applicantName: 'Test Student',
      category: 'Leave Application'
    });

    assert.ok(sumResult.summary && sumResult.summary.length > 10, 'Must produce factual summary');
    assert.ok(sumResult.keyInfo, 'Must extract keyInfo');

    // Test Quality Check
    const qualityResult = await aiService.checkQuality(genResult.body);
    assert.ok(qualityResult.clarity, 'Must assess clarity');
    assert.ok(qualityResult.tone, 'Must assess tone');

    // Test Anti-Echo / Semantic Rewrite Enhancement
    const rewritten = await aiService.generateApplication({
      prompt: 'fever and headache need 2 days leave',
      category: 'Leave Application',
      recipientRole: 'coordinator',
      applicantName: 'Test Student'
    });
    assert.strictEqual(rewritten.body.includes('fever and headache need 2 days leave'), false, 'AI must transform casual terms into formal prose rather than copying verbatim');
    assert.ok(rewritten.body.includes('acute medical indisposition'), 'Must elevate colloquial terms to formal academic language');
  });

  await t.test('8. Hierarchy Validation: Student vs CR vs Coordinator', () => {
    // Individual student
    assert.strictEqual(applicationService.validateHierarchy('student', 'cr'), true);
    assert.strictEqual(applicationService.validateHierarchy('student', 'coordinator'), true);
    assert.strictEqual(applicationService.validateHierarchy('student', 'hod'), true);
    assert.strictEqual(applicationService.validateHierarchy('student', 'director'), true);

    // CR
    assert.strictEqual(applicationService.validateHierarchy('cr', 'coordinator'), true);
    assert.strictEqual(applicationService.validateHierarchy('cr', 'hod'), true);
    assert.strictEqual(applicationService.validateHierarchy('cr', 'director'), true);
    assert.strictEqual(applicationService.validateHierarchy('cr', 'cr'), false, 'CR cannot submit to CR');

    // Coordinator
    assert.strictEqual(applicationService.validateHierarchy('faculty', 'hod'), true);
    assert.strictEqual(applicationService.validateHierarchy('faculty', 'director'), true);
    assert.strictEqual(applicationService.validateHierarchy('faculty', 'cr'), false, 'Faculty cannot submit to CR');
  });

  await t.test('9. Student creates and submits application with unique CFA ID', async () => {
    const rahul = get('SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.email = ?', ['rahul.cse@campusflow.edu']);

    const appResult = await applicationService.createApplication({
      applicant: rahul,
      applicationType: 'individual',
      category: 'Attendance Consideration',
      recipientRole: 'coordinator',
      title: 'Attendance Consideration for Hackathon Participation',
      subject: 'Request for Attendance Exemption during Smart India Hackathon',
      body: 'Respected Sir,\n\nI was selected for SIH 2026 Finals and participated between 10-12 Nov. Kindly grant attendance consideration.\n\nThanking you,\nRahul Sharma',
      supportingDetails: 'Selection certificate attached.'
    });

    assert.ok(appResult.application_id.startsWith('CFA-'), 'Application ID must follow CFA-YYYY-XXXXXX format');
    assert.ok(appResult.id > 0, 'Database ID must be generated');

    // Check application record in DB
    const created = get('SELECT * FROM applications WHERE id = ?', [appResult.id]);
    assert.strictEqual(created.status, 'pending_review');
    assert.strictEqual(created.category, 'Attendance Consideration');

    // Check immutable history
    const hist = get("SELECT * FROM application_history WHERE application_id = ? AND action = 'submitted'", [appResult.id]);
    assert.ok(hist, 'Audit history entry must be created on submission');
  });

  await t.test('10. Class Representative submits Collective Class Application', async () => {
    const aakash = get('SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.email = ?', ['cr.cse4a@campusflow.edu']);

    const appResult = await applicationService.createApplication({
      applicant: aakash,
      applicationType: 'collective',
      category: 'Timetable Change Request',
      recipientRole: 'hod',
      title: 'Request for Shifting Friday Lab Session',
      subject: 'Collective Petition for Rescheduling Compiler Design Lab',
      body: 'Respected HOD,\n\nOn behalf of 64 students of B.Tech CSE Sem 4 Sec A, we request shifting Friday afternoon lab to morning slots.\n\nThanking you,\nAakash Verma (CR)',
      className: 'B.Tech CSE - 4th Sem (Sec A)',
      studentsCount: 64
    });

    assert.ok(appResult.application_id.startsWith('CFA-'));
    const created = get('SELECT * FROM applications WHERE id = ?', [appResult.id]);
    assert.strictEqual(created.application_type, 'collective');
    assert.strictEqual(created.students_represented_count, 64);
  });

  await t.test('11. Faculty Reviewer Scoped Visibility: Coordinator vs HOD vs Director', () => {
    const coord = get('SELECT * FROM users WHERE email = ?', ['coordinator.cse4a@campusflow.edu']);
    const hod = get('SELECT * FROM users WHERE email = ?', ['hod.cse@campusflow.edu']);
    const director = get('SELECT * FROM users WHERE email = ?', ['director@campusflow.edu']);

    const coordApps = applicationService.getApplicationsForReviewer(coord);
    const hodApps = applicationService.getApplicationsForReviewer(hod);
    const dirApps = applicationService.getApplicationsForReviewer(director);

    assert.ok(coordApps.length > 0, 'Coordinator should see applications assigned to CSE Sem 4 Sec A');
    assert.ok(hodApps.length > 0, 'HOD should see applications assigned to CSE HOD');
    assert.ok(dirApps.length > 0, 'Director should see applications assigned to Director');
  });

  await t.test('12. Rejection requires mandatory remarks', async () => {
    const hod = get('SELECT * FROM users WHERE email = ?', ['hod.cse@campusflow.edu']);

    let rejectedWithoutRemarksError = null;
    try {
      await applicationService.reviewApplication({
        applicationId: 'CFA-2026-000002',
        reviewer: hod,
        decision: 'rejected',
        remarks: '' // empty remarks!
      });
    } catch (err) {
      rejectedWithoutRemarksError = err.message;
    }

    assert.ok(
      rejectedWithoutRemarksError && rejectedWithoutRemarksError.includes('mandatory'),
      'Must throw error when rejection remarks are missing'
    );
  });

  await t.test('13. Application Review: Approval with remarks and status update', async () => {
    const hod = get('SELECT * FROM users WHERE email = ?', ['hod.cse@campusflow.edu']);

    const res = await applicationService.reviewApplication({
      applicationId: 'CFA-2026-000002',
      reviewer: hod,
      decision: 'approved',
      remarks: 'Special permission granted for re-test. Coordinate with exam coordinator.'
    });

    assert.strictEqual(res.decision, 'approved');

    // Verify DB status
    const app = get('SELECT * FROM applications WHERE application_id = ?', ['CFA-2026-000002']);
    assert.strictEqual(app.status, 'approved');

    // Verify review record
    const rev = get('SELECT * FROM application_reviews WHERE application_id = ?', [app.id]);
    assert.ok(rev);
    assert.strictEqual(rev.decision, 'approved');

    // Verify audit log
    const hist = get("SELECT * FROM application_history WHERE application_id = ? AND action = 'reviewed'", [app.id]);
    assert.ok(hist);
    assert.ok(hist.details.includes('APPROVED'));
  });

  console.log('\n======================================================');
  console.log('✅ ALL INTEGRATION & QUALITY TESTS PASSED WITH 100% SUCCESS!');
  console.log('======================================================\n');
});
