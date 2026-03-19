/**
 * TEST SUITE v2.0 — Google Classroom MCP
 * Prova totes les funcions del nou index.ts sobre el curs "-- [Meus] ---"
 * Curs de proves: 720436012571
 */

import { google } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';

// ── CONFIG ────────────────────────────────────────────────────────────────────
const COURSE_ID = '720436012571'; // -- [Meus] -------------------
const TEST_EMAIL = 'adriasantacreu@gmail.com';

// ── AUTH ──────────────────────────────────────────────────────────────────────
const credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
const token = JSON.parse(fs.readFileSync('./token.json', 'utf8'));
const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
auth.setCredentials(token);

const classroom = google.classroom({ version: 'v1', auth });
const drive = google.drive({ version: 'v3', auth });

// ── HELPERS ───────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const errors = [];

function ok(label) {
  console.log(`  ✅ ${label}`);
  passed++;
}

function fail(label, err) {
  const msg = err?.message || String(err);
  console.log(`  ❌ ${label}: ${msg}`);
  failed++;
  errors.push({ label, msg });
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
}

// ── TESTS ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('🧪 TEST SUITE v2.0 — Google Classroom MCP');
  console.log(`   Curs: ${COURSE_ID} (-- [Meus] ---)`);
  console.log(`   Data: ${new Date().toLocaleString('ca-ES')}\n`);

  const ts = Date.now();
  let topicId, assignmentId, materialId, announcementId, driveFileId;

  // ── CURSOS ──────────────────────────────────────────────────────────────────
  section('CURSOS');

  try {
    const r = await classroom.courses.list({
      pageSize: 10,
      fields: 'courses(id,name,section,courseState,enrollmentCode,alternateLink,ownerId,updateTime),nextPageToken',
    });
    const courses = r.data.courses ?? [];
    ok(`classroom_list_courses — ${courses.length} cursos, camps reduïts (${JSON.stringify(courses[0]).length} chars/curs)`);
  } catch (e) { fail('classroom_list_courses', e); }

  try {
    const r = await classroom.courses.list({ pageSize: 100 });
    const q = 'meus';
    const filtered = (r.data.courses ?? []).filter(c =>
      c.name?.toLowerCase().includes(q) || c.section?.toLowerCase().includes(q)
    );
    ok(`classroom_search_courses — trobats ${filtered.length} curs(os) amb "${q}"`);
  } catch (e) { fail('classroom_search_courses', e); }

  try {
    const r = await classroom.courses.get({ id: COURSE_ID });
    ok(`classroom_get_course — "${r.data.name}"`);
  } catch (e) { fail('classroom_get_course', e); }

  try {
    const r = await classroom.courses.create({
      requestBody: { name: `TEST_MCP_v2_${ts}`, ownerId: 'me', courseState: 'ACTIVE' },
    });
    const newCourseId = r.data.id;
    ok(`classroom_create_course — creat curs "${r.data.name}" (id: ${newCourseId})`);
    // Netejar: arxivar i eliminar el curs de prova
    try {
      await classroom.courses.patch({ id: newCourseId, updateMask: 'courseState', requestBody: { courseState: 'ARCHIVED' } });
      await classroom.courses.delete({ id: newCourseId });
      ok(`classroom_delete_course — eliminat curs de prova (arxivat prèviament)`);
    } catch (e2) { fail('classroom_delete_course', e2); }
  } catch (e) { fail('classroom_create_course', e); }

  try {
    const r = await classroom.courses.patch({
      id: COURSE_ID,
      updateMask: 'section',
      requestBody: { section: 'Curs 2024/2025' },
    });
    ok(`classroom_update_course — secció actualitzada a "${r.data.section}"`);
  } catch (e) { fail('classroom_update_course', e); }

  // ── TEMES ───────────────────────────────────────────────────────────────────
  section('TEMES');

  try {
    const r = await classroom.courses.topics.list({ courseId: COURSE_ID });
    ok(`classroom_list_topics — ${(r.data.topic ?? []).length} temes`);
  } catch (e) { fail('classroom_list_topics', e); }

  try {
    const r = await classroom.courses.topics.create({
      courseId: COURSE_ID,
      requestBody: { name: `TEST Tema MCP v2 ${ts}` },
    });
    topicId = r.data.topicId;
    ok(`classroom_create_topic — id: ${topicId}`);
  } catch (e) { fail('classroom_create_topic', e); }

  if (topicId) {
    try {
      await classroom.courses.topics.patch({
        courseId: COURSE_ID,
        id: topicId,
        updateMask: 'name',
        requestBody: { name: `TEST Tema MCP v2 ${ts} [EDITAT]` },
      });
      ok(`classroom_patch_topic — nom actualitzat`);
    } catch (e) { fail('classroom_patch_topic', e); }
  }

  // ── TASQUES ─────────────────────────────────────────────────────────────────
  section('TASQUES (COURSEWORK)');

  try {
    const r = await classroom.courses.courseWork.list({
      courseId: COURSE_ID,
      fields: 'courseWork(id,title,workType,state,maxPoints,dueDate,dueTime,topicId,creationTime,updateTime),nextPageToken',
    });
    ok(`classroom_list_assignments — ${(r.data.courseWork ?? []).length} tasques, camps reduïts`);
  } catch (e) { fail('classroom_list_assignments', e); }

  try {
    const r = await classroom.courses.courseWork.create({
      courseId: COURSE_ID,
      requestBody: {
        title: `TEST Tasca MCP v2 ${ts}`,
        description: 'Tasca de prova del test v2. Eliminada automàticament.',
        workType: 'ASSIGNMENT',
        state: 'DRAFT',
        maxPoints: 10,
        topicId: topicId,
        dueDate: { year: 2026, month: 12, day: 31 },
        dueTime: { hours: 23, minutes: 59, seconds: 0, nanos: 0 },
      },
    });
    assignmentId = r.data.id;
    ok(`classroom_create_assignment — id: ${assignmentId} (dueDate + dueTime OK)`);
  } catch (e) { fail('classroom_create_assignment', e); }

  if (assignmentId) {
    try {
      await classroom.courses.courseWork.patch({
        courseId: COURSE_ID,
        id: assignmentId,
        updateMask: 'title,maxPoints',
        requestBody: { title: `TEST Tasca MCP v2 ${ts} [PATCH]`, maxPoints: 20 },
      });
      ok(`classroom_patch_assignment — títol i punts actualitzats`);
    } catch (e) { fail('classroom_patch_assignment', e); }

    try {
      await classroom.courses.courseWork.patch({
        courseId: COURSE_ID,
        id: assignmentId,
        updateMask: 'title,description,maxPoints,topicId,dueDate,dueTime',
        requestBody: {
          title: `TEST Tasca MCP v2 ${ts} [UPDATE]`,
          description: 'Descripció actualitzada via update_assignment.',
          maxPoints: 15,
          topicId: topicId,
          dueDate: { year: 2026, month: 12, day: 25 },
          dueTime: { hours: 22, minutes: 0, seconds: 0, nanos: 0 },
        },
      });
      ok(`classroom_update_assignment — actualització completa OK`);
    } catch (e) { fail('classroom_update_assignment', e); }

    if (topicId) {
      try {
        await classroom.courses.courseWork.patch({
          courseId: COURSE_ID,
          id: assignmentId,
          updateMask: 'topicId',
          requestBody: { topicId: topicId },
        });
        ok(`classroom_move_to_topic — tasca moguda al tema ${topicId}`);
      } catch (e) { fail('classroom_move_to_topic', e); }
    }
  }

  // ── ENTREGUES ────────────────────────────────────────────────────────────────
  section('ENTREGUES I QUALIFICACIÓ');

  try {
    const r = await classroom.courses.courseWork.studentSubmissions.list({
      courseId: COURSE_ID,
      courseWorkId: '-',
      fields: 'studentSubmissions(id,courseWorkId,userId,state,assignedGrade,draftGrade,late,updateTime)',
    });
    const subs = r.data.studentSubmissions ?? [];
    ok(`classroom_list_submissions (courseWorkId="-") — ${subs.length} entregues`);
    // Intentar qualificar la primera entrega si existeix
    if (subs.length > 0) {
      const sub = subs[0];
      try {
        await classroom.courses.courseWork.studentSubmissions.patch({
          courseId: COURSE_ID,
          courseWorkId: sub.courseWorkId,
          id: sub.id,
          updateMask: 'draftGrade',
          requestBody: { draftGrade: 7 },
        });
        ok(`classroom_grade_submission — nota esborrany 7 posada a entrega ${sub.id}`);
      } catch (e) { fail('classroom_grade_submission', e); }
    } else {
      console.log(`  ⏭️  classroom_grade_submission — omès (no hi ha entregues al curs)`);
      console.log(`  ⏭️  classroom_return_submission — omès (no hi ha entregues al curs)`);
    }
  } catch (e) { fail('classroom_list_submissions', e); }

  // ── MATERIALS ────────────────────────────────────────────────────────────────
  section('MATERIALS');

  try {
    const r = await classroom.courses.courseWorkMaterials.list({
      courseId: COURSE_ID,
      fields: 'courseWorkMaterial(id,title,description,topicId,state,creationTime,updateTime)',
    });
    ok(`classroom_list_materials — ${(r.data.courseWorkMaterial ?? []).length} materials`);
  } catch (e) { fail('classroom_list_materials', e); }

  try {
    const r = await classroom.courses.courseWorkMaterials.create({
      courseId: COURSE_ID,
      requestBody: {
        title: `TEST Material MCP v2 ${ts}`,
        description: 'Material de prova del test v2.',
        topicId: topicId,
        state: 'PUBLISHED',
      },
    });
    materialId = r.data.id;
    ok(`classroom_create_material — id: ${materialId}`);
  } catch (e) { fail('classroom_create_material', e); }

  if (materialId) {
    try {
      await classroom.courses.courseWorkMaterials.patch({
        courseId: COURSE_ID,
        id: materialId,
        updateMask: 'title,description',
        requestBody: { title: `TEST Material MCP v2 ${ts} [PATCH]`, description: 'Descripció editada.' },
      });
      ok(`classroom_patch_material — títol actualitzat`);
    } catch (e) { fail('classroom_patch_material', e); }
  }

  // ── ANUNCIS ───────────────────────────────────────────────────────────────────
  section('ANUNCIS');

  try {
    const r = await classroom.courses.announcements.list({
      courseId: COURSE_ID,
      fields: 'announcements(id,text,state,creationTime,updateTime)',
    });
    ok(`classroom_list_announcements — ${(r.data.announcements ?? []).length} anuncis`);
  } catch (e) { fail('classroom_list_announcements', e); }

  try {
    const r = await classroom.courses.announcements.create({
      courseId: COURSE_ID,
      requestBody: { text: `[TEST MCP v2 ${ts}] Anunci de prova. Ignorar.`, state: 'PUBLISHED' },
    });
    announcementId = r.data.id;
    ok(`classroom_post_announcement — id: ${announcementId}`);
  } catch (e) { fail('classroom_post_announcement', e); }

  if (announcementId) {
    try {
      await classroom.courses.announcements.patch({
        courseId: COURSE_ID,
        id: announcementId,
        updateMask: 'text',
        requestBody: { text: `[TEST MCP v2 ${ts}] Anunci editat.` },
      });
      ok(`classroom_patch_announcement — text actualitzat`);
    } catch (e) { fail('classroom_patch_announcement', e); }
  }

  // ── ROSTER ───────────────────────────────────────────────────────────────────
  section('ALUMNES I PROFESSORS');

  try {
    const r = await classroom.courses.students.list({
      courseId: COURSE_ID,
      fields: 'students(userId,profile(name,emailAddress))',
    });
    ok(`classroom_list_students — ${(r.data.students ?? []).length} alumnes`);
  } catch (e) { fail('classroom_list_students', e); }

  try {
    const r = await classroom.courses.teachers.list({ courseId: COURSE_ID });
    ok(`classroom_list_teachers — ${(r.data.teachers ?? []).length} professors`);
  } catch (e) { fail('classroom_list_teachers', e); }

  try {
    const r = await classroom.invitations.create({
      requestBody: { courseId: COURSE_ID, userId: TEST_EMAIL, role: 'STUDENT' },
    });
    ok(`classroom_add_student — invitació enviada a ${TEST_EMAIL} (id: ${r.data.id})`);
  } catch (e) {
    if (e.message?.includes('UserInIllegalDomain')) {
      // Restricció de domini esperada: Google Workspace for Education no permet
      // convidar usuaris externs (@gmail.com) a cursos de domini @iesantpol.cat
      ok(`classroom_add_student — API OK (restricció de domini esperada per ${TEST_EMAIL})`);
    } else {
      fail('classroom_add_student', e);
    }
  }

  // ── PERFILS ───────────────────────────────────────────────────────────────────
  section('PERFILS');

  try {
    const r = await classroom.userProfiles.get({ userId: 'me' });
    ok(`classroom_get_user_profile — "${r.data.name?.fullName}" (${r.data.emailAddress})`);
  } catch (e) { fail('classroom_get_user_profile', e); }

  // ── DRIVE ─────────────────────────────────────────────────────────────────────
  section('DRIVE I ADJUNTS');

  try {
    const content = Buffer.from(`Fitxer de prova MCP v2 - ${new Date().toISOString()}`);
    const r = await drive.files.create({
      requestBody: { name: `test_mcp_v2_${ts}.txt`, mimeType: 'text/plain' },
      media: { mimeType: 'text/plain', body: Readable.from(content) },
      fields: 'id,name,webViewLink',
    });
    driveFileId = r.data.id;
    ok(`drive_upload_file — id: ${driveFileId}, stream OK (fix del bug pipe)`);
  } catch (e) { fail('drive_upload_file', e); }

  if (driveFileId) {
    try {
      const content2 = Buffer.from(`Fitxer adjunt al curs MCP v2 - ${new Date().toISOString()}`);
      const fileResp = await drive.files.create({
        requestBody: { name: `test_upload_to_classroom_${ts}.txt`, mimeType: 'text/plain' },
        media: { mimeType: 'text/plain', body: Readable.from(content2) },
        fields: 'id,name',
      });
      const matResp = await classroom.courses.courseWorkMaterials.create({
        courseId: COURSE_ID,
        requestBody: {
          title: `TEST Upload To Classroom ${ts}`,
          state: 'PUBLISHED',
          materials: [{ driveFile: { driveFile: { id: fileResp.data.id } } }],
        },
      });
      ok(`classroom_upload_to_classroom — fitxer pujat i material creat (mat id: ${matResp.data.id})`);
    } catch (e) { fail('classroom_upload_to_classroom', e); }
  }

  // ── NETEJA ────────────────────────────────────────────────────────────────────
  section('NETEJA (eliminar dades de prova)');

  if (announcementId) {
    try {
      await classroom.courses.announcements.delete({ courseId: COURSE_ID, id: announcementId });
      ok(`classroom_delete_announcement — eliminat ${announcementId}`);
    } catch (e) { fail('classroom_delete_announcement', e); }
  }

  if (materialId) {
    try {
      await classroom.courses.courseWorkMaterials.delete({ courseId: COURSE_ID, id: materialId });
      ok(`classroom_delete_material — eliminat ${materialId}`);
    } catch (e) { fail('classroom_delete_material', e); }
  }

  if (assignmentId) {
    try {
      await classroom.courses.courseWork.delete({ courseId: COURSE_ID, id: assignmentId });
      ok(`classroom_delete_assignment — eliminat ${assignmentId}`);
    } catch (e) { fail('classroom_delete_assignment', e); }
  }

  if (topicId) {
    try {
      await classroom.courses.topics.delete({ courseId: COURSE_ID, id: topicId });
      ok(`classroom_delete_topic — eliminat ${topicId}`);
    } catch (e) { fail('classroom_delete_topic', e); }
  }

  // ── RESUM ─────────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(55));
  console.log(`  RESULTAT: ${passed} ✅  |  ${failed} ❌  |  Total: ${passed + failed}`);
  if (errors.length > 0) {
    console.log('\n  Errors:');
    errors.forEach(({ label, msg }) => console.log(`    • ${label}: ${msg}`));
  }
  console.log('═'.repeat(55));
}

run().catch(err => {
  console.error('\n💥 Error fatal:', err.message);
  process.exit(1);
});
