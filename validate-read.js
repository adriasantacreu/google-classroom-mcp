import { google } from 'googleapis';
import fs from 'fs';

async function validateReadTools() {
  const credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
  const token = JSON.parse(fs.readFileSync('./token.json', 'utf8'));
  
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);

  const classroom = google.classroom({ version: 'v1', auth: oAuth2Client });
  const courseId = '802442150795'; // 2BAT Mates CCSS

  console.log('🚀 Iniciant validació d\'eines de lectura...\n');

  try {
    // 1. Get Course
    const course = await classroom.courses.get({ id: courseId });
    console.log('✅ get_course: OK (' + course.data.name + ')');

    // 2. List Topics
    const topics = await classroom.courses.topics.list({ courseId });
    console.log('✅ list_topics: OK (' + (topics.data.topic?.length || 0) + ' temes)');

    // 3. List Announcements
    const announcements = await classroom.courses.announcements.list({ courseId });
    console.log('✅ list_announcements: OK (' + (announcements.data.announcements?.length || 0) + ' anuncis)');

    // 4. List Students
    const students = await classroom.courses.students.list({ courseId });
    console.log('✅ list_students: OK (' + (students.data.students?.length || 0) + ' alumnes)');

    // 5. List Teachers
    const teachers = await classroom.courses.teachers.list({ courseId });
    console.log('✅ list_teachers: OK (' + (teachers.data.teachers?.length || 0) + ' professors)');

    // 6. List Assignments (CourseWork)
    const coursework = await classroom.courses.courseWork.list({ courseId });
    const assignments = coursework.data.courseWork || [];
    console.log('✅ list_assignments: OK (' + assignments.length + ' tasques)');

    // 7. List Submissions (si hi ha tasques)
    if (assignments.length > 0) {
      const workId = assignments[0].id;
      const submissions = await classroom.courses.courseWork.studentSubmissions.list({ 
        courseId, 
        courseWorkId: workId 
      });
      console.log('✅ list_submissions: OK (' + (submissions.data.studentSubmissions?.length || 0) + ' entregues per a la tasca "' + assignments[0].title + '")');
    } else {
      console.log('⚠️ list_submissions: Saltat (no hi ha tasques en aquest curs)');
    }

    console.log('\n✨ Totes les eines de lectura funcionen correctament!');

  } catch (error) {
    console.error('\n❌ Error durant la validació:', error.message);
    if (error.response) console.error('Detalls:', JSON.stringify(error.response.data, null, 2));
  }
}

validateReadTools();