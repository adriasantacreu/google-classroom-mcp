import { google } from 'googleapis';
import fs from 'fs';
import { Readable } from 'stream';

async function runFullTestSuite() {
  const credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
  const token = JSON.parse(fs.readFileSync('./token.json', 'utf8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);

  const classroom = google.classroom({ version: 'v1', auth: oAuth2Client });
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });

  console.log('?? INICIANT FULL SUITE TEST...');

  try {
    const coursesResp = await classroom.courses.list({ pageSize: 100 });
    const course = (coursesResp.data.courses || []).find(c => c.name.includes('[Meus]'));
    if (!course) throw new Error('Course [Meus] not found');
    const courseId = course.id;
    console.log('? Discovery: OK (' + course.name + ')');

    const topic = await classroom.courses.topics.create({ courseId, requestBody: { name: 'Suite Test Topic ' + Date.now() } });
    const topicId = topic.data.topicId;
    console.log('? Topics: OK');

    const stream = new Readable(); stream.push('Test content'); stream.push(null);
    const driveFile = await drive.files.create({ requestBody: { name: 'Suite_Test.txt', mimeType: 'text/plain' }, media: { mimeType: 'text/plain', body: stream } });
    const fileId = driveFile.data.id;
    console.log('? Drive: OK');

    const assignment = await classroom.courses.courseWork.create({
      courseId,
      requestBody: {
        title: 'Suite Test Assignment',
        description: 'Initial description',
        workType: 'ASSIGNMENT',
        state: 'PUBLISHED',
        topicId: topicId,
        materials: [{ driveFile: { driveFile: { id: fileId } } }]
      }
    });
    const assId = assignment.data.id;
    console.log('? Assignment Creation: OK');

    await classroom.courses.courseWork.patch({
      courseId, id: assId, updateMask: 'title,description',
      requestBody: { title: 'Suite Test Assignment (PATCHED)', description: 'Updated description' }
    });
    console.log('? Assignment Patch: OK');

    const material = await classroom.courses.courseWorkMaterials.create({
      courseId,
      requestBody: { title: 'Suite Test Material', state: 'PUBLISHED', topicId: topicId }
    });
    console.log('? Materials: OK');

    const ann = await classroom.courses.announcements.create({ courseId, requestBody: { text: 'Suite Test Announcement', state: 'PUBLISHED' } });
    await classroom.courses.announcements.delete({ courseId, id: ann.data.id });
    console.log('? Announcements (Create/Delete): OK');

    const profile = await classroom.userProfiles.get({ userId: 'me' });
    console.log('? Profiles: OK (' + profile.data.name.fullName + ')');

    const subs = await classroom.courses.courseWork.studentSubmissions.list({ courseId, courseWorkId: assId });
    console.log('? Submissions List: OK');

    console.log('?? Cleanup...');
    await classroom.courses.courseWork.delete({ courseId, id: assId });
    console.log('? Cleanup: OK');

    console.log('? FULL TEST SUITE PASSED!');
  } catch (error) {
    console.error('? TEST FAILED:', error.message);
  }
}

runFullTestSuite();
