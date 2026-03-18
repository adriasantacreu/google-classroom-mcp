import { google } from 'googleapis';
import fs from 'fs';
import { Readable } from 'stream';

async function testEditAssignment() {
  const credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
  const token = JSON.parse(fs.readFileSync('./token.json', 'utf8'));
  
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);

  const classroom = google.classroom({ version: 'v1', auth: oAuth2Client });
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });
  const courseId = '720436012571'; // Curs de proves [Meus]
  const assignmentId = '856457192099'; // Tasca PROVA TEST

  console.log('🛠️ Iniciant test d\'edició avançada per a la tasca "PROVA TEST"...\n');

  try {
    // 1. Pujar un fitxer nou a Drive per adjuntar-lo després
    console.log('Step 1: Pujant PDF nou per a l\'edició...');
    const pdfContentBase64 = 'JVBERi0xLjQKJebkw7zUAn8KMSAwIG9iaiA8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PmVuZG9iaiAyIDAgb2JqIDw8L1R5cGUvUGFnZXMvS2lkc1szIDAgUl0vQ291bnQgMT4+ZW5kb2JqIDMgMCBvYmogPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNjEyIDc5Ml0vQ29udGVudHMgNCAwIFI+PmVuZG9iaiA0IDAgb2JqIDw8L0xlbmd0aCA0ND4+c3RyZWFtCkJULyYxIDEyIFRmIDEwMCA3MDAgVGQgKFRlc3QgUERGIGRlIGwnTUNQKSBUaiBFVAplbmRzdHJlYW0lZW5kb2JqIHhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDYwIDAwMDAwIG4gCjAwMDAwMDAxMTEgMDAwMDAgbiAKMDAwMDAwMDIwMiAwMDAwMCBuIAp0cmFpbGVyIDw8L1NpemUgNS9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjI5NQolJUVPRgo=';
    const buffer = Buffer.from(pdfContentBase64, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const driveFile = await drive.files.create({
      requestBody: { name: 'Annex_PROVA_TEST.pdf', mimeType: 'application/pdf' },
      media: { mimeType: 'application/pdf', body: stream }
    });
    const fileId = driveFile.data.id;
    console.log('✅ PDF pujat. ID: ' + fileId);

    // 2. Modificar la tasca (Patch)
    console.log('\nStep 2: Modificant títol, descripció i afegint materials...');
    
    // Per afegir materials a una tasca existent amb l'API, hem de passar el nou llistat de materials
    // que volem que tingui la tasca.
    const updatedAssignment = await classroom.courses.courseWork.patch({
      courseId,
      id: assignmentId,
      updateMask: 'title,description,materials', // Especifiquem què volem canviar
      requestBody: {
        title: 'PROVA TEST - MODIFICAT PER MCP',
        description: 'Aquesta tasca ha estat editada completament des del Super-MCP. Ara conté un PDF i un link de YouTube.',
        materials: [
          { driveFile: { driveFile: { id: fileId } } },
          { link: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Video Tutorial' } }
        ]
      }
    });

    console.log('✅ Tasca editada amb èxit!');
    console.log('Nou títol: ' + updatedAssignment.data.title);
    console.log('Nombre de materials: ' + updatedAssignment.data.materials.length);

    console.log('\n🚀 Totes les funcions d\'edició i addició de materials validades!');

  } catch (error) {
    console.error('\n❌ ERROR en l\'edició de la tasca:', error.message);
    if (error.response) console.error('Detalls:', JSON.stringify(error.response.data, null, 2));
  }
}

testEditAssignment();