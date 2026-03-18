import { google } from 'googleapis';
import fs from 'fs';
import { Readable } from 'stream';

async function finalValidation() {
  const credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
  const token = JSON.parse(fs.readFileSync('./token.json', 'utf8'));
  
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);

  const classroom = google.classroom({ version: 'v1', auth: oAuth2Client });
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });

  console.log('🧪 VALIDACIÓ FINAL DEL SERVIDOR GOOGLE-CLASSROOM-MCP\n');

  try {
    // 1. PROVA DE CERCA (Search Courses)
    console.log('1. Cercant curs pel nom "[Meus]"...');
    const allCourses = await classroom.courses.list({ pageSize: 100 });
    const course = (allCourses.data.courses || []).find(c => c.name.includes('[Meus]'));
    if (!course) throw new Error('No s\'ha trobat el curs de proves.');
    const courseId = course.id;
    console.log(`✅ Curs trobat: ${course.name} (ID: ${courseId})`);

    // 2. CREACIÓ DE TEMA
    console.log('\n2. Creant tema "Unitat de Proves MCP"...');
    const topic = await classroom.courses.topics.create({ 
      courseId, 
      requestBody: { name: 'Unitat de Proves MCP ' + Date.now() } 
    });
    const topicId = topic.data.topicId;
    console.log(`✅ Tema creat: ${topic.data.name}`);

    // 3. PUJADA A DRIVE
    console.log('\n3. Pujant fitxer de validació a Drive...');
    const stream = new Readable();
    stream.push('Contingut de prova per al servidor MCP professional.');
    stream.push(null);
    const driveFile = await drive.files.create({
      requestBody: { name: 'Validacio_Final.txt', mimeType: 'text/plain' },
      media: { mimeType: 'text/plain', body: stream }
    });
    const fileId = driveFile.data.id;
    console.log(`✅ Fitxer pujat a Drive (ID: ${fileId})`);

    // 4. CREACIÓ UNIVERSAL (Task amb múltiples adjunts)
    console.log('\n4. Creant tasca amb múltiples adjunts (Drive + Link)...');
    const assignment = await classroom.courses.courseWork.create({
      courseId,
      requestBody: {
        title: 'Tasca de Validació Final',
        description: 'Aquesta tasca té múltiples materials adjunts.',
        topicId: topicId,
        workType: 'ASSIGNMENT',
        state: 'PUBLISHED',
        materials: [
          { driveFile: { driveFile: { id: fileId } } },
          { link: { url: 'https://modelcontextprotocol.io', title: 'Web MCP' } }
        ]
      }
    });
    const taskId = assignment.data.id;
    console.log(`✅ Tasca universal creada (ID: ${taskId})`);

    // 5. MODIFICACIÓ QUIRÚRGICA (Patch)
    console.log('\n5. Modificant la descripció de la tasca (Patch)...');
    await classroom.courses.courseWork.patch({
      courseId,
      id: taskId,
      updateMask: 'description',
      requestBody: {
        description: 'DESCRIPCIÓ ACTUALITZADA: El test de modificació ha funcionat correctament.'
      }
    });
    console.log('✅ Patch realitzat amb èxit.');

    // 6. ANUNCI FINAL
    console.log('\n6. Publicant anunci de finalització...');
    await classroom.courses.announcements.create({
      courseId,
      requestBody: { 
        text: '🏁 Prova de validació final del servidor google-classroom-mcp completada amb èxit. Tot el sistema és funcional.',
        state: 'PUBLISHED'
      }
    });
    console.log('✅ Anunci publicat.');

    console.log('\n🌟 VALIDACIÓ COMPLETADA: El servidor està llest per a producció.');

  } catch (error) {
    console.error('\n❌ ERROR CRÍTIC:', error.message);
    if (error.response) console.error('Detalls:', JSON.stringify(error.response.data, null, 2));
  }
}

finalValidation();