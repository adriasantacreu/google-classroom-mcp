import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

async function testConnection() {
  const credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
  const token = JSON.parse(fs.readFileSync('./token.json', 'utf8'));
  
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);

  const classroom = google.classroom({ version: 'v1', auth: oAuth2Client });
  
  try {
    const response = await classroom.courses.list({ pageSize: 10 });
    const courses = response.data.courses || [];
    
    console.log('--- LLISTAT DE CURSOS ---');
    if (courses.length === 0) {
      console.log('No s\'han trobat cursos.');
    } else {
      courses.forEach(course => {
        console.log(`- [${course.id}] ${course.name} (${course.section || 'Sense secció'})`);
      });
    }
    console.log('-------------------------');
    console.log('Connexió OK!');
  } catch (error) {
    console.error('Error al llistar cursos:', error.message);
  }
}

testConnection();