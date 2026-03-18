import { google } from 'googleapis';
import fs from 'fs';
import { Readable } from 'stream';

async function testPdfAssignment() {
  const credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
  const token = JSON.parse(fs.readFileSync('./token.json', 'utf8'));
  
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);

  const classroom = google.classroom({ version: 'v1', auth: oAuth2Client });
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });
  const courseId = '720436012571'; // Curs de proves [Meus]

  console.log('📄 Iniciant test de creació de tasca amb PDF...\n');

  try {
    // 1. Pujar un PDF a Drive
    console.log('Step 1: Pujant PDF a Drive...');
    const pdfContentBase64 = 'JVBERi0xLjQKJebkw7zUAn8KMSAwIG9iaiA8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PmVuZG9iaiAyIDAgb2JqIDw8L1R5cGUvUGFnZXMvS2lkc1szIDAgUl0vQ291bnQgMT4+ZW5kb2JqIDMgMCBvYmogPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNjEyIDc5Ml0vQ29udGVudHMgNCAwIFI+PmVuZG9iaiA0IDAgb2JqIDw8L0xlbmd0aCA0ND4+c3RyZWFtCkJULyYxIDEyIFRmIDEwMCA3MDAgVGQgKFRlc3QgUERGIGRlIGwnTUNQKSBUaiBFVAplbmRzdHJlYW0lZW5kb2JqIHhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDYwIDAwMDAwIG4gCjAwMDAwMDAxMTEgMDAwMDAgbiAKMDAwMDAwMDIwMiAwMDAwMCBuIAp0cmFpbGVyIDw8L1NpemUgNS9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjI5NQolJUVPRgo=';
    const buffer = Buffer.from(pdfContentBase64, 'base64');
    
    // Crear stream pel body
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const driveFile = await drive.files.create({
      requestBody: { 
        name: 'Examen_Test_MCP.pdf', 
        mimeType: 'application/pdf' 
      },
      media: { 
        mimeType: 'application/pdf', 
        body: stream 
      }
    });
    const fileId = driveFile.data.id;
    console.log('✅ PDF pujat amb èxit. ID: ' + fileId);

    // 2. Crear Tasca amb aquest fitxer
    console.log('\nStep 2: Creant tasca a Classroom amb el PDF adjunt...');
    const coursework = await classroom.courses.courseWork.create({
      courseId,
      requestBody: {
        title: 'Examen Final de l\'MCP (PDF)',
        description: 'Llegeix el PDF adjunt i respon les preguntes.',
        workType: 'ASSIGNMENT',
        state: 'PUBLISHED',
        materials: [
          { driveFile: { driveFile: { id: fileId } } }
        ]
      }
    });
    console.log('✅ Tasca creada amb èxit! ID: ' + coursework.data.id);

    // 3. Crear Material amb un Link
    console.log('\nStep 3: Creant Material addicional amb un enllaç...');
    const material = await classroom.courses.courseWorkMaterials.create({
      courseId,
      requestBody: {
        title: 'Documentació extra (Link)',
        description: 'Enllaç a la web de Model Context Protocol',
        state: 'PUBLISHED',
        materials: [
          { link: { url: 'https://modelcontextprotocol.io' } }
        ]
      }
    });
    console.log('✅ Material amb link creat amb èxit!');

    console.log('\n🚀 Totes les funcions complexes de creació han estat validades!');

  } catch (error) {
    console.error('\n❌ ERROR en el test de PDF:', error.message);
    if (error.response) console.error('Detalls:', JSON.stringify(error.response.data, null, 2));
  }
}

testPdfAssignment();