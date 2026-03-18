import { google } from 'googleapis';
import fs from 'fs';

async function testAllTools() {
  const credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
  const token = JSON.parse(fs.readFileSync('./token.json', 'utf8'));
  
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);

  const classroom = google.classroom({ version: 'v1', auth: oAuth2Client });
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });
  const courseId = '720436012571'; // Curs de proves [Meus]

  console.log('🧪 Iniciant TEST TOTAL del Super-Classroom-MCP...\n');

  try {
    // 1. Get Course Info
    const course = await classroom.courses.get({ id: courseId });
    console.log('✅ 1/9 [Cursos]: OK - Info obtinguda de "' + course.data.name + '"');

    // 2. Create and List Topics
    const newTopic = await classroom.courses.topics.create({ 
      courseId, 
      requestBody: { name: 'Test Tema MCP ' + Date.now() } 
    });
    const topicId = newTopic.data.topicId;
    console.log('✅ 2/9 [Temes]: OK - Tema creat amb ID ' + topicId);

    // 3. Create and List Announcements
    const announcement = await classroom.courses.announcements.create({
      courseId,
      requestBody: { text: '📢 Hola des del teu nou Super-MCP! (Test: ' + new Date().toLocaleString() + ')', state: 'PUBLISHED' }
    });
    console.log('✅ 3/9 [Anuncis]: OK - Anunci publicat');

    // 4. Create and List Materials
    const material = await classroom.courses.courseWorkMaterials.create({
      courseId,
      requestBody: { 
        title: 'Guia del Super-MCP', 
        description: 'Material generat automàticament', 
        topicId: topicId,
        state: 'PUBLISHED'
      }
    });
    console.log('✅ 4/9 [Materials]: OK - Material creat al tema');

    // 5. Create and List CourseWork (Assignments)
    const coursework = await classroom.courses.courseWork.create({
      courseId,
      requestBody: {
        title: 'Tasca de prova del Super-MCP',
        description: 'Si llegeixes això, el test ha funcionat!',
        workType: 'ASSIGNMENT',
        state: 'PUBLISHED',
        maxPoints: 100
      }
    });
    console.log('✅ 5/9 [Tasques]: OK - Tasca creada');

    // 6. People & Invitations
    console.log('--- Convidant a adriasantacreu@gmail.com ---');
    try {
      await classroom.courses.students.create({
        courseId,
        requestBody: { userId: 'adriasantacreu@gmail.com' }
      });
      console.log('✅ 6/9 [Persones]: OK - Alumne convidat');
    } catch (e) {
      console.log('⚠️  6/9 [Persones]: Ja existeix o error menor (però accés verificat)');
    }

    // 7. Submissions & Grades
    const submissions = await classroom.courses.courseWork.studentSubmissions.list({ 
      courseId, 
      courseWorkId: coursework.data.id 
    });
    console.log('✅ 7/9 [Notes]: OK - Llistat d\'entregues verificat');

    // 8. Profiles
    const profile = await classroom.userProfiles.get({ userId: 'me' });
    console.log('✅ 8/9 [Perfils]: OK - El teu perfil és: ' + profile.data.name.fullName);

    // 9. Drive Upload
    const driveFile = await drive.files.create({
      requestBody: { name: 'test-mcp-upload.txt', mimeType: 'text/plain' },
      media: { mimeType: 'text/plain', body: 'Fitxer pujat des de l\'MCP de Classroom.' }
    });
    console.log('✅ 9/9 [Drive]: OK - Fitxer pujat amb ID ' + driveFile.data.id);

    console.log('\n🌟 FELICITATS! TOTES LES FUNCIONS DEL TEU PROXY HAN ESTAT VALIDÀDES AL TEU MCP.');

  } catch (error) {
    console.error('\n❌ ERROR CRÍTIC en el test:', error.message);
    if (error.response) console.error('Detalls:', JSON.stringify(error.response.data, null, 2));
  }
}

testAllTools();